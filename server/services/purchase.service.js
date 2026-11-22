import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { dec, r2, sum } from '../utils/money.js';
import { localToday, asDate, validDate } from '../utils/dates.js';
import { receiveStock } from './inventory.service.js';
import { checkAdminEmployee } from './enrollment.service.js';

// ---- Órdenes de compra (BACKEND_FASE2 4.13) ----
// P=Pendiente, A=Autorizada, M=Recibida parcialmente, R=Recibida completa, X=Anulada.
const lockOrder = (tx, id) => tx.$queryRaw`SELECT orc_numero FROM orden_compra WHERE orc_numero = ${id} FOR UPDATE`;
const needEmployee = (user) => { if (!user.empleadoId) throw new ApiError(403, 'Tu cuenta debe estar vinculada a un empleado para registrar esta operación'); };

// Crear orden con líneas (estado P). El monto lo calcula el servidor: Σ cantidad × costo unitario.
export async function createOrder(user, { proveedorId, fechaEntrega, items }) {
  needEmployee(user);
  const ids = items.map((i) => i.productoId);
  if (new Set(ids).size !== ids.length) throw new ApiError(400, 'Cada producto va una sola vez en la orden.');
  if (fechaEntrega && (!validDate(fechaEntrega) || fechaEntrega < localToday())) throw new ApiError(400, 'La fecha de entrega no puede ser anterior a hoy.');
  return prisma.$transaction(async (tx) => {
    const prov = await tx.proveedor.findUnique({ where: { id: proveedorId } });
    if (!prov) throw new ApiError(404, 'No se encontró el proveedor.');
    const productos = await tx.producto.findMany({ where: { id: { in: ids } } });
    for (const id of ids) {
      const p = productos.find((x) => x.id === id);
      if (!p || p.estado !== 'A') throw new ApiError(409, `El producto ${id} no existe o está inactivo.`);
      if (p.esContable !== 'S') throw new ApiError(409, `${p.nombre} no es contable y no lleva kárdex.`);
    }
    const lineas = items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, costoUnit: r2(i.costoUnit) }));
    const monto = r2(sum(lineas.map((l) => r2(dec(l.costoUnit).times(l.cantidad)))));
    const o = await tx.ordenCompra.create({ data: { proveedorId, empleadoId: user.empleadoId, fechaEntrega: fechaEntrega ? asDate(fechaEntrega) : null, monto, estado: 'P', productoOrdenCompras: { create: lineas } } });
    return o.id;
  });
}

// Autorizar (solo ADM activo): P → A.
export async function authorize(user, id) {
  return prisma.$transaction(async (tx) => {
    await checkAdminEmployee(tx, user.empleadoId, 'autoriza');
    await lockOrder(tx, id);
    const o = await tx.ordenCompra.findUnique({ where: { id } });
    if (!o) throw new ApiError(404, 'No se encontró la orden de compra.');
    if (o.estado !== 'P') throw new ApiError(409, 'Solo se autoriza una orden pendiente.');
    await tx.ordenCompra.update({ where: { id }, data: { estado: 'A', empAutorizaId: user.empleadoId, fechaAutoriza: new Date() } });
    return id;
  });
}

// Anular: solo si no se recibió nada (P o A).
export async function annul(id) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, id);
    const o = await tx.ordenCompra.findUnique({ where: { id } });
    if (!o) throw new ApiError(404, 'No se encontró la orden de compra.');
    if (!['P', 'A'].includes(o.estado)) throw new ApiError(409, o.estado === 'X' ? 'La orden ya está anulada.' : 'La orden ya tiene mercadería recibida y no se puede anular.');
    await tx.ordenCompra.update({ where: { id }, data: { estado: 'X' } });
    return id;
  });
}

// Recibir completa o en partes: cada línea crea su lote ligado a la orden (entrada COM en el kárdex)
// y la orden pasa a M o R según lo recibido.
export async function receive(user, id, { items, observacion }) {
  needEmployee(user);
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, id);
    const o = await tx.ordenCompra.findUnique({ where: { id }, include: { productoOrdenCompras: { include: { loteProductos: { select: { cantidadInicial: true } } } } } });
    if (!o) throw new ApiError(404, 'No se encontró la orden de compra.');
    if (!['A', 'M'].includes(o.estado)) throw new ApiError(409, o.estado === 'P' ? 'La orden todavía no está autorizada.' : 'La orden no admite más recepciones.');
    const recibido = new Map(o.productoOrdenCompras.map((l) => [l.productoId, l.loteProductos.reduce((n, x) => n + x.cantidadInicial, 0)]));
    for (const it of items) {
      const linea = o.productoOrdenCompras.find((l) => l.productoId === it.productoId);
      if (!linea) throw new ApiError(409, `El producto ${it.productoId} no está en la orden ${id}.`);
      const pendiente = linea.cantidad - recibido.get(it.productoId);
      if (it.cantidad > pendiente) throw new ApiError(409, `Del producto ${it.productoId} quedan ${pendiente} unidades por recibir.`);
      await receiveStock(tx, { productoId: it.productoId, cantidad: it.cantidad, costoUnit: it.costoUnit ?? linea.costoUnit, fechaCaducidad: it.fechaCaducidad, numFabricante: it.numFabricante, employeeId: user.empleadoId, observacion: observacion ? `Orden ${id}: ${observacion}`.slice(0, 200) : undefined, ordenCompraId: id });
      recibido.set(it.productoId, recibido.get(it.productoId) + it.cantidad);
    }
    const completa = o.productoOrdenCompras.every((l) => recibido.get(l.productoId) >= l.cantidad);
    await tx.ordenCompra.update({ where: { id }, data: { estado: completa ? 'R' : 'M' } });
    return id;
  }, { timeout: 20000 });
}
