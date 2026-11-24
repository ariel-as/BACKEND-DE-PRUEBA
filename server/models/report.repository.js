import { prisma } from '../config/prisma.js';

// Consultas agregadas de los reportes (4.16). Las fechas de los TIMESTAMP se pasan al día local de Ecuador (UTC−5).
// desde y hasta llegan validados como 'AAAA-MM-DD'.
export const reportRepository = {
  gym: () => prisma.gimnasio.findFirst({ select: { aforoMax: true } }),

  // Clientes: inscripciones activas con sus integrantes y las vencidas en el rango.
  enrollmentsWithMembers: (where) => prisma.inscripcion.findMany({ where, include: { membresiaIdRef1: { select: { nombre: true, tipo: true } }, inscripcionClientes: { include: { clienteIdRef1: { select: { nombre: true, apellido: true, telefono: true, correo: true } } } } }, orderBy: [{ fechaFin: 'asc' }, { id: 'asc' }] }),

  // Entradas del rango para calcular por día, por hora y el pico de personas adentro.
  entries: (desde, hasta) => prisma.asistenciaCliente.findMany({ where: { fecha: { gte: new Date(`${desde}T12:00:00-05:00`), lte: new Date(`${hasta}T12:00:00-05:00`) } }, select: { fecha: true, horaIngreso: true, horaSalida: true, claseId: true }, orderBy: [{ fecha: 'asc' }, { horaIngreso: 'asc' }] }),

  salesByDay: (desde, hasta) => prisma.$queryRaw`
    SELECT to_char((v.ven_fecha - interval '5 hours')::date, 'YYYY-MM-DD') AS fecha, v.ven_canal AS canal,
           COUNT(*)::int AS ventas, SUM(v.ven_subtotal - v.ven_descuento) AS neto, SUM(v.ven_total) AS total
    FROM venta v
    WHERE v.ven_estado = 'C' AND (v.ven_fecha - interval '5 hours')::date BETWEEN ${desde}::date AND ${hasta}::date
    GROUP BY 1, 2 ORDER BY 1, 2`,

  // Líneas vendidas por producto y canal: cantidad, neto sin IVA, costo (costo promedio al vender) y total con IVA.
  salesByProduct: (desde, hasta) => prisma.$queryRaw`
    SELECT d.prd_codigo AS "productoId", p.prd_nombre AS nombre, v.ven_canal AS canal,
           SUM(d.dve_cantidad)::int AS cantidad,
           SUM(ROUND(d.dve_precio_unit * d.dve_cantidad, 2) - d.dve_descuento) AS neto,
           SUM(ROUND(d.dve_costo_unit * d.dve_cantidad, 2)) AS costo,
           SUM(ROUND((ROUND(d.dve_precio_unit * d.dve_cantidad, 2) - d.dve_descuento) * (1 + d.dve_porcentaje_iva / 100), 2)) AS total
    FROM detalle_venta d JOIN venta v ON v.ven_numero = d.ven_numero JOIN producto p ON p.prd_codigo = d.prd_codigo
    WHERE v.ven_estado = 'C' AND (v.ven_fecha - interval '5 hours')::date BETWEEN ${desde}::date AND ${hasta}::date
    GROUP BY 1, 2, 3 ORDER BY 2, 3`,

  inventory: () => prisma.producto.findMany({ where: { estado: 'A' }, select: { id: true, nombre: true, esContable: true, stock: true, stockMin: true, costoPromedio: true, precioVenta: true, controlaCaducidad: true, metodoSalida: true, diasAlertaCad: true, categoriaId: true, categoria: { select: { descripcion: true } } }, orderBy: { nombre: 'asc' } }),
  lotsWithExpiry: () => prisma.loteProducto.findMany({ where: { estado: 'D', cantidadDisponible: { gt: 0 }, fechaCaducidad: { not: null } }, include: { producto: { select: { nombre: true, diasAlertaCad: true, controlaCaducidad: true, metodoSalida: true, categoriaId: true } } }, orderBy: { fechaCaducidad: 'asc' } }),
  kardex: (productoId) => prisma.kardex.findMany({ where: { loteProductoIdRef1: { productoId } }, include: { tipoMovimientoIdRef1: { select: { descripcion: true, tipo: true } } }, orderBy: { id: 'asc' } }),

  // Ingresos por inscripciones: pagos vigentes del rango agrupados por plan.
  enrollmentIncome: (desde, hasta) => prisma.$queryRaw`
    SELECT m.mem_codigo AS "membresiaId", m.mem_nombre AS plan, m.mem_tipo AS tipo,
           COUNT(DISTINCT i.ins_numero)::int AS inscripciones, SUM(pg.pag_monto) AS monto,
           SUM(CASE WHEN pg.mpg_codigo = 'EF' THEN pg.pag_monto ELSE 0 END) AS efectivo,
           SUM(CASE WHEN pg.mpg_codigo = 'TR' THEN pg.pag_monto ELSE 0 END) AS transferencia
    FROM pago pg JOIN inscripcion i ON i.ins_numero = pg.ins_numero JOIN membresia m ON m.mem_codigo = i.mem_codigo
    WHERE pg.pag_estado = 'V' AND pg.pag_fecha BETWEEN ${desde}::date AND ${hasta}::date
    GROUP BY 1, 2, 3 ORDER BY 5 DESC`,

  shifts: (desde, hasta) => prisma.cuadreTurno.findMany({ where: { fecha: { gte: new Date(`${desde}T12:00:00-05:00`), lte: new Date(`${hasta}T12:00:00-05:00`) } }, include: { turnoIdRef1: { select: { descripcion: true } }, empleadoIdRef1: { select: { nombre: true, apellido: true } } }, orderBy: [{ fecha: 'asc' }, { id: 'asc' }] }),
  closes: (desde, hasta) => prisma.cierreCaja.findMany({ where: { fechaDesde: { lte: new Date(`${hasta}T12:00:00-05:00`) }, fechaHasta: { gte: new Date(`${desde}T12:00:00-05:00`) } }, include: { _count: { select: { cuadreTurnos: true } } }, orderBy: { fechaDesde: 'asc' } }),

  commissions: (desde, hasta) => prisma.comisionAliado.findMany({ where: { fechaCobro: { gte: new Date(`${desde}T00:00:00-05:00`), lte: new Date(`${hasta}T23:59:59-05:00`) } }, include: { profesionalAliadoIdRef1: { select: { nombre: true, apellido: true } } }, orderBy: { fechaCobro: 'asc' } })
};
