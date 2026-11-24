import { prisma } from '../config/prisma.js';

const include = {
  servicioIdRef1: { select: { id: true, nombre: true } },
  empleadoIdRef1: { select: { id: true, nombre: true, apellido: true, especialidad: true, estado: true } },
  claseHorarios: { where: { estado: 'A' }, include: { horarioIdRef1: true }, orderBy: { horarioId: 'asc' } }
};

export const classRepository = {
  list: (where, skip, take) => prisma.clase.findMany({ where, include, orderBy: { id: 'asc' }, skip, take }),
  count: (where) => prisma.clase.count({ where }),
  find: (id) => prisma.clase.findUnique({ where: { id }, include }),
  replaceSchedules: (claseId, horarios) => prisma.$transaction(async (tx) => {
    await tx.claseHorario.deleteMany({ where: { claseId } });
    await tx.claseHorario.createMany({ data: horarios.map((horarioId) => ({ claseId, horarioId, estado: 'A' })) });
    return tx.claseHorario.findMany({ where: { claseId }, include: { horarioIdRef1: true }, orderBy: { horarioId: 'asc' } });
  })
};
