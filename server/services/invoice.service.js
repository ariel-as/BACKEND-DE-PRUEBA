import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { dec, r2, sum } from '../utils/money.js';

const CONSUMIDOR_FINAL = '9999999999';

// Cuando se anula la venta o la inscripción: P pasa a A; E queda en la lista para anular en el SRI.
export async function markInvoiceForAnnul(tx, where) {
  const f = await tx.factura.findFirst({ where });
  if (f && f.estado === 'P') await tx.factura.update({ where: { id: f.id }, data: { estado: 'A' } });
  return f;
}

// Generar factura de una venta, de una inscripción o de ambas (BACKEND_FASE2 4.12).
export async function generateInvoice(user, { ventaId, inscripcionId, clienteId }) {
  if (!ventaId && !inscripcionId) throw new ApiError(400, 'Indica la venta, la inscripción o ambas.');
  return prisma.$transaction(async (tx) => {
    const lines = [];
    let operationClient = null, descuento = dec(0);
    if (ventaId) {
      await tx.$queryRaw`SELECT ven_numero FROM venta WHERE ven_numero = ${ventaId} FOR UPDATE`;
      const v = await tx.venta.findUnique({ where: { id: ventaId }, include: { detalleVentas: true, facturas: true } });
      if (!v) throw new ApiError(404, 'No se encontró la venta.');
      if (v.estado !== 'C') throw new ApiError(409, 'La venta está anulada y no se factura.');
      if (v.facturas) throw new ApiError(409, `La venta ya tiene la factura ${v.facturas.id}.`);
      operationClient = v.clienteId;
      for (const d of v.detalleVentas) { lines.push({ base: r2(dec(d.precioUnit).times(d.cantidad).minus(d.descuento)), iva: dec(d.porcentajeIva) }); descuento = descuento.plus(d.descuento); }
    }
    if (inscripcionId) {
      await tx.$queryRaw`SELECT ins_numero FROM inscripcion WHERE ins_numero = ${inscripcionId} FOR UPDATE`;
      const i = await tx.inscripcion.findUnique({ where: { id: inscripcionId }, include: { facturas: true, inscripcionClientes: { where: { esTitular: 'S' } } } });
      if (!i) throw new ApiError(404, 'No se encontró la inscripción.');
      if (['P', 'X'].includes(i.estado)) throw new ApiError(409, i.estado === 'P' ? 'La inscripción todavía no está cobrada.' : 'La inscripción está anulada y no se factura.');
      if (i.facturas) throw new ApiError(409, `La inscripción ya tiene la factura ${i.facturas.id}.`);
      operationClient ??= i.inscripcionClientes[0]?.clienteId;
      lines.push({ base: r2(i.valor), iva: dec(i.porcentajeIva) });
      descuento = descuento.plus(i.descuento);
    }
    const target = clienteId || operationClient;
    const cliente = await tx.cliente.findUnique({ where: { id: target } });
    if (!cliente) throw new ApiError(404, 'No se encontró el cliente de la factura.');
    if (clienteId && clienteId !== operationClient && clienteId !== CONSUMIDOR_FINAL && !cliente.ruc) throw new ApiError(409, 'Para facturar a un tercero, el cliente debe tener RUC registrado.');
    const rates = [...new Set(lines.filter((l) => l.iva.gt(0)).map((l) => l.iva.toFixed(2)))];
    if (rates.length > 1) throw new ApiError(409, 'La venta y la inscripción tienen porcentajes de IVA distintos; emite facturas separadas.');
    const porcentajeIva = dec(rates[0] || 0);
    const subtotal0 = sum(lines.filter((l) => l.iva.eq(0)).map((l) => l.base)), subtotalIva = sum(lines.filter((l) => l.iva.gt(0)).map((l) => l.base));
    const valorIva = r2(subtotalIva.times(porcentajeIva).div(100));
    return tx.factura.create({ data: { clienteId: cliente.id, empleadoId: user.empleadoId, ventaId: ventaId || null, inscripcionId: inscripcionId || null, subtotal0, subtotalIva, descuento: r2(descuento), porcentajeIva, valorIva, total: subtotal0.plus(subtotalIva).plus(valorIva), estado: 'P' } });
  });
}

// Registrar el número del SRI (001-001-000000123 con el establecimiento y punto de emisión del gimnasio) y la clave de acceso.
export async function registerSri(id, { numComprobante, claveAcceso }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT fac_numero FROM factura WHERE fac_numero = ${id} FOR UPDATE`;
    const f = await tx.factura.findUnique({ where: { id } });
    if (!f) throw new ApiError(404, 'No se encontró la factura.');
    if (f.estado !== 'P') throw new ApiError(409, f.estado === 'E' ? 'La factura ya fue emitida en el SRI.' : 'La factura está anulada.');
    const gym = await tx.gimnasio.findFirst();
    if (!numComprobante.startsWith(`${gym.establecimiento}-${gym.puntoEmision}-`)) throw new ApiError(409, `El número debe empezar con ${gym.establecimiento}-${gym.puntoEmision}- (establecimiento y punto de emisión del gimnasio).`);
    if (await tx.factura.findFirst({ where: { numComprobante, id: { not: id } } })) throw new ApiError(409, 'Ese número de factura del SRI ya está registrado.');
    if (await tx.factura.findFirst({ where: { claveAcceso, id: { not: id } } })) throw new ApiError(409, 'Esa clave de acceso ya está registrada.');
    return tx.factura.update({ where: { id }, data: { numComprobante, claveAcceso, estado: 'E' } });
  });
}

// La contadora marca como anulada en el SRI una factura emitida de una operación anulada.
export async function markAnnulled(id) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT fac_numero FROM factura WHERE fac_numero = ${id} FOR UPDATE`;
    const f = await tx.factura.findUnique({ where: { id }, include: { ventaIdRef1: true, inscripcionIdRef1: true } });
    if (!f) throw new ApiError(404, 'No se encontró la factura.');
    if (f.estado !== 'E') throw new ApiError(409, 'Solo se marca como anulada una factura emitida en el SRI.');
    if (f.ventaIdRef1?.estado !== 'X' && f.inscripcionIdRef1?.estado !== 'X') throw new ApiError(409, 'La venta o inscripción de la factura no está anulada.');
    return tx.factura.update({ where: { id }, data: { estado: 'A' } });
  });
}
