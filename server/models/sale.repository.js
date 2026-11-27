import { prisma } from '../config/prisma.js';

const saleInclude = { clienteIdRef1: { select: { nombre: true, apellido: true } }, detalleVentas: { include: { producto: { select: { nombre: true } } } }, pagos: true, facturas: true, kardexs: { orderBy: { id: 'asc' } } };
const invoiceInclude = { clienteIdRef1: { select: { nombre: true, apellido: true, ruc: true } }, ventaIdRef1: { select: { id: true, estado: true, total: true } }, inscripcionIdRef1: { select: { id: true, estado: true, membresiaId: true } } };
const invoiceDetailInclude = { ...invoiceInclude, ventaIdRef1: { select: { id: true, estado: true, total: true, detalleVentas: { include: { producto: { select: { nombre: true } } }, orderBy: { productoId: 'asc' } } } }, inscripcionIdRef1: { select: { id: true, estado: true, membresiaId: true, fechaInicio: true, fechaFin: true, valor: true, descuento: true, porcentajeIva: true, membresiaIdRef1: { select: { nombre: true } } } } };
export const saleRepository = {
  listSales: (where, skip, take) => prisma.venta.findMany({ where, include: { clienteIdRef1: { select: { nombre: true, apellido: true } } }, orderBy: { id: 'desc' }, skip, take }),
  countSales: (where) => prisma.venta.count({ where }),
  findSale: (id) => prisma.venta.findUnique({ where: { id }, include: saleInclude }),
  listInvoices: (where, skip, take) => prisma.factura.findMany({ where, include: invoiceInclude, orderBy: { id: 'desc' }, skip, take }),
  countInvoices: (where) => prisma.factura.count({ where }),
  findInvoice: (id) => prisma.factura.findUnique({ where: { id }, include: invoiceDetailInclude }),
  pendingInvoices: async () => {
    const [ventas, inscripciones] = await Promise.all([
      prisma.venta.findMany({ where: { estado: 'C', facturas: null }, include: { clienteIdRef1: { select: { nombre: true, apellido: true } } }, orderBy: { id: 'desc' } }),
      prisma.inscripcion.findMany({ where: { estado: { in: ['A', 'S', 'V'] }, facturas: null }, include: { inscripcionClientes: { where: { esTitular: 'S' }, include: { clienteIdRef1: { select: { nombre: true, apellido: true } } } } }, orderBy: { id: 'desc' } })
    ]);
    return [...ventas.map((v) => ({ tipo: 'venta', numero: v.id, fecha: v.fecha, clienteId: v.clienteId, cliente: v.clienteIdRef1, total: v.total })), ...inscripciones.map((i) => ({ tipo: 'inscripcion', numero: i.id, fecha: i.fechaRegistro, clienteId: i.inscripcionClientes[0]?.clienteId, cliente: i.inscripcionClientes[0]?.clienteIdRef1, total: i.valor }))];
  },
  countPendingInvoices: async () => {
    const [ventas, inscripciones] = await Promise.all([
      prisma.venta.count({ where: { estado: 'C', facturas: null } }),
      prisma.inscripcion.count({ where: { estado: { in: ['A', 'S', 'V'] }, facturas: null } })
    ]);
    return ventas + inscripciones;
  },
  // Facturas emitidas en el SRI cuya venta o inscripción fue anulada.
  toAnnulWhere: { estado: 'E', OR: [{ ventaIdRef1: { is: { estado: 'X' } } }, { inscripcionIdRef1: { is: { estado: 'X' } } }] }
};
