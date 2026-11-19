import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const dummyHash = '$2b$12$abcdefghijklmnopqrstuuKzmVvR6L3M/3tp1hYJQnUGv4wzYz8O';
const profile = (u) => ({ id: u.id, login: u.login, roles: u.rolesAsignados.map((x) => x.rolId), rol: u.rolesAsignados.some((x) => x.rolId === 'ADM') ? 'admin' : u.rolesAsignados.some((x) => x.rolId !== 'CLI') ? 'staff' : 'user', nombre: u.cliente ? `${u.cliente.nombre} ${u.cliente.apellido}` : u.empleado ? `${u.empleado.nombre} ${u.empleado.apellido}` : u.login, clienteId: u.cliente?.id ?? null, empleadoId: u.empleado?.id ?? null });
async function loadUser(id) { return prisma.usuario.findUnique({ where: { id }, include: { rolesAsignados: { where: { estado: 'A' }, include: { rol: true } }, cliente: true, empleado: true } }); }
export function session(user) {
  const usuario = profile(user), token = jwt.sign({ login: usuario.login, rol: usuario.rol, roles: usuario.roles }, env.jwtSecret, { algorithm: 'HS256', issuer: 'planeta-fitness-api', subject: String(usuario.id), expiresIn: env.jwtExpiresIn });
  return { token, tipo: 'Bearer', expiraEn: env.jwtExpiresIn, usuario };
}
export async function login(correo, contrasena) {
  const user = await prisma.usuario.findUnique({ where: { login: String(correo).toLowerCase() } });
  const valid = await bcrypt.compare(contrasena, user?.claveHash || dummyHash);
  if (!user || !valid || user.estado !== 'A') throw new ApiError(401, 'Correo o contraseña incorrectos.');
  await prisma.usuario.update({ where: { id: user.id }, data: { ultimoAcceso: new Date() } });
  const loaded = await loadUser(user.id);
  if (!loaded?.rolesAsignados.length) throw new ApiError(401, 'Correo o contraseña incorrectos.');
  return session(loaded);
}
export async function register(data) {
  if (data.cedula === '9999999999') throw new ApiError(400, 'La cédula de consumidor final no se puede registrar.');
  const loginName = String(data.correo).toLowerCase();
  const sessionUser = await prisma.$transaction(async (tx) => {
    if(!await tx.nivel.findUnique({where:{id:data.nivelId}}))throw new ApiError(400,'Selecciona un nivel de entrenamiento válido.');
    const existing = await tx.cliente.findUnique({ where: { id: data.cedula } });
    if (existing && (existing.usuarioId || existing.correo?.toLowerCase() !== loginName)) throw new ApiError(409, 'Esa cédula ya está registrada en el gimnasio. Acércate a recepción para activar tu cuenta web.');
    const hash = await bcrypt.hash(data.contrasena, env.bcryptRounds);
    const user = await tx.usuario.create({ data: { login: loginName, claveHash: hash, estado: 'A' } });
    await tx.usuarioRol.create({ data: { usuarioId: user.id, rolId: 'CLI', estado: 'A' } });
    if (existing) await tx.cliente.update({ where: { id: existing.id }, data: { usuarioId: user.id } });
    else await tx.cliente.create({ data: { id: data.cedula, nombre: data.nombre, apellido: data.apellido, correo: loginName, telefono: data.telefono, nivelId: data.nivelId, usuarioId: user.id, esEstudiante: 'N', estado: 'A' } });
    return user.id;
  });
  return session(await loadUser(sessionUser));
}
