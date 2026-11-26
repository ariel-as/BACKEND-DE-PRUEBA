import { prisma } from '../config/prisma.js';
const published = (categoriaId) => ({ estado: 'A', publicarWeb: 'S', ...(categoriaId ? { categoriaId } : {}) });
const fotos = { imagenes: { orderBy: { id: 'asc' } } };
export const productRepository = {
  list: (skip, take, categoriaId) => prisma.producto.findMany({ where: published(categoriaId), include: { categoria: true, ...fotos }, orderBy: { nombre: 'asc' }, skip, take }),
  count: (categoriaId) => prisma.producto.count({ where: published(categoriaId) }),
  findPublished: (id) => prisma.producto.findFirst({ where: { id, estado: 'A', publicarWeb: 'S' }, include: { categoria: true, ...fotos } }),
  adminList: (where, skip, take) => prisma.producto.findMany({ where, include: { categoria: true, ...fotos }, orderBy: { nombre: 'asc' }, skip, take }),
  findById: (id) => prisma.producto.findUnique({ where: { id }, include: { categoria: true, ...fotos } }),
  adminCount: (where) => prisma.producto.count({ where }),
  gym: () => prisma.gimnasio.findFirst(),
  listFotos: (productoId) => prisma.imagen.findMany({ where: { productoId }, orderBy: { id: 'asc' } }),
  findFoto: (id) => prisma.imagen.findUnique({ where: { id } }),
  createFoto: (productoId, fotoUrl) => prisma.imagen.create({ data: { productoId, fotoUrl } }),
  deleteFoto: (id) => prisma.imagen.delete({ where: { id } })
};
