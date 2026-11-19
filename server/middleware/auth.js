import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const verifyToken = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.get('Authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Se requiere un token Bearer válido.');
  let claims;
  try { claims = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], issuer: 'planeta-fitness-api' }); } catch { throw new ApiError(401, 'El token es inválido o ha expirado.'); }
  const user = await prisma.usuario.findUnique({ where: { id: Number(claims.sub) }, include: { rolesAsignados: { where: { estado: 'A' }, include: { rol: true } }, cliente: true, empleado: true } });
  if (!user || user.estado !== 'A') throw new ApiError(401, 'La cuenta está inactiva o no existe.');
  const roles = user.rolesAsignados.map((r) => r.rol.id);
  if (!roles.length) throw new ApiError(403, 'La cuenta no tiene roles activos.');
  req.user = { id: user.id, login: user.login, roles, rol: user.rolesAsignados.some((r) => r.rol.tipo === 'A') ? 'admin' : 'user', clienteId: user.cliente?.cedula ?? null, empleadoId: user.empleado?.cedula ?? null, nombre: user.cliente ? `${user.cliente.nombre} ${user.cliente.apellido}` : user.empleado ? `${user.empleado.nombre} ${user.empleado.apellido}` : user.login };
  next();
});
export const allowRoles = (...roles) => (req, _res, next) => roles.includes(req.user?.rol) ? next() : next(new ApiError(403, 'Tu cuenta no tiene permiso para realizar esta acción.'));
export const allowCodes = (...codes) => (req, _res, next) => req.user?.roles?.some((r) => codes.includes(r)) ? next() : next(new ApiError(403, 'Tu cuenta no tiene permiso para realizar esta acción.'));
