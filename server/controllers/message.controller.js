import { ApiError } from '../utils/ApiError.js';
import { pagination, pageResult } from '../utils/pagination.js';
import { messageRepository as repo } from '../models/message.repository.js';

const dto = (m) => ({ id: m.id, nombre: m.nombre, correo: m.correo, telefono: m.telefono, mensaje: m.mensaje, fecha: m.fecha, estado: m.estado, estadoNombre: m.estado === 'R' ? 'Respondido' : 'Pendiente', empleadoId: m.empleadoId, atendidoPor: m.empleadoIdRef1 ? `${m.empleadoIdRef1.nombre} ${m.empleadoIdRef1.apellido}` : null });
// 4.14 Bandeja de mensajes de contacto: listar con ?estado=P|R y marcar respondido con el empleado que atendió.
export async function list(req, res) {
  const { page, limit, skip } = pagination(req.query);
  if (req.query.estado && !['P', 'R'].includes(req.query.estado)) throw new ApiError(400, 'estado debe ser P o R.');
  const where = req.query.estado ? { estado: req.query.estado } : {};
  const [rows, total, pendientes] = await Promise.all([repo.list(where, skip, limit), repo.count(where), repo.count({ estado: 'P' })]);
  res.json({ ...pageResult(rows.map(dto), page, limit, total), pendientes });
}
export async function answered(req, res) {
  const m = await repo.find(Number(req.params.id));
  if (!m) throw new ApiError(404, 'No se encontró el mensaje.');
  if (m.estado === 'R') throw new ApiError(409, 'El mensaje ya está marcado como respondido.');
  res.json(dto(await repo.markAnswered(m.id, req.user.empleadoId)));
}
