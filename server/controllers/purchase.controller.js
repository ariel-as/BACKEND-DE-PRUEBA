import { ApiError } from '../utils/ApiError.js';
import { pagination, pageResult } from '../utils/pagination.js';
import { num, dec } from '../utils/money.js';
import { dateStr } from '../utils/dates.js';
import { purchaseRepository as repo } from '../models/purchase.repository.js';
import * as service from '../services/purchase.service.js';

const ESTADOS = { P: 'Pendiente', A: 'Autorizada', M: 'Recibida parcialmente', R: 'Recibida completa', X: 'Anulada' };
const nombre = (e) => (e ? `${e.nombre} ${e.apellido}` : null);
const listDto = (o) => ({ id: o.id, proveedorId: o.proveedorId, proveedor: o.proveedorIdRef1?.nombre, fecha: o.fecha, fechaEntrega: dateStr(o.fechaEntrega), monto: num(o.monto), estado: o.estado, estadoNombre: ESTADOS[o.estado], lineas: o._count?.productoOrdenCompras });
function detailDto(o) {
  return {
    ...listDto(o), empleadoId: o.empleadoId, empleado: nombre(o.empleadoIdRef1), empAutorizaId: o.empAutorizaId, autoriza: nombre(o.empAutorizaIdRef2), fechaAutoriza: o.fechaAutoriza, lineas: undefined,
    items: o.productoOrdenCompras.map((l) => { const recibido = l.loteProductos.reduce((n, x) => n + x.cantidadInicial, 0); return { productoId: l.productoId, producto: l.producto?.nombre, cantidad: l.cantidad, costoUnit: num(l.costoUnit), subtotal: num(dec(l.costoUnit).times(l.cantidad)), recibido, pendiente: l.cantidad - recibido, lotes: l.loteProductos.map((x) => ({ id: x.id, cantidad: x.cantidadInicial, fechaIngreso: dateStr(x.fechaIngreso), fechaCaducidad: dateStr(x.fechaCaducidad), costoUnit: num(x.costoUnit) })) }; })
  };
}
const detailOf = async (id) => { const o = await repo.detail(id); if (!o) throw new ApiError(404, 'No se encontró la orden de compra.'); return detailDto(o); };

export async function list(req, res) {
  const { page, limit, skip } = pagination(req.query), where = {};
  if (req.query.estado) where.estado = String(req.query.estado);
  if (req.query.proveedorId) where.proveedorId = String(req.query.proveedorId);
  const [rows, total] = await Promise.all([repo.list(where, skip, limit), repo.count(where)]);
  res.json(pageResult(rows.map(listDto), page, limit, total));
}
export async function detail(req, res) { res.json(await detailOf(Number(req.params.id))); }
export async function create(req, res) { const id = await service.createOrder(req.user, req.body); res.location(`/api/v1/admin/compras/${id}`).status(201).json(await detailOf(id)); }
export async function authorize(req, res) { res.json(await detailOf(await service.authorize(req.user, Number(req.params.id)))); }
export async function annul(req, res) { res.json(await detailOf(await service.annul(Number(req.params.id)))); }
export async function receive(req, res) { res.status(201).json(await detailOf(await service.receive(req.user, Number(req.params.id), req.body))); }
