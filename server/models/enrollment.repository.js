import { prisma } from '../config/prisma.js';

const listInclude = { membresiaIdRef1: true, inscripcionClientes: { where: { esTitular: 'S' }, include: { clienteIdRef1: { select: { nombre: true, apellido: true } } } } };
const detailInclude = {
  membresiaIdRef1: true, promocionIdRef1: true,
  inscripcionClientes: { include: { clienteIdRef1: { select: { nombre: true, apellido: true } }, asistenciaClientes: { orderBy: { id: 'desc' } } } },
  pagos: { orderBy: { id: 'asc' } }, suspensions: { orderBy: { id: 'asc' } }, facturas: true
};
export const enrollmentRepository = {
  list: (where, skip, take) => prisma.inscripcion.findMany({ where, include: listInclude, orderBy: { id: 'desc' }, skip, take }),
  count: (where) => prisma.inscripcion.count({ where }),
  detail: (id) => prisma.inscripcion.findUnique({ where: { id }, include: detailInclude })
};
