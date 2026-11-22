import { prisma } from '../config/prisma.js';

const include = { rolesAsignados: { include: { rol: true } }, empleado: true, cliente: true };
const like = (buscar) => ({ contains: buscar, mode: 'insensitive' });
const search = (buscar) => (buscar ? { OR: [{ login: like(buscar) }, { empleado: { is: { OR: [{ nombre: like(buscar) }, { apellido: like(buscar) }] } } }, { cliente: { is: { OR: [{ nombre: like(buscar) }, { apellido: like(buscar) }] } } }] } : {});
export const securityRepository = {
  listUsers: (buscar, skip, take) => prisma.usuario.findMany({ where: search(buscar), include, orderBy: { id: 'asc' }, skip, take }),
  countUsers: (buscar) => prisma.usuario.count({ where: search(buscar) }),
  findUser: (id) => prisma.usuario.findUnique({ where: { id }, include }),
  findByLogin: (login) => prisma.usuario.findUnique({ where: { login } }),
  updateUser: (id, data) => prisma.usuario.update({ where: { id }, data, include }),
  findRoles: (ids) => prisma.rol.findMany({ where: { id: { in: ids } }, select: { id: true } }),
  findActiveEmployee: (id) => prisma.empleado.findFirst({ where: { id: String(id), estado: 'A', usuarioId: null } }),
  createStaff: ({ login, claveHash, roles, empleadoId }) => prisma.$transaction(async (tx) => {
    const user = await tx.usuario.create({ data: { login, claveHash, estado: 'A' } });
    for (const rolId of roles) await tx.usuarioRol.create({ data: { usuarioId: user.id, rolId, estado: 'A' } });
    await tx.empleado.update({ where: { id: empleadoId }, data: { usuarioId: user.id } });
    return user;
  }),
  // Reemplaza los roles activos: los que salen pasan a I (no se borran) y los que entran quedan en A.
  replaceRoles: (usuarioId, roles) => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT usr_codigo FROM usuario WHERE usr_codigo = ${usuarioId} FOR UPDATE`;
    await tx.usuarioRol.updateMany({ where: { usuarioId, rolId: { notIn: roles }, estado: 'A' }, data: { estado: 'I' } });
    for (const rolId of roles) await tx.usuarioRol.upsert({ where: { usuarioId_rolId: { usuarioId, rolId } }, create: { usuarioId, rolId, estado: 'A' }, update: { estado: 'A' } });
    return tx.usuario.findUnique({ where: { id: usuarioId }, include });
  })
};
