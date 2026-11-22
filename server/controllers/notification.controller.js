import { ApiError } from '../utils/ApiError.js';
import { pagination, pageResult } from '../utils/pagination.js';
import { notificationRepository as repo } from '../models/notification.repository.js';
import { runDaily } from '../services/daily.service.js';

const TIPOS = { V: 'Membresía por vencer', P: 'Promoción', L: 'Pedido listo', K: 'Lote por caducar', S: 'Stock mínimo' };
const dto = (n) => ({ id: n.id, tipo: n.tipo, tipoNombre: TIPOS[n.tipo], mensaje: n.mensaje, fechaEnvio: n.fechaEnvio, canal: n.canal, estado: n.estado, leida: n.estado === 'L', inscripcionId: n.inscripcionId, pedidoId: n.pedidoId, promocionId: n.promocionId, productoId: n.productoId, loteProductoId: n.loteProductoId });

// 4.14 Notificaciones del usuario que pregunta (cliente o empleado). Canal S (sistema interno).
export async function list(req, res) {
  const { page, limit, skip } = pagination(req.query);
  if (!req.user.clienteId && !req.user.empleadoId) return res.json(pageResult([], page, limit, 0));
  if (req.query.estado && !['P', 'E', 'F', 'L'].includes(req.query.estado)) throw new ApiError(400, 'estado debe ser P, E, F o L.');
  const where = { ...repo.owner(req.user), ...(req.query.estado ? { estado: req.query.estado } : {}), ...(req.query.noLeidas === 'S' ? { estado: { not: 'L' } } : {}) };
  const [rows, total, noLeidas] = await Promise.all([repo.list(where, skip, limit), repo.count(where), repo.count({ ...repo.owner(req.user), estado: { not: 'L' } })]);
  res.json({ ...pageResult(rows.map(dto), page, limit, total), noLeidas });
}
export async function markRead(req, res) {
  const n = req.user.clienteId || req.user.empleadoId ? await repo.findOwned(Number(req.params.id), req.user) : null;
  if (!n) throw new ApiError(404, 'No se encontró la notificación.');
  res.json(dto(n.estado === 'L' ? n : await repo.markRead(n.id)));
}

// 4.15 Tarea diaria (sin JWT; la ruta valida X-Tarea-Token).
export async function daily(_req, res) { res.json(await runDaily()); }
