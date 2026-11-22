import { prisma } from '../config/prisma.js';

const like = (s) => ({ contains: s, mode: 'insensitive' });
const search = (buscar) => (buscar ? { OR: [{ id: { startsWith: buscar } }, { nombre: like(buscar) }, { apellido: like(buscar) }] } : {});
export const clientRepository = {
  list: (buscar, skip, take) => prisma.cliente.findMany({ where: search(buscar), include: { nivelIdRef1: true }, orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }], skip, take }),
  count: (buscar) => prisma.cliente.count({ where: search(buscar) }),
  find: (id) => prisma.cliente.findUnique({ where: { id }, include: { nivelIdRef1: true } }),
  findLevel: (id) => prisma.nivel.findUnique({ where: { id } }),
  create: (data) => prisma.cliente.create({ data, include: { nivelIdRef1: true } }),
  update: (id, data) => prisma.cliente.update({ where: { id }, data, include: { nivelIdRef1: true } }),
  // Historial completo del cliente en una sola consulta por bloque.
  history: async (id) => {
    const cliente = await prisma.cliente.findUnique({ where: { id }, include: { nivelIdRef1: true } });
    if (!cliente) return null;
    const [inscripciones, entradas, ventas, pedidos, facturas] = await Promise.all([
      prisma.inscripcion.findMany({ where: { inscripcionClientes: { some: { clienteId: id } } }, include: { membresiaIdRef1: true, inscripcionClientes: { include: { clienteIdRef1: { select: { nombre: true, apellido: true } } } }, pagos: true }, orderBy: { id: 'desc' } }),
      prisma.asistenciaCliente.findMany({ where: { clienteId: id }, orderBy: [{ fecha: 'desc' }, { id: 'desc' }], take: 30 }),
      prisma.venta.findMany({ where: { clienteId: id }, include: { detalleVentas: true, pagos: true }, orderBy: { id: 'desc' } }),
      cliente.usuarioId ? prisma.pedido.findMany({ where: { usuarioId: cliente.usuarioId }, include: { detalles: true }, orderBy: { id: 'desc' } }) : [],
      prisma.factura.findMany({ where: { clienteId: id }, orderBy: { id: 'desc' } })
    ]);
    return { cliente, inscripciones, entradas, ventas, pedidos, facturas };
  }
};
