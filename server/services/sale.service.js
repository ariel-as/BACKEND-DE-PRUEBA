import { ApiError } from '../utils/ApiError.js';
import { dec, r2, r4, sum, conIva } from '../utils/money.js';
import { registerSaleMovement } from './inventory.service.js';
import { registerPayments } from './cash.service.js';

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
