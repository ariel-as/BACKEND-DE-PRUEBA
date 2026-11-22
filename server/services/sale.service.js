import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { dec, r2, r4, sum, conIva } from '../utils/money.js';
import { registerSaleMovement, returnToLots, returnNonCountable } from './inventory.service.js';
import { registerPayments, refundPayments } from './cash.service.js';
import { markInvoiceForAnnul } from './invoice.service.js';

export const CONSUMIDOR_FINAL = '9999999999';
const needEmployee = (user) => { if (!user.empleadoId) throw new ApiError(403, 'Tu cuenta debe estar vinculada a un empleado para registrar esta operación'); };

// Crea la venta con sus líneas y saca del kárdex por lote (VEN ligado a la venta).
// lines: [{ productoId, cantidad, precioUnit, porcentajeIva, descuento }]
async function createSale(tx, { clienteId, empleadoId, pedidoId = null, canal, lines, observacion }) {
  const prepared = lines.map((l) => { const base = r2(dec(l.precioUnit).times(l.cantidad)), descuento = r2(l.descuento || 0), neto = base.minus(descuento); return { ...l, base, descuento, neto, total: conIva(neto, l.porcentajeIva) }; });
  const subtotal = sum(prepared.map((l) => l.base)), descuento = sum(prepared.map((l) => l.descuento)), total = sum(prepared.map((l) => l.total));
  const venta = await tx.venta.create({ data: { clienteId, empleadoId, pedidoId, subtotal, descuento, total, canal, estado: 'C' } });
  for (const l of prepared) {
    const { costoPromedio } = await registerSaleMovement(tx, { productId: l.productoId, quantity: l.cantidad, employeeId: empleadoId, ventaId: venta.id, observation: `${observacion} ${venta.id}` });
    await tx.detalleVenta.create({ data: { ventaId: venta.id, productoId: l.productoId, cantidad: l.cantidad, precioUnit: r2(l.precioUnit), costoUnit: r4(costoPromedio ?? 0), descuento: l.descuento, porcentajeIva: dec(l.porcentajeIva) } });
  }
  return { venta, total };
}

// Pasar un pedido a C = convertirlo en venta canal W, en la transacción del cambio de estado.
// Si ya no alcanza el stock, el kárdex responde 409 y el pedido queda como estaba.
export async function convertOrderToSale(tx, user, pedido, pagos) {
  needEmployee(user);
  const detalles = await tx.pedidoDetalle.findMany({ where: { pedidoId: pedido.id } });
  const clienteId = pedido.usuario?.cliente?.id || CONSUMIDOR_FINAL;
  const { venta, total } = await createSale(tx, { clienteId, empleadoId: user.empleadoId, pedidoId: pedido.id, canal: 'W', lines: detalles.map((d) => ({ productoId: d.productoId, cantidad: d.cantidad, precioUnit: d.precioUnitario, porcentajeIva: d.porcentajeIva, descuento: 0 })), observacion: `Venta web del pedido ${pedido.id}, venta` });
  const payments = pagos && pagos.length ? pagos : [{ metodoPago: pedido.metodoPagoId, monto: Number(total.toFixed(2)), referencia: pedido.refTransferencia }];
  await registerPayments(tx, { pagos: payments, total, ventaId: venta.id, empleadoId: user.empleadoId, concepto: `Cobro del pedido web ${pedido.id}` });
  await tx.pedido.update({ where: { id: pedido.id }, data: { estado: 'C' } });
  return venta;
}

// Venta en mostrador (canal L): precio e IVA de la base, descuento por línea opcional, kárdex, pagos y caja.
export async function createLocalSale(user, { clienteId, items, pagos }) {
  needEmployee(user);
  const quantities = new Map(), discounts = new Map();
  for (const it of items) { quantities.set(it.productoId, (quantities.get(it.productoId) || 0) + it.cantidad); discounts.set(it.productoId, dec(discounts.get(it.productoId) || 0).plus(dec(it.descuento || 0))); }
  return prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.findUnique({ where: { id: clienteId || CONSUMIDOR_FINAL } });
    if (!cliente || cliente.estado !== 'A') throw new ApiError(409, 'El cliente no existe o está inactivo.');
    const ids = [...quantities.keys()];
    const products = await tx.producto.findMany({ where: { id: { in: ids }, estado: 'A' } });
    if (products.length !== ids.length) { const missing = ids.find((id) => !products.some((p) => p.id === id)); throw new ApiError(409, `El producto ${missing} no existe o está inactivo.`); }
    const gym = await tx.gimnasio.findFirst();
    const lines = products.map((p) => {
      const cantidad = quantities.get(p.id), base = r2(dec(p.precioVenta).times(cantidad)), descuento = r2(discounts.get(p.id));
      if (descuento.gt(base)) throw new ApiError(400, `El descuento de ${p.nombre} no puede superar el valor de la línea (${base.toFixed(2)}).`);
      return { productoId: p.id, cantidad, precioUnit: p.precioVenta, porcentajeIva: p.pagaIva === 'S' ? dec(gym?.porcentajeIva || 0) : dec(0), descuento };
    });
    const { venta, total } = await createSale(tx, { clienteId: cliente.id, empleadoId: user.empleadoId, canal: 'L', lines, observacion: 'Venta en mostrador' });
    await registerPayments(tx, { pagos, total, ventaId: venta.id, empleadoId: user.empleadoId, concepto: `Venta ${venta.id}` });
    return venta.id;
  });
}

// Anular venta (solo ADM, con motivo): unidades al mismo lote (ANV), pagos anulados con su DEV,
// factura a la lista para anular en el SRI y, si venía de un pedido web, el pedido pasa a X.
export async function annulSale(user, id, motivo) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT ven_numero FROM venta WHERE ven_numero = ${id} FOR UPDATE`;
    const venta = await tx.venta.findUnique({ where: { id }, include: { detalleVentas: { include: { producto: true } }, kardexs: true } });
    if (!venta) throw new ApiError(404, 'No se encontró la venta.');
    if (venta.estado !== 'C') throw new ApiError(409, 'La venta ya está anulada.');
    const salidas = venta.kardexs.filter((k) => k.tipoMovimientoId === 'VEN').map((k) => ({ loteProductoId: k.loteProductoId, cantidad: k.cantidad, costoUnit: k.costoUnit }));
    if (salidas.length) await returnToLots(tx, { rows: salidas, ventaId: id, employeeId: user.empleadoId, observation: `Anulación de la venta ${id}: ${motivo}`.slice(0, 200) });
    for (const d of venta.detalleVentas.filter((x) => x.producto.esContable !== 'S')) await returnNonCountable(tx, d.productoId, d.cantidad);
    await refundPayments(tx, { where: { ventaId: id }, empleadoId: user.empleadoId, concepto: `Devolución por anulación de la venta ${id}` });
    await markInvoiceForAnnul(tx, { ventaId: id });
    if (venta.pedidoId) await tx.pedido.update({ where: { id: venta.pedidoId }, data: { estado: 'X', fechaRetiro: null } });
    await tx.venta.update({ where: { id }, data: { estado: 'X', empAnulaId: user.empleadoId, fechaAnula: new Date(), motivoAnula: motivo } });
    return id;
  });
}
