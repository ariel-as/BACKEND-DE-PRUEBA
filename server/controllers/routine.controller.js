import { ApiError } from '../utils/ApiError.js';
import { pagination, pageResult } from '../utils/pagination.js';
import { dateStr, todayDate } from '../utils/dates.js';
import { routineRepository as repo } from '../models/routine.repository.js';
import * as service from '../services/routine.service.js';

const dto = (r) => ({ id: r.id, clienteId: r.clienteId, cliente: r.clienteIdRef1 ? `${r.clienteIdRef1.nombre} ${r.clienteIdRef1.apellido}` : null, empleadoId: r.empleadoId, entrenador: r.empleadoIdRef1 ? `${r.empleadoIdRef1.nombre} ${r.empleadoIdRef1.apellido}` : null, nivelId: r.nivelId, nivel: r.nivelIdRef1?.descripcion, objetivo: r.objetivo, detalle: service.parseDetalle(r.detalle), estado: service.estadoRutina(r), fechaInicio: dateStr(r.fechaInicio), fechaFin: dateStr(r.fechaFin) });
const detailOf = async (user, id) => { const r = await repo.find({ id, ...service.readWhere(user) }); if (!r) throw new ApiError(404, 'No se encontró la rutina o no es tuya.'); return dto(r); };

// 4.8 Rutinas: el entrenador ve y edita las suyas; REC las lee; ADM todo.
export async function templates(_req, res) { res.json(service.plantillasDisponibles()); }
export async function exercises(_req, res) { res.json(service.catalogoEjercicios()); }
export async function clientSheet(req, res) { res.json(await service.fichaCliente(req.params.cedula)); }
export async function list(req, res) {
  const { page, limit, skip } = pagination(req.query);
  const where = { ...service.readWhere(req.user) };
  if (req.query.mias === 'S') {
    where.empleadoId = req.user.empleadoId ?? '-';
    const hoy = todayDate();
    where.fechaInicio = { lte: hoy };
    where.OR = [{ fechaFin: null }, { fechaFin: { gte: hoy } }];
  }
  if (req.query.clienteId) where.clienteId = String(req.query.clienteId);
  const [rows, total] = await Promise.all([repo.list(where, skip, limit), repo.count(where)]);
  res.json(pageResult(rows.map(dto), page, limit, total));
}
export async function detail(req, res) { res.json(await detailOf(req.user, Number(req.params.id))); }
export async function create(req, res) { const r = await service.create(req.user, req.body); res.location(`/api/v1/admin/rutinas/${r.id}`).status(201).json(await detailOf(req.user, r.id)); }
export async function update(req, res) { const r = await service.update(req.user, Number(req.params.id), req.body); res.json(await detailOf(req.user, r.id)); }
// Rutina vigente del cliente web.
export async function mine(req, res) {
  if (!req.user.clienteId) throw new ApiError(403, 'La cuenta no está vinculada a un cliente.');
  const r = await repo.current(req.user.clienteId, todayDate());
  if (!r) throw new ApiError(404, 'Todavía no tienes una rutina asignada.');
  res.json(dto(r));
}
