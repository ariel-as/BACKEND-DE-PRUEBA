import { prisma } from '../config/prisma.js';

// Notificaciones del usuario actual: las de su ficha de cliente y las de su ficha de empleado.
const owner = ({ clienteId, empleadoId }) => ({ OR: [...(clienteId ? [{ destino: 'C', clienteId }] : []), ...(empleadoId ? [{ destino: 'E', empleadoId }] : [])] });
export const notificationRepository = {
  owner,
  list: (where, skip, take) => prisma.notificacion.findMany({ where, orderBy: { id: 'desc' }, skip, take }),
  count: (where) => prisma.notificacion.count({ where }),
  findOwned: (id, user) => prisma.notificacion.findFirst({ where: { id, ...owner(user) } }),
  markRead: (id) => prisma.notificacion.update({ where: { id }, data: { estado: 'L' } })
};
