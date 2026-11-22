import { prisma } from '../config/prisma.js';

export const adminRepository = {
  summary: () => Promise.all([
    prisma.producto.count({ where: { estado: 'A' } }),
    prisma.pedido.count({ where: { estado: { in: ['P', 'R'] } } }),
    prisma.cliente.count({ where: { estado: 'A' } }),
    prisma.inscripcion.count({ where: { estado: 'P' } }),
    prisma.mensajeContacto.count({ where: { estado: 'P' } }),
    prisma.producto.findMany({ select: { stock: true, stockMin: true } })
  ]),
  findRoles: (ids) => prisma.rol.findMany({ where: { id: { in: ids } }, select: { id: true } }),
  findActiveEmployee: (id) => prisma.empleado.findFirst({ where: { id: String(id), estado: 'A', usuarioId: null } }),
  createStaff: ({ login, claveHash, roles, empleadoId }) => prisma.$transaction(async (tx) => {
    const user = await tx.usuario.create({ data: { login, claveHash, estado: 'A' } });
    for (const rolId of roles) await tx.usuarioRol.create({ data: { usuarioId: user.id, rolId, estado: 'A' } });
    await tx.empleado.update({ where: { id: empleadoId }, data: { usuarioId: user.id } });
    return user;
  }),
  updateStaffState: (id, estado) => prisma.usuario.update({ where: { id }, data: { estado } })
};
