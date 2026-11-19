import { prisma } from '../config/prisma.js';
export const productRepository = {
  list: (skip, take, categoriaId) => prisma.producto.findMany({ where: { estado: 'A', publicarWeb: 'S', ...(categoriaId ? { categoriaId } : {}) }, include: { categoria: true }, orderBy: { nombre: 'asc' }, skip, take }),
  count: (categoriaId) => prisma.producto.count({ where: { estado: 'A', publicarWeb: 'S', ...(categoriaId ? { categoriaId } : {}) } }),
  findPublished: (id) => prisma.producto.findFirst({ where: { id, estado: 'A', publicarWeb: 'S' }, include: { categoria: true } })
};
