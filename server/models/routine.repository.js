import { prisma } from '../config/prisma.js';

const include = { clienteIdRef1: { select: { nombre: true, apellido: true } }, empleadoIdRef1: { select: { nombre: true, apellido: true } }, nivelIdRef1: { select: { descripcion: true } } };
export const routineRepository = {
  list: (where, skip, take) => prisma.rutina.findMany({ where, include, orderBy: { id: 'desc' }, skip, take }),
  count: (where) => prisma.rutina.count({ where }),
  find: (where) => prisma.rutina.findFirst({ where, include }),
  // Rutina vigente del cliente: la más reciente que ya empezó y no terminó.
  current: (clienteId, hoy) => prisma.rutina.findFirst({ where: { clienteId, fechaInicio: { lte: hoy }, OR: [{ fechaFin: null }, { fechaFin: { gte: hoy } }] }, include, orderBy: [{ fechaInicio: 'desc' }, { id: 'desc' }] })
};
