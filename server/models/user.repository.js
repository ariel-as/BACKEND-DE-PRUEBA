import { prisma } from '../config/prisma.js';

const sessionInclude = { rolesAsignados: { where: { estado: 'A' }, include: { rol: true } }, cliente: true, empleado: true };
export const userRepository = {
  sessionInclude,
  ping: () => prisma.$queryRaw`SELECT 1`,
  findSessionUser: (id) => prisma.usuario.findUnique({ where: { id }, include: sessionInclude })
};
