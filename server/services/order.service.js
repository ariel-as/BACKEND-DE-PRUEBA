import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { dec, conIva, sum } from '../utils/money.js';
import { checkStock } from './inventory.service.js';
import { orderRepository } from '../models/order.repository.js';
import { convertOrderToSale } from './sale.service.js';

// Transiciones permitidas del pedido web (BACKEND_FASE2 4.10).
export const TRANSICIONES = { P: ['R', 'C', 'X'], R: ['C', 'X'], C: ['E'], E: [], X: [] };
const REF = /^[\p{L}\d-]{4,30}$/u;

// Crea el pedido: verifica stock, no lo descuenta ni escribe kárdex.
export async function createOrder(user, { metodoPago, refTransferencia, items }) {
  if (refTransferencia !== undefined && refTransferencia !== null && (metodoPago !== 'TR' || !REF.test(refTransferencia))) throw new ApiError(400, 'La referencia debe tener entre 4 y 30 letras, números o guiones y solo aplica a transferencias.');
  if (items.some((item) => item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).some((k) => !['productoId', 'cantidad'].includes(k)))) throw new ApiError(400, 'Los items contienen campos no permitidos.');
  const quantities = new Map();
  for (const item of items) {
    if (!item || typeof item.productoId !== 'string' || !Number.isInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > 20) throw new ApiError(400, 'Cada producto requiere un identificador y una cantidad entre 1 y 20.');
    quantities.set(item.productoId, (quantities.get(item.productoId) || 0) + item.cantidad);
  }
  const pedidoId = await prisma.$transaction(async (tx) => {
    const ids = [...quantities.keys()];
    const products = await tx.producto.findMany({ where: { id: { in: ids }, estado: 'A', publicarWeb: 'S' } });
    if (products.length !== ids.length) { const missing = ids.find((id) => !products.some((p) => p.id === id)); throw new ApiError(400, `El producto ${missing} ya no está disponible.`); }
    await checkStock(tx, quantities);
    const gym = await tx.gimnasio.findFirst();
    const lines = products.map((p) => ({ productoId: p.id, cantidad: quantities.get(p.id), precioUnitario: dec(p.precioVenta), porcentajeIva: p.pagaIva === 'S' ? dec(gym?.porcentajeIva || 0) : dec(0) }));
    const total = sum(lines.map((l) => conIva(l.precioUnitario.times(l.cantidad), l.porcentajeIva)));
    const reported = metodoPago === 'TR' && refTransferencia;
    const pedido = await tx.pedido.create({ data: { usuarioId: user.id, metodoPagoId: metodoPago, total, estado: reported ? 'R' : 'P', ...(reported ? { refTransferencia, fechaReportePago: new Date() } : {}), detalles: { create: lines } } });
    return pedido.id;
  });
  return orderRepository.findById(pedidoId);
}

// El cliente cancela su propio pedido pendiente. No hay stock que devolver porque no se descontó.
export async function cancelOwn(user, id) {
  const p = await prisma.pedido.findUnique({ where: { id } });
  if (!p || p.usuarioId !== user.id) throw new ApiError(404, 'Pedido no encontrado.');
  if (p.estado !== 'P') throw new ApiError(409, 'Solo se puede cancelar un pedido pendiente.');
  await prisma.pedido.update({ where: { id }, data: { estado: 'X' } });
}

// Cambios de estado hechos por el personal. La conversión en venta (C) la resuelve el servicio de ventas.
export async function changeState(user, id, body) {
  const { estado, refTransferencia, pagos } = body;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT ped_numero FROM pedido WHERE ped_numero = ${id} FOR UPDATE`;
    const p = await tx.pedido.findUnique({ where: { id }, include: { usuario: { include: { cliente: true } } } });
    if (!p) throw new ApiError(404, 'Pedido no encontrado.');
    if (!(TRANSICIONES[p.estado] || []).includes(estado)) throw new ApiError(409, `No se puede pasar el pedido de ${p.estado} a ${estado}.`);
    if (estado === 'R') {
      if (p.metodoPagoId !== 'TR') throw new ApiError(409, 'Un pedido en efectivo se cobra al retirarlo; no se reporta transferencia.');
      const ref = refTransferencia || p.refTransferencia;
      if (!ref || !REF.test(ref)) throw new ApiError(400, 'El número de comprobante de la transferencia es obligatorio (4 a 30 letras, números o guiones).');
      await tx.pedido.update({ where: { id }, data: { estado: 'R', refTransferencia: ref, fechaReportePago: new Date() } });
    } else if (estado === 'C') {
      await convertOrderToSale(tx, user, p, pagos);
    } else if (estado === 'E') {
      await tx.pedido.update({ where: { id }, data: { estado: 'E', fechaRetiro: new Date() } });
      if (p.usuario.cliente) await tx.notificacion.create({ data: { destino: 'C', clienteId: p.usuario.cliente.id, pedidoId: id, tipo: 'L', mensaje: `Tu pedido ${id} fue entregado. ¡Gracias por tu compra!`, canal: 'S', estado: 'E' } });
    } else {
      await tx.pedido.update({ where: { id }, data: { estado: 'X' } });
    }
  }).then(() => orderRepository.findById(id));
}
