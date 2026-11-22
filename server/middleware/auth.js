import jwt from 'jsonwebtoken';
import { timingSafeEqual, createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { userRepository } from '../models/user.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { permisosDe, hasPermission } from '../config/permisos.js';

export const verifyToken = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.get('Authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Se requiere un token Bearer válido.');
  let claims;
  try { claims = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], issuer: 'planeta-fitness-api' }); } catch { throw new ApiError(401, 'El token es inválido o ha expirado.'); }
  const userId = Number(claims.sub);
  if (!Number.isInteger(userId) || userId < 1) throw new ApiError(401, 'El token es inválido o ha expirado.');
  const user = await userRepository.findSessionUser(userId);
  if (!user || user.estado !== 'A') throw new ApiError(401, 'La cuenta está inactiva o no existe.');
  const roles = user.rolesAsignados.map((r) => r.rol.id);
  if (!roles.length) throw new ApiError(403, 'La cuenta no tiene roles activos.');
  req.user = { id: user.id, login: user.login, roles, rol: roles.includes('ADM') ? 'admin' : roles.some((r) => r !== 'CLI') ? 'staff' : 'user', clienteId: user.cliente?.id ?? null, empleadoId: user.empleado?.id ?? null, empleadoActivo: user.empleado?.estado === 'A', nombre: user.cliente ? `${user.cliente.nombre} ${user.cliente.apellido}` : user.empleado ? `${user.empleado.nombre} ${user.empleado.apellido}` : user.login, permisos: permisosDe(roles) };
  next();
});
const denied = () => new ApiError(403, 'Tu cuenta no tiene permiso para realizar esta acción.');
export const allowRoles = (...roles) => (req, _res, next) => roles.includes(req.user?.rol) ? next() : next(denied());
export const allowCodes = (...codes) => (req, _res, next) => req.user?.roles?.some((r) => codes.includes(r)) ? next() : next(denied());
// Permite el paso si el usuario tiene alguno de los permisos 'grupo:accion' (ADM siempre pasa).
export const permitir = (...perms) => (req, _res, next) => hasPermission(req.user, ...perms) ? next() : next(denied());
// Las operaciones del modelo con emp_cedula exigen una cuenta vinculada a un empleado.
export const requireEmployee = (req, _res, next) => req.user?.empleadoId ? next() : next(new ApiError(403, 'Tu cuenta debe estar vinculada a un empleado para registrar esta operación'));
// "Solo ADM" del diccionario: empleado activo con cuenta activa y rol ADM activo.
export const requireActiveAdmin = (req, _res, next) => req.user?.roles?.includes('ADM') && req.user.empleadoId && req.user.empleadoActivo ? next() : next(new ApiError(403, 'Esta operación la autoriza un administrador activo vinculado a un empleado.'));
// Tarea diaria: sin JWT, con la cabecera X-Tarea-Token comparada con TAREAS_TOKEN en tiempo constante.
const digest = (s) => createHash('sha256').update(String(s)).digest();
export const requireTaskToken = (req, _res, next) => {
  if (!env.tareasToken) return next(new ApiError(503, 'La tarea diaria no está configurada en el servidor (falta TAREAS_TOKEN).'));
  const sent = req.get('X-Tarea-Token');
  if (!sent || !timingSafeEqual(digest(sent), digest(env.tareasToken))) return next(new ApiError(401, 'El token de la tarea diaria no es válido.'));
  next();
};
