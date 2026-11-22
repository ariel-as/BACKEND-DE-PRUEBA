import { prisma } from '../config/prisma.js';

export const inventoryRepository = {
  product: (id) => prisma.producto.findUnique({ where: { id }, include: { loteProductos: { select: { cantidadDisponible: true } } } }),
  lots: (where, skip, take) => prisma.loteProducto.findMany({ where, include: { producto: { select: { nombre: true, diasAlertaCad: true } } }, orderBy: [{ fechaCaducidad: 'asc' }, { id: 'asc' }], skip, take }),
  countLots: (where) => prisma.loteProducto.count({ where }),
  kardex: (productoId, skip, take) => prisma.kardex.findMany({ where: { loteProductoIdRef1: { productoId } }, include: { tipoMovimientoIdRef1: { select: { descripcion: true, tipo: true } } }, orderBy: { id: 'asc' }, skip, take }),
  countKardex: (productoId) => prisma.kardex.count({ where: { loteProductoIdRef1: { productoId } } }),
  suppliers: (productoId) => prisma.productoProveedor.findMany({ where: { productoId }, include: { proveedorIdRef1: true }, orderBy: { proveedorId: 'asc' } }),
  findSuppliers: (ids) => prisma.proveedor.findMany({ where: { id: { in: ids } }, select: { id: true } }),
  // Reemplaza la lista de proveedores del producto.
  replaceSuppliers: (productoId, ids) => prisma.$transaction(async (tx) => {
    await tx.productoProveedor.deleteMany({ where: { productoId, proveedorId: { notIn: ids } } });
    for (const proveedorId of ids) await tx.productoProveedor.upsert({ where: { productoId_proveedorId: { productoId, proveedorId } }, create: { productoId, proveedorId }, update: {} });
  })
};
