import { ApiError } from '../utils/ApiError.js';
import { pagination, pageResult } from '../utils/pagination.js';
import { num, num4, dec, r2, conIva } from '../utils/money.js';
import { asDate, validDate } from '../utils/dates.js';
import { saleRepository as repo } from '../models/sale.repository.js';
import { createLocalSale, annulSale } from '../services/sale.service.js';
import { generateInvoice, registerSri, markAnnulled } from '../services/invoice.service.js';

const cliente = (c) => (c ? `${c.nombre} ${c.apellido}` : null);
const saleBase = (v) => ({ id: v.id, clienteId: v.clienteId, cliente: cliente(v.clienteIdRef1), empleadoId: v.empleadoId, pedidoId: v.pedidoId, fecha: v.fecha, canal: v.canal, subtotal: num(v.subtotal), descuento: num(v.descuento), total: num(v.total), estado: v.estado, empAnulaId: v.empAnulaId, fechaAnula: v.fechaAnula, motivoAnula: v.motivoAnula });
const saleDetail = (v) => ({ ...saleBase(v), lineas: v.detalleVentas.map((d) => { const neto = r2(dec(d.precioUnit).times(d.cantidad).minus(d.descuento)); return { productoId: d.productoId, nombre: d.producto.nombre, cantidad: d.cantidad, precioUnit: num(d.precioUnit), descuento: num(d.descuento), porcentajeIva: num(d.porcentajeIva), costoUnit: num4(d.costoUnit), total: num(conIva(neto, d.porcentajeIva)) }; }), pagos: v.pagos.map((p) => ({ id: p.id, metodoPago: p.metodoPagoId, monto: num(p.monto), referencia: p.referencia, estado: p.estado })), kardex: v.kardexs.map((k) => ({ id: k.id, tipo: k.tipoMovimientoId, loteProductoId: k.loteProductoId, cantidad: k.cantidad })), factura: v.facturas ? { id: v.facturas.id, estado: v.facturas.estado, numComprobante: v.facturas.numComprobante } : null });
const invoiceDto = (f) => ({ id: f.id, clienteId: f.clienteId, cliente: cliente(f.clienteIdRef1), ruc: f.clienteIdRef1?.ruc ?? null, empleadoId: f.empleadoId, ventaId: f.ventaId, inscripcionId: f.inscripcionId, numComprobante: f.numComprobante, claveAcceso: f.claveAcceso, fecha: f.fecha, subtotal0: num(f.subtotal0), subtotalIva: num(f.subtotalIva), descuento: num(f.descuento), porcentajeIva: num(f.porcentajeIva), valorIva: num(f.valorIva), total: num(f.total), estado: f.estado, ventaAnulada: f.ventaIdRef1?.estado === 'X', inscripcionAnulada: f.inscripcionIdRef1?.estado === 'X' });
const range = (q, field) => { if ((q.desde && !validDate(q.desde)) || (q.hasta && !validDate(q.hasta))) throw new ApiError(400, 'Las fechas van con el formato AAAA-MM-DD.'); return q.desde || q.hasta ? { [field]: { ...(q.desde ? { gte: asDate(q.desde) } : {}), ...(q.hasta ? { lt: new Date(asDate(q.hasta).getTime() + 86400000) } : {}) } } : {}; };
const saleOf = async (id) => { const v = await repo.findSale(id); if (!v) throw new ApiError(404, 'No se encontró la venta.'); return saleDetail(v); };
const invoiceOf = async (id) => { const f = await repo.findInvoice(id); if (!f) throw new ApiError(404, 'No se encontró la factura.'); return invoiceDto(f); };

export async function createSale(req, res) { const id = await createLocalSale(req.user, req.body); res.location(`/api/v1/admin/ventas/${id}`).status(201).json(await saleOf(id)); }
export async function listSales(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const where = { ...range(req.query, 'fecha'), ...(req.query.canal ? { canal: String(req.query.canal) } : {}), ...(req.query.estado ? { estado: String(req.query.estado) } : {}), ...(req.query.clienteId ? { clienteId: String(req.query.clienteId) } : {}) };
  const [rows, total] = await Promise.all([repo.listSales(where, skip, limit), repo.countSales(where)]);
  res.json(pageResult(rows.map(saleBase), page, limit, total));
}
export async function getSale(req, res) { res.json(await saleOf(Number(req.params.id))); }
export async function annul(req, res) { res.json(await saleOf(await annulSale(req.user, Number(req.params.id), req.body.motivo))); }

export async function createInvoice(req, res) { const f = await generateInvoice(req.user, req.body); res.location(`/api/v1/admin/facturas/${f.id}`).status(201).json(await invoiceOf(f.id)); }
export async function listInvoices(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const where = { ...range(req.query, 'fecha'), ...(req.query.estado ? { estado: String(req.query.estado) } : {}), ...(req.query.clienteId ? { clienteId: String(req.query.clienteId) } : {}) };
  const [rows, total] = await Promise.all([repo.listInvoices(where, skip, limit), repo.countInvoices(where)]);
  res.json(pageResult(rows.map(invoiceDto), page, limit, total));
}
export async function toAnnul(req, res) { const { page, limit, skip } = pagination(req.query); const [rows, total] = await Promise.all([repo.listInvoices(repo.toAnnulWhere, skip, limit), repo.countInvoices(repo.toAnnulWhere)]); res.json(pageResult(rows.map(invoiceDto), page, limit, total)); }
export async function getInvoice(req, res) { res.json(await invoiceOf(Number(req.params.id))); }
export async function sri(req, res) { await registerSri(Number(req.params.id), req.body); res.json(await invoiceOf(Number(req.params.id))); }
export async function annulInvoice(req, res) { await markAnnulled(Number(req.params.id)); res.json(await invoiceOf(Number(req.params.id))); }
