import { prisma } from '../config/prisma.js';
import { todayDate } from '../utils/dates.js';

export const adminRepository = {
  summary: async (empleadoId) => {
    const today = todayDate();
    const [productosActivos, pedidosPendientes, clientesActivos, inscripcionesPendientes, mensajesPendientes, low, personasAdentro, ventasSinFactura, inscripcionesSinFactura, misRutinas] = await Promise.all([
      prisma.producto.count({ where: { estado: 'A' } }),
      prisma.pedido.count({ where: { estado: { in: ['P', 'R'] } } }),
      prisma.cliente.count({ where: { estado: 'A' } }),
      prisma.inscripcion.count({ where: { estado: 'P' } }),
      prisma.mensajeContacto.count({ where: { estado: 'P' } }),
      prisma.producto.findMany({ where: { estado: 'A' }, select: { stock: true, stockMin: true } }),
      prisma.asistenciaCliente.count({ where: { fecha: today, horaSalida: null } }),
      prisma.venta.count({ where: { estado: 'C', facturas: null } }),
      prisma.inscripcion.count({ where: { estado: { in: ['A', 'S', 'V'] }, facturas: null } }),
      empleadoId ? prisma.rutina.count({ where: { empleadoId } }) : 0
    ]);
    return { productosActivos, pedidosPendientes, clientesActivos, inscripcionesPendientes, mensajesPendientes, bajoStock: low.filter((p) => p.stock <= p.stockMin).length, personasAdentro, facturasPendientes: ventasSinFactura + inscripcionesSinFactura, misRutinas };
  }
};
