import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { securityRepository as repo } from '../models/security.repository.js';

const PASSWORD = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
export const userDto = (u) => ({ id: u.id, login: u.login, estado: u.estado, ultimoAcceso: u.ultimoAcceso, fechaCreacion: u.fechaCreacion, roles: u.rolesAsignados.filter((r) => r.estado === 'A').map((r) => r.rolId), rolesInactivos: u.rolesAsignados.filter((r) => r.estado === 'I').map((r) => r.rolId), empleado: u.empleado ? { id: u.empleado.id, nombre: `${u.empleado.nombre} ${u.empleado.apellido}`, cargoId: u.empleado.cargoId, estado: u.empleado.estado } : null, cliente: u.cliente ? { id: u.cliente.id, nombre: `${u.cliente.nombre} ${u.cliente.apellido}` } : null });

export async function createStaff(body) {
  if (Object.keys(body).some((k) => !['login', 'password', 'contrasena', 'roles', 'empleadoId'].includes(k))) throw new ApiError(400, 'El cuerpo contiene campos no permitidos.');
  const { login, password, contrasena, roles, empleadoId } = body, secret = password || contrasena;
  if (typeof login !== 'string' || !/^\S+@\S+\.\S+$/.test(login) || !secret || !Array.isArray(roles) || !roles.length || !empleadoId) throw new ApiError(400, 'Completa un correo válido, contraseña, roles y empleado.');
  if (!PASSWORD.test(secret)) throw new ApiError(400, 'La contraseña debe tener de 8 a 72 caracteres, letras y números.');
  const codigos = [...new Set(roles)];
  if (codigos.some((r) => typeof r !== 'string' || r === 'CLI')) throw new ApiError(400, 'Los roles indicados no son válidos.');
  const [validos, empleado] = await Promise.all([repo.findRoles(codigos), repo.findActiveEmployee(empleadoId)]);
  if (validos.length !== codigos.length || !empleado) throw new ApiError(409, 'El empleado no existe, está inactivo o ya tiene una cuenta.');
  const u = await repo.createStaff({ login: String(login).toLowerCase(), claveHash: await bcrypt.hash(secret, env.bcryptRounds), roles: codigos, empleadoId: empleado.id });
  return { id: u.id, login: u.login, roles: codigos };
}
export async function setStaffState(actor, id, estado) {
  if (id === actor.id) throw new ApiError(400, 'No puedes desactivar tu propia cuenta.');
  if (!await repo.findUser(id)) throw new ApiError(404, 'No se encontró la cuenta.');
  const u = await repo.updateUser(id, { estado });
  return { id: u.id, login: u.login, estado: u.estado };
}
// Cambiar el correo y/o restablecer la contraseña de una cuenta.
export async function updateAccount(id, { correo, contrasena }) {
  const user = await repo.findUser(id);
  if (!user) throw new ApiError(404, 'No se encontró la cuenta.');
  if (!correo && !contrasena) throw new ApiError(400, 'Indica el nuevo correo o la nueva contraseña.');
  const data = {};
  if (correo) { const login = correo.toLowerCase(); const other = await repo.findByLogin(login); if (other && other.id !== id) throw new ApiError(409, 'Ese correo ya pertenece a otra cuenta.'); data.login = login; }
  if (contrasena) { if (!PASSWORD.test(contrasena)) throw new ApiError(400, 'La contraseña debe tener de 8 a 72 caracteres, letras y números.'); data.claveHash = await bcrypt.hash(contrasena, env.bcryptRounds); }
  return userDto(await repo.updateUser(id, data));
}
export async function replaceRoles(actor, id, roles) {
  const codigos = [...new Set(roles)];
  if (!codigos.length) throw new ApiError(409, 'La cuenta debe conservar al menos un rol activo.');
  const user = await repo.findUser(id);
  if (!user) throw new ApiError(404, 'No se encontró la cuenta.');
  if (id === actor.id && !codigos.includes('ADM')) throw new ApiError(409, 'No puedes quitarte el rol de administrador a ti mismo.');
  const validos = await repo.findRoles(codigos);
  if (validos.length !== codigos.length) throw new ApiError(400, 'Uno o más roles no existen.');
  if (codigos.includes('CLI') && !user.cliente) throw new ApiError(409, 'El rol de cliente web requiere una cuenta vinculada a un cliente.');
  if (codigos.some((r) => r !== 'CLI') && !user.empleado) throw new ApiError(409, 'Los roles de personal requieren una cuenta vinculada a un empleado.');
  return userDto(await repo.replaceRoles(id, codigos));
}
