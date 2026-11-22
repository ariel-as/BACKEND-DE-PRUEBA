import { ApiError } from '../utils/ApiError.js';
import { pagination, pageResult } from '../utils/pagination.js';
import { asDate, validDate } from '../utils/dates.js';
import { num } from '../utils/money.js';
import { cashRepository } from '../models/cash.repository.js';
import { openShift, currentShift, manualMovement, closeShift, weeklyClose, shiftDto, closeDto } from '../services/cash.service.js';

export async function open(req, res) { res.status(201).json(await openShift(req.user, req.body)); }
export async function current(_req, res) { res.json(await currentShift()); }
export async function movement(req, res) { const m = await manualMovement(req.user, req.body); res.status(201).json({ id: m.id, cuadreTurnoId: m.cuadreTurnoId, tipo: m.tipoMovimientoId, pagoId: m.pagoId, concepto: m.concepto, monto: num(m.monto), fecha: m.fecha }); }
export async function close(req, res) { res.json(await closeShift(Number(req.params.id), req.body)); }
export async function list(req, res) {
  const { page, limit, skip } = pagination(req.query), where = {};
  const { desde, hasta } = req.query;
  if ((desde && !validDate(desde)) || (hasta && !validDate(hasta))) throw new ApiError(400, 'Las fechas van con el formato AAAA-MM-DD.');
  if (desde || hasta) where.fecha = { ...(desde ? { gte: asDate(desde) } : {}), ...(hasta ? { lte: asDate(hasta) } : {}) };
  const [rows, total] = await Promise.all([cashRepository.listShifts(where, skip, limit), cashRepository.countShifts(where)]);
  res.json(pageResult(rows.map(shiftDto), page, limit, total));
}
export async function detail(req, res) { const c = await cashRepository.findShift(Number(req.params.id)); if (!c) throw new ApiError(404, 'No se encontró el turno de caja.'); res.json(shiftDto(c)); }
export async function createClose(req, res) { res.status(201).json(await weeklyClose(req.user, req.body)); }
export async function closes(req, res) { const { page, limit, skip } = pagination(req.query); const [rows, total] = await Promise.all([cashRepository.listCloses(skip, limit), cashRepository.countCloses()]); res.json(pageResult(rows.map(closeDto), page, limit, total)); }
