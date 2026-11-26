import { prisma } from '../config/prisma.js';
const published = (categoriaId) => ({ estado: 'A', publicarWeb: 'S', ...(categoriaId ? { categoriaId } : {}) });
export const productRepository = {
  list: (skip, take, categoriaId) => prisma.producto.findMany({ where: published(categoriaId), include: { categoria: true }, orderBy: { nombre: 'asc' }, skip, take }),
  count: (categoriaId) => prisma.producto.count({ where: published(categoriaId) }),
  findPublished: (id) => prisma.producto.findFirst({ where: { id, estado: 'A', publicarWeb: 'S' }, include: { categoria: true } }),
  adminList: (where, skip, take) => prisma.producto.findMany({ where, include: { categoria: true }, orderBy: { nombre: 'asc' }, skip, take }),
  findById: (id) => prisma.producto.findUnique({ where: { id }, include: { categoria: true } }),
  adminCount: (where) => prisma.producto.count({ where }),
  gym: () => prisma.gimnasio.findFirst()
};
