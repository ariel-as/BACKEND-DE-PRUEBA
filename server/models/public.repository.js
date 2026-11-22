import { prisma } from '../config/prisma.js';

export const publicRepository = {
  categories: () => prisma.categoria.findMany({ orderBy: { descripcion: 'asc' } }),
  paymentMethods: () => prisma.metodoPago.findMany({ orderBy: { descripcion: 'asc' } }),
  levels: () => prisma.nivel.findMany({ orderBy: { descripcion: 'asc' } })
};
