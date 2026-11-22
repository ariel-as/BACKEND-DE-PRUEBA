import { dateStr } from '../utils/dates.js';
import * as service from '../services/staff.service.js';

const dto = (a) => ({ id: a.id, empleadoId: a.empleadoId, fecha: dateStr(a.fecha), horaEntrada: a.horaEntrada, horaSalida: a.horaSalida, observacion: a.observacion });
// 4.3 Asistencia del personal: marcar la propia (o la de empleadoId si es ADM), corregir y reporte.
export async function entry(req, res) { res.status(201).json(dto(await service.markEntry(req.user, req.body))); }
export async function exit(req, res) { res.json(dto(await service.markExit(req.user, req.body))); }
export async function correct(req, res) { res.json(dto(await service.correct(Number(req.params.id), req.body))); }
export async function report(req, res) { res.json(await service.report(req.query)); }
