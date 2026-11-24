import { randomInt } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { dec, r2, sum } from '../utils/money.js';

const CONSUMIDOR_FINAL = '9999999999';
const RUC_FICTICIO = '0999999999001';
const OFFSET_MS = 5 * 60 * 60 * 1000;
const PESOS = [2, 3, 4, 5, 6, 7];

// Cuando se anula la venta o la inscripción: P pasa a A; E queda en la lista para anular en el SRI.
export async function markInvoiceForAnnul(tx, where) {
  const f = await tx.factura.findFirst({ where });
  if (f && f.estado === 'P') await tx.factura.update({ where: { id: f.id }, data: { estado: 'A' } });
  return f;
}

const pad = (value, length = 2) => String(value).padStart(length, '0');
const sriDate = (value) => {
  const d = new Date(new Date(value).getTime() - OFFSET_MS);
  return `${pad(d.getUTCDate())}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCFullYear(), 4)}`;
};
export function digitoVerificador(base48) {
  if (!/^\d{48}$/.test(base48)) throw new ApiError(400, 'La clave de acceso sin el dígito verificador debe tener 48 dígitos.');
  let suma = 0;
  for (let i = 0; i < base48.length; i++) suma += Number(base48[base48.length - 1 - i]) * PESOS[i % PESOS.length];
  const resto = suma % 11, digito = 11 - resto;
  return digito === 11 ? 0 : digito === 10 ? 1 : digito;
}
export function buildAccessKey({ fecha, ruc, establecimiento, puntoEmision, secuencial, codigo }) {
  const serie = `${pad(establecimiento, 3)}${pad(puntoEmision, 3)}`;
  const base = `${sriDate(fecha)}01${ruc}1${serie}${pad(secuencial, 9)}${pad(codigo, 8)}1`;
  return `${base}${digitoVerificador(base)}`;
}
const rucDelGimnasio = (gym) => (/^\d{13}$/.test(gym?.id || '') ? gym.id : RUC_FICTICIO);
const numeroComprobante = (gym, secuencial) => `${gym.establecimiento}-${gym.puntoEmision}-${pad(secuencial, 9)}`;
const siguienteSecuencial = (actual) => pad(BigInt(actual) + 1n, 9);

async function ultimoSecuencial(tx, gym) {
  const prefijo = `${gym.establecimiento}-${gym.puntoEmision}-`;
  const last = await tx.factura.findFirst({ where: { numComprobante: { startsWith: prefijo } }, orderBy: { numComprobante: 'desc' } });
  return last ? last.numComprobante.slice(-9) : '000000000';
}
async function bloquearGimnasio(tx, gym) {
  await tx.$queryRaw`SELECT gim_ruc FROM gimnasio WHERE gim_ruc = ${gym.id} FOR UPDATE`;
}
async function claveUnica(tx, { fecha, gym, secuencial }) {
  const ruc = rucDelGimnasio(gym);
  for (let intento = 0; intento < 10; intento++) {
    const codigo = pad(randomInt(0, 100000000), 8);
    const clave = buildAccessKey({ fecha, ruc, establecimiento: gym.establecimiento, puntoEmision: gym.puntoEmision, secuencial, codigo });
    if (!(await tx.factura.findUnique({ where: { claveAcceso: clave } }))) return clave;
  }
  throw new ApiError(409, 'No se pudo generar una clave de acceso única.');
}

async function emitirFactura(tx, fecha) {
  const gym = await tx.gimnasio.findFirst();
  if (!gym) throw new ApiError(409, 'No hay datos del gimnasio para facturar.');
  await bloquearGimnasio(tx, gym);
  const secuencial = siguienteSecuencial(await ultimoSecuencial(tx, gym));
  return { numComprobante: numeroComprobante(gym, secuencial), claveAcceso: await claveUnica(tx, { fecha, gym, secuencial }) };
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
    const fecha = new Date();
    const emitida = await emitirFactura(tx, fecha);
    return tx.factura.create({ data: { clienteId: cliente.id, empleadoId: user.empleadoId, ventaId: ventaId || null, inscripcionId: inscripcionId || null, subtotal0, subtotalIva, descuento: r2(descuento), porcentajeIva, valorIva, total: subtotal0.plus(subtotalIva).plus(valorIva), fecha, ...emitida, estado: 'E' } });
  });
}

// Registrar el número del SRI (001-001-000000123 con el establecimiento y punto de emisión del gimnasio) y la clave de acceso.
export async function registerSri(id, { numComprobante, claveAcceso }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT fac_numero FROM factura WHERE fac_numero = ${id} FOR UPDATE`;
    const f = await tx.factura.findUnique({ where: { id } });
    if (!f) throw new ApiError(404, 'No se encontró la factura.');
    if (!['P', 'E'].includes(f.estado)) throw new ApiError(409, 'La factura está anulada.');
    const gym = await tx.gimnasio.findFirst();
    if (!numComprobante.startsWith(`${gym.establecimiento}-${gym.puntoEmision}-`)) throw new ApiError(409, `El número debe empezar con ${gym.establecimiento}-${gym.puntoEmision}- (establecimiento y punto de emisión del gimnasio).`);
    if (await tx.factura.findFirst({ where: { numComprobante, id: { not: id } } })) throw new ApiError(409, 'Ese número de factura del SRI ya está registrado.');
    if (await tx.factura.findFirst({ where: { claveAcceso, id: { not: id } } })) throw new ApiError(409, 'Esa clave de acceso ya está registrada.');
    return tx.factura.update({ where: { id }, data: { numComprobante, claveAcceso, estado: 'E' } });
  });
}

export async function backfillInvoices() {
  return prisma.$transaction(async (tx) => {
    const gym = await tx.gimnasio.findFirst();
    if (!gym) throw new ApiError(409, 'No hay datos del gimnasio para numerar las facturas.');
    await bloquearGimnasio(tx, gym);
    let secuencial = siguienteSecuencial(await ultimoSecuencial(tx, gym));
    const pendientes = await tx.factura.findMany({ where: { OR: [{ numComprobante: null }, { claveAcceso: null }] }, orderBy: { id: 'asc' } });
    const actualizados = [];
    for (const f of pendientes) {
      const numComprobante = numeroComprobante(gym, secuencial);
      const claveAcceso = await claveUnica(tx, { fecha: f.fecha, gym, secuencial });
      await tx.factura.update({ where: { id: f.id }, data: { numComprobante, claveAcceso, estado: f.estado === 'A' ? 'A' : 'E' } });
      actualizados.push({ id: f.id, numComprobante, claveAcceso });
      secuencial = siguienteSecuencial(secuencial);
    }
    return actualizados;
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
