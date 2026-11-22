import { prisma } from '../config/prisma.js';

const include = {
  proveedorIdRef1: { select: { id: true, nombre: true } },
  empleadoIdRef1: { select: { nombre: true, apellido: true } },
  empAutorizaIdRef2: { select: { nombre: true, apellido: true } },
  productoOrdenCompras: { include: { producto: { select: { nombre: true } }, loteProductos: { select: { id: true, cantidadInicial: true, fechaIngreso: true, fechaCaducidad: true, costoUnit: true } } } }
};
export const purchaseRepository = {
  list: (where, skip, take) => prisma.ordenCompra.findMany({ where, include: { proveedorIdRef1: { select: { nombre: true } }, _count: { select: { productoOrdenCompras: true } } }, orderBy: { id: 'desc' }, skip, take }),
  count: (where) => prisma.ordenCompra.count({ where }),
  detail: (id) => prisma.ordenCompra.findUnique({ where: { id }, include })
};
