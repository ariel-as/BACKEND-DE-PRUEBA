import { prisma } from '../config/prisma.js';

const include = { inscripcionIdclienteIdRef1: { include: { clienteIdRef1: { select: { nombre: true, apellido: true } }, inscripcionIdRef1: { include: { membresiaIdRef1: { select: { nombre: true } } } } } }, claseIdhorarioIdRef1: { include: { claseIdRef1: { select: { nombre: true } } } } };
export const entryRepository = {
  list: (where, skip, take) => prisma.asistenciaCliente.findMany({ where, include, orderBy: { id: 'desc' }, skip, take }),
  count: (where) => prisma.asistenciaCliente.count({ where })
};
