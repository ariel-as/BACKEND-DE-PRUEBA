import { prisma } from '../config/prisma.js';

export const gymRepository = {
  find: () => prisma.gimnasio.findFirst(),
  update: (id, data) => prisma.gimnasio.update({ where: { id }, data }),
  schedule: () => prisma.horarioAtencion.findMany({ orderBy: { id: 'asc' } }),
  // Reemplaza el horario de atención completo en una transacción.
  replaceSchedule: (gimnasioId, dias) => prisma.$transaction(async (tx) => {
    await tx.horarioAtencion.deleteMany({ where: { gimnasioId } });
    for (const d of dias) await tx.horarioAtencion.create({ data: { gimnasioId, ...d } });
    return tx.horarioAtencion.findMany({ orderBy: { id: 'asc' } });
  })
};
