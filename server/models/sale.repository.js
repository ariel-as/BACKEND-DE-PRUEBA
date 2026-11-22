import { prisma } from '../config/prisma.js';

const saleInclude = { clienteIdRef1: { select: { nombre: true, apellido: true } }, detalleVentas: { include: { producto: { select: { nombre: true } } } }, pagos: true, facturas: true, kardexs: { orderBy: { id: 'asc' } } };
const invoiceInclude = { clienteIdRef1: { select: { nombre: true, apellido: true, ruc: true } }, ventaIdRef1: { select: { id: true, estado: true, total: true } }, inscripcionIdRef1: { select: { id: true, estado: true, membresiaId: true } } };
export const saleRepository = {
  listSales: (where, skip, take) => prisma.venta.findMany({ where, include: { clienteIdRef1: { select: { nombre: true, apellido: true } } }, orderBy: { id: 'desc' }, skip, take }),
  countSales: (where) => prisma.venta.count({ where }),
  findSale: (id) => prisma.venta.findUnique({ where: { id }, include: saleInclude }),
  listInvoices: (where, skip, take) => prisma.factura.findMany({ where, include: invoiceInclude, orderBy: { id: 'desc' }, skip, take }),
  countInvoices: (where) => prisma.factura.count({ where }),
  findInvoice: (id) => prisma.factura.findUnique({ where: { id }, include: invoiceInclude }),
  // Facturas emitidas en el SRI cuya venta o inscripción fue anulada.
  toAnnulWhere: { estado: 'E', OR: [{ ventaIdRef1: { is: { estado: 'X' } } }, { inscripcionIdRef1: { is: { estado: 'X' } } }] }
};
