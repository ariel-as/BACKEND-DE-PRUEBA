import { prisma } from '../config/prisma.js';

// Bandeja de mensajes de contacto (4.14).
export const messageRepository = {
  list: (where, skip, take) => prisma.mensajeContacto.findMany({ where, include: { empleadoIdRef1: { select: { nombre: true, apellido: true } } }, orderBy: [{ estado: 'asc' }, { id: 'desc' }], skip, take }),
  count: (where) => prisma.mensajeContacto.count({ where }),
  find: (id) => prisma.mensajeContacto.findUnique({ where: { id } }),
  markAnswered: (id, empleadoId) => prisma.mensajeContacto.update({ where: { id }, data: { estado: 'R', empleadoId }, include: { empleadoIdRef1: { select: { nombre: true, apellido: true } } } })
};
