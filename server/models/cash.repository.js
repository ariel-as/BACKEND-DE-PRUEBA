import { prisma } from '../config/prisma.js';
import { shiftInclude } from '../services/cash.service.js';

export const cashRepository = {
  listShifts: (where, skip, take) => prisma.cuadreTurno.findMany({ where, include: { turnoIdRef1: true, empleadoIdRef1: { select: { nombre: true, apellido: true } } }, orderBy: [{ fecha: 'desc' }, { id: 'desc' }], skip, take }),
  countShifts: (where) => prisma.cuadreTurno.count({ where }),
  findShift: (id) => prisma.cuadreTurno.findUnique({ where: { id }, include: shiftInclude }),
  listCloses: (skip, take) => prisma.cierreCaja.findMany({ include: { _count: { select: { cuadreTurnos: true } } }, orderBy: { fechaDesde: 'desc' }, skip, take }),
  countCloses: () => prisma.cierreCaja.count()
};
