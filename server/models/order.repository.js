import { prisma } from '../config/prisma.js';

const include = { detalles: { include: { producto: true } }, usuario: true, ventas: { select: { id: true, estado: true } } };
export const orderRepository = {
  include,
  list: (where, skip, take) => prisma.pedido.findMany({ where, include, orderBy: { fechaCreacion: 'desc' }, skip, take }),
  count: (where) => prisma.pedido.count({ where }),
  findById: (id) => prisma.pedido.findUnique({ where: { id }, include })
};
