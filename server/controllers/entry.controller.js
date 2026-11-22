import { ApiError } from '../utils/ApiError.js';
import { pagination, pageResult } from '../utils/pagination.js';
import { asDate, validDate, localToday, dateStr } from '../utils/dates.js';
import { entryRepository } from '../models/entry.repository.js';
import { registerEntry, registerExit, capacity, accessInfo } from '../services/entry.service.js';

const dto = (e) => ({ id: e.id, clienteId: e.clienteId, cliente: e.inscripcionIdclienteIdRef1 ? `${e.inscripcionIdclienteIdRef1.clienteIdRef1.nombre} ${e.inscripcionIdclienteIdRef1.clienteIdRef1.apellido}` : e.cliente, inscripcionId: e.inscripcionId, plan: e.inscripcionIdclienteIdRef1?.inscripcionIdRef1?.membresiaIdRef1?.nombre, claseId: e.claseId, horarioId: e.horarioId, clase: e.claseIdhorarioIdRef1?.claseIdRef1?.nombre ?? e.clase ?? null, fecha: dateStr(e.fecha), horaIngreso: e.horaIngreso, horaSalida: e.horaSalida, ...(e.ingresosRestantes !== undefined ? { ingresosRestantes: e.ingresosRestantes } : {}) });
export async function create(req, res) { res.status(201).json(dto(await registerEntry(req.user, req.body))); }
export async function exit(req, res) { res.json(dto(await registerExit(Number(req.params.id)))); }
export async function list(req, res) {
  const { page, limit, skip } = pagination(req.query), fecha = req.query.fecha || localToday();
  if (!validDate(fecha)) throw new ApiError(400, 'La fecha va con el formato AAAA-MM-DD.');
  const where = { fecha: asDate(fecha), ...(req.query.abiertas === 'S' ? { horaSalida: null } : {}) };
  const [rows, total] = await Promise.all([entryRepository.list(where, skip, limit), entryRepository.count(where)]);
  res.json(pageResult(rows.map(dto), page, limit, total));
}
export async function aforo(_req, res) { res.json(await capacity()); }
export async function access(req, res) { res.json(await accessInfo(req.params.cedula)); }
