import { ApiError } from '../utils/ApiError.js';
import { pagination, pageResult } from '../utils/pagination.js';
import { num, conIva } from '../utils/money.js';
import { dateStr } from '../utils/dates.js';
import { enrollmentRepository } from '../models/enrollment.repository.js';
import * as service from '../services/enrollment.service.js';

const ESTADOS = { P: 'Pendiente de pago', A: 'Activa', V: 'Vencida', S: 'Suspendida', X: 'Anulada' };
const base = (i) => ({ id: i.id, membresiaId: i.membresiaId, plan: i.membresiaIdRef1?.nombre, canal: i.canal, estado: i.estado, estadoNombre: ESTADOS[i.estado], fechaRegistro: i.fechaRegistro, fechaInicio: dateStr(i.fechaInicio), fechaFin: dateStr(i.fechaFin), ingresosTotal: i.ingresosTotal, precioBase: num(i.precioBase), descuento: num(i.descuento), valor: num(i.valor), porcentajeIva: num(i.porcentajeIva), total: num(conIva(i.valor, i.porcentajeIva)), empleadoId: i.empleadoId });
export const listDto = (i) => { const t = i.inscripcionClientes?.[0]; return { ...base(i), titular: t ? { clienteId: t.clienteId, nombre: `${t.clienteIdRef1.nombre} ${t.clienteIdRef1.apellido}` } : null }; };
export function detailDto(i) {
  const entradas = i.inscripcionClientes.flatMap((m) => m.asistenciaClientes).sort((a, b) => b.id - a.id);
  return {
    ...base(i), promocion: i.promocionIdRef1 ? { id: i.promocionIdRef1.id, descripcion: i.promocionIdRef1.descripcion, porcentaje: num(i.promocionIdRef1.porcentaje) } : null,
    empAutorizaId: i.empAutorizaId, fechaAutoriza: i.fechaAutoriza, empAnulaId: i.empAnulaId, fechaAnula: i.fechaAnula, motivoAnula: i.motivoAnula,
    ingresosUsados: i.ingresosTotal ? entradas.length : null, ingresosRestantes: i.ingresosTotal ? i.ingresosTotal - entradas.length : null,
    integrantes: i.inscripcionClientes.map((m) => ({ clienteId: m.clienteId, nombre: `${m.clienteIdRef1.nombre} ${m.clienteIdRef1.apellido}`, esTitular: m.esTitular, entradas: m.asistenciaClientes.length })),
    pagos: i.pagos.map((p) => ({ id: p.id, metodoPago: p.metodoPagoId, monto: num(p.monto), referencia: p.referencia, fecha: dateStr(p.fecha), estado: p.estado })),
    entradas: entradas.slice(0, 50).map((e) => ({ id: e.id, clienteId: e.clienteId, fecha: dateStr(e.fecha), horaIngreso: e.horaIngreso, horaSalida: e.horaSalida, claseId: e.claseId, horarioId: e.horarioId })),
    suspensiones: i.suspensions.map((s) => ({ id: s.id, fechaInicio: dateStr(s.fechaInicio), fechaFin: dateStr(s.fechaFin), diasRecuperados: s.diasRecuperados, motivo: s.motivo, certificado: s.certificado, estado: s.estado, motivoAnula: s.motivoAnula })),
    factura: i.facturas ? { id: i.facturas.id, numComprobante: i.facturas.numComprobante, estado: i.facturas.estado, total: num(i.facturas.total) } : null
  };
}
const detailOf = async (id) => { const i = await enrollmentRepository.detail(id); if (!i) throw new ApiError(404, 'No se encontró la inscripción.'); return detailDto(i); };

export async function list(req, res) {
  const { page, limit, skip } = pagination(req.query), where = {};
  const { estado, canal, clienteId } = req.query;
  if (estado) where.estado = String(estado);
  if (canal) where.canal = String(canal);
  if (clienteId) where.inscripcionClientes = { some: { clienteId: String(clienteId) } };
  const [rows, total] = await Promise.all([enrollmentRepository.list(where, skip, limit), enrollmentRepository.count(where)]);
  res.json(pageResult(rows.map(listDto), page, limit, total));
}
export async function detail(req, res) { res.json(await detailOf(Number(req.params.id))); }
export async function create(req, res) { const id = await service.createLocalEnrollment(req.user, req.body); res.location(`/api/v1/admin/inscripciones/${id}`).status(201).json(await detailOf(id)); }
export async function charge(req, res) { res.json(await detailOf(await service.chargePending(req.user, Number(req.params.id), req.body))); }
export async function addMember(req, res) { res.status(201).json(await detailOf(await service.addMember(Number(req.params.id), req.body.clienteId))); }
export async function removeMember(req, res) { res.json(await detailOf(await service.removeMember(Number(req.params.id), req.params.cedula))); }
export async function renew(req, res) { const id = await service.renew(req.user, Number(req.params.id), req.body); res.location(`/api/v1/admin/inscripciones/${id}`).status(201).json(await detailOf(id)); }
export async function suspend(req, res) { const s = await service.suspend(req.user, Number(req.params.id), req.body); res.status(201).json(await detailOf(s.inscripcionId)); }
export async function annulSuspension(req, res) { const s = await service.annulSuspension(req.user, Number(req.params.id), req.body.motivo); res.json(await detailOf(s.inscripcionId)); }
export async function annul(req, res) { res.json(await detailOf(await service.annulEnrollment(req.user, Number(req.params.id), req.body.motivo))); }
