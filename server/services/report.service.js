import { ApiError } from '../utils/ApiError.js';
import { reportRepository as repo } from '../models/report.repository.js';
import { salidaInfo } from './inventory.service.js';
import { localToday, addDays, dateStr, validDate, daysBetween } from '../utils/dates.js';
import { dec, r2, sum, num, num4 } from '../utils/money.js';

// ---- Reportes (BACKEND_FASE2 4.16). Todo se calcula en el servidor con Prisma.Decimal. ----
// Rango por defecto: los últimos 30 días hasta hoy. Máximo un año.
export function range(query, defaultDays = 30) {
  const hasta = query.hasta || localToday(), desde = query.desde || addDays(hasta, -(defaultDays - 1));
  if (!validDate(desde) || !validDate(hasta)) throw new ApiError(400, 'desde y hasta van con el formato AAAA-MM-DD.');
  if (desde > hasta) throw new ApiError(400, 'desde no puede ser posterior a hasta.');
  if (daysBetween(desde, hasta) > 366) throw new ApiError(400, 'El rango máximo de un reporte es de un año.');
  return { desde, hasta };
}
const toMin = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const day = (s) => new Date(`${s}T12:00:00-05:00`);
const miembros = (ins) => ins.inscripcionClientes.map((c) => ({ clienteId: c.clienteId, nombre: `${c.clienteIdRef1.nombre} ${c.clienteIdRef1.apellido}`, telefono: c.clienteIdRef1.telefono, correo: c.clienteIdRef1.correo, esTitular: c.esTitular === 'S' }));
const insRows = (ins) => miembros(ins).map((m) => ({ ...m, inscripcionId: ins.id, membresiaId: ins.membresiaId, plan: ins.membresiaIdRef1.nombre, fechaInicio: dateStr(ins.fechaInicio), fechaFin: dateStr(ins.fechaFin), estado: ins.estado }));
const distinct = (rows) => new Set(rows.map((r) => r.clienteId)).size;

// Clientes activos, por vencer (próximos `dias`, 7 por defecto) y vencidos en el rango.
export async function clientsReport(query) {
  const { desde, hasta } = range(query), hoy = localToday();
  const dias = query.dias === undefined ? 7 : Number(query.dias);
  if (!Number.isInteger(dias) || dias < 1 || dias > 90) throw new ApiError(400, 'dias es un entero entre 1 y 90.');
  const [activas, vencidas] = await Promise.all([
    repo.enrollmentsWithMembers({ estado: 'A' }),
    repo.enrollmentsWithMembers({ estado: 'V', OR: [{ fechaFin: { gte: day(desde), lte: day(hasta) } }, { fechaFin: null }] })
  ]);
  const limite = addDays(hoy, dias), activos = activas.flatMap(insRows), vencidos = vencidas.flatMap(insRows);
  const porVencer = activas.filter((i) => i.fechaFin && dateStr(i.fechaFin) <= limite).flatMap(insRows).map((r) => ({ ...r, diasRestantes: daysBetween(hoy, r.fechaFin) }));
  return { desde, hasta, dias, resumen: { activos: distinct(activos), porVencer: distinct(porVencer), vencidos: distinct(vencidos) }, activos, porVencer, vencidos };
}

// Entradas por día y por hora, y el pico de personas adentro frente al aforo.
export async function entriesReport(query) {
  const { desde, hasta } = range(query, 7);
  const [gym, rows] = await Promise.all([repo.gym(), repo.entries(desde, hasta)]);
  const porDia = new Map(), porHora = new Map();
  for (const e of rows) {
    const f = dateStr(e.fecha), h = e.horaIngreso.slice(0, 2);
    const d = porDia.get(f) || { fecha: f, entradas: 0, aClases: 0, eventos: [] };
    d.entradas += 1; if (e.claseId) d.aClases += 1;
    d.eventos.push([toMin(e.horaIngreso), 1], [e.horaSalida ? toMin(e.horaSalida) : 24 * 60, -1]);
    porDia.set(f, d);
    porHora.set(h, (porHora.get(h) || 0) + 1);
  }
  const dias = [...porDia.values()].map(({ eventos, ...d }) => {
    // Pico: barrido de entradas (+1) y salidas (−1); las que siguen abiertas cuentan hasta el fin del día.
    let adentro = 0, pico = 0;
    for (const [, delta] of eventos.sort((a, b) => a[0] - b[0] || a[1] - b[1])) { adentro += delta; pico = Math.max(pico, adentro); }
    return { ...d, picoAdentro: pico, ocupacionPico: Number(dec(pico).div(gym.aforoMax).times(100).toFixed(1)) };
  });
  const horas = [...porHora.entries()].sort().map(([hora, entradas]) => ({ hora: `${hora}:00`, entradas }));
  return { desde, hasta, aforoMax: gym.aforoMax, totalEntradas: rows.length, porDia: dias, porHora: horas };
}

// Ventas por día y por producto, local (L) y web (W) por separado.
export async function salesReport(query) {
  const { desde, hasta } = range(query);
  const [dias, productos] = await Promise.all([repo.salesByDay(desde, hasta), repo.salesByProduct(desde, hasta)]);
  const canal = (c) => { const ds = dias.filter((d) => d.canal === c); return { ventas: ds.reduce((n, d) => n + d.ventas, 0), neto: num(sum(ds.map((d) => d.neto))), total: num(sum(ds.map((d) => d.total))) }; };
  return {
    desde, hasta, totales: { local: canal('L'), web: canal('W'), total: num(sum(dias.map((d) => d.total))) },
    porDia: dias.map((d) => ({ fecha: d.fecha, canal: d.canal, ventas: d.ventas, neto: num(d.neto), total: num(d.total) })),
    porProducto: productos.map((p) => ({ productoId: p.productoId, nombre: p.nombre, canal: p.canal, cantidad: p.cantidad, neto: num(p.neto), total: num(p.total) }))
  };
}

// Ganancia por producto: neto sin IVA menos el costo promedio guardado en cada línea al vender.
export async function profitReport(query) {
  const { desde, hasta } = range(query);
  const rows = await repo.salesByProduct(desde, hasta), byId = new Map();
  for (const r of rows) {
    const p = byId.get(r.productoId) || { productoId: r.productoId, nombre: r.nombre, cantidad: 0, neto: dec(0), costo: dec(0) };
    p.cantidad += r.cantidad; p.neto = p.neto.plus(dec(r.neto)); p.costo = p.costo.plus(dec(r.costo)); byId.set(r.productoId, p);
  }
  const productos = [...byId.values()].map((p) => { const g = r2(p.neto.minus(p.costo)); return { productoId: p.productoId, nombre: p.nombre, cantidad: p.cantidad, ingresoNeto: num(p.neto), costo: num(p.costo), ganancia: num(g), margen: p.neto.isZero() ? null : Number(g.div(p.neto).times(100).toFixed(1)) }; }).sort((a, b) => b.ganancia - a.ganancia);
  const neto = sum(productos.map((p) => p.ingresoNeto)), costo = sum(productos.map((p) => p.costo));
  return { desde, hasta, totales: { ingresoNeto: num(neto), costo: num(costo), ganancia: num(neto.minus(costo)) }, productos };
}

// Inventario valorizado, lotes por caducar, productos bajo mínimo y, con productoId, su kárdex.
export async function inventoryReport(query) {
  const hoy = localToday();
  const dias = query.dias === undefined ? null : Number(query.dias);
  if (dias !== null && (!Number.isInteger(dias) || dias < 0 || dias > 365)) throw new ApiError(400, 'dias es un entero entre 0 y 365.');
  const metodoSalida = query.metodoSalida;
  if (metodoSalida !== undefined && !['FEFO', 'FIFO'].includes(metodoSalida)) throw new ApiError(400, 'metodoSalida debe ser FEFO o FIFO.');
  const categoriaId = query.categoriaId;
  const caducaDesde = query.caducaDesde, caducaHasta = query.caducaHasta;
  if (caducaDesde && !validDate(caducaDesde) || caducaHasta && !validDate(caducaHasta)) throw new ApiError(400, 'caducaDesde y caducaHasta van con el formato AAAA-MM-DD.');
  if (caducaDesde && caducaHasta && caducaDesde > caducaHasta) throw new ApiError(400, 'caducaDesde no puede ser posterior a caducaHasta.');
  const [productos, lotes] = await Promise.all([repo.inventory(), repo.lotsWithExpiry()]);
  const coincide = (p) => (!metodoSalida || salidaInfo(p).metodoSalida === metodoSalida) && (!categoriaId || p.categoriaId === categoriaId);
  const filtrados = productos.filter(coincide);
  const valorizado = filtrados.filter((p) => p.esContable === 'S').map((p) => ({ productoId: p.id, nombre: p.nombre, categoria: p.categoria?.descripcion, metodoSalida: salidaInfo(p).metodoSalida, controlaCaducidad: salidaInfo(p).controlaCaducidad, stock: p.stock, costoPromedio: num4(p.costoPromedio), valor: num(r2(dec(p.costoPromedio).times(p.stock))), valorVenta: num(r2(dec(p.precioVenta).times(p.stock))) }));
  const porCaducar = lotes.filter((l) => coincide(l.producto) && dateStr(l.fechaCaducidad) <= addDays(hoy, dias ?? l.producto.diasAlertaCad ?? 30) && (!caducaDesde || dateStr(l.fechaCaducidad) >= caducaDesde) && (!caducaHasta || dateStr(l.fechaCaducidad) <= caducaHasta)).map((l) => ({ loteId: l.id, productoId: l.productoId, nombre: l.producto.nombre, fechaCaducidad: dateStr(l.fechaCaducidad), diasRestantes: daysBetween(hoy, dateStr(l.fechaCaducidad)), cantidadDisponible: l.cantidadDisponible, vencido: dateStr(l.fechaCaducidad) < hoy }));
  const bajoMinimo = filtrados.filter((p) => p.esContable === 'S' && p.stock <= p.stockMin).map((p) => ({ productoId: p.id, nombre: p.nombre, stock: p.stock, stockMin: p.stockMin, faltante: Math.max(0, p.stockMin - p.stock) }));
  const out = { fecha: hoy, filtros: { metodoSalida: metodoSalida || null, categoriaId: categoriaId || null, caducaDesde: caducaDesde || null, caducaHasta: caducaHasta || null }, totalValorizado: num(sum(valorizado.map((v) => v.valor))), valorizado, porCaducar, bajoMinimo };
  if (query.productoId) {
    const p = productos.find((x) => x.id === query.productoId);
    if (!p) throw new ApiError(404, 'Producto no encontrado.');
    out.kardex = (await repo.kardex(p.id)).map((k) => ({ id: k.id, fecha: k.fecha, tipo: k.tipoMovimientoId, descripcion: k.tipoMovimientoIdRef1.descripcion, entrada: k.tipoMovimientoIdRef1.tipo === 'I' ? k.cantidad : 0, salida: k.tipoMovimientoIdRef1.tipo === 'E' ? k.cantidad : 0, loteId: k.loteProductoId, costoUnit: num4(k.costoUnit), saldoCantidad: k.saldoCantidad, costoPromedio: num4(k.costoPromedio), saldoValor: num(k.saldoValor), ventaId: k.ventaId, observacion: k.observacion }));
  }
  return out;
}

// Ingresos por inscripciones (pagos vigentes del rango) por plan y por tipo de plan.
export async function enrollmentsReport(query) {
  const { desde, hasta } = range(query);
  const rows = await repo.enrollmentIncome(desde, hasta);
  const porPlan = rows.map((r) => ({ membresiaId: r.membresiaId, plan: r.plan, tipo: r.tipo, inscripciones: r.inscripciones, monto: num(r.monto), efectivo: num(r.efectivo), transferencia: num(r.transferencia) }));
  const porTipo = ['T', 'I'].map((t) => { const ps = porPlan.filter((p) => p.tipo === t); return { tipo: t, tipoNombre: t === 'T' ? 'Por tiempo' : 'Por ingresos', inscripciones: ps.reduce((n, p) => n + p.inscripciones, 0), monto: num(sum(ps.map((p) => p.monto))) }; });
  return { desde, hasta, total: num(sum(porPlan.map((p) => p.monto))), porTipo, porPlan };
}

// Cuadres del rango con faltantes y sobrantes, y los cierres semanales que se cruzan con el rango.
export async function cashReport(query) {
  const { desde, hasta } = range(query);
  const [cuadres, cierres] = await Promise.all([repo.shifts(desde, hasta), repo.closes(desde, hasta)]);
  const filas = cuadres.map((c) => ({ id: c.id, fecha: dateStr(c.fecha), turnoId: c.turnoId, turno: c.turnoIdRef1?.descripcion, empleado: c.empleadoIdRef1 ? `${c.empleadoIdRef1.nombre} ${c.empleadoIdRef1.apellido}` : null, saldoInicial: num(c.saldoInicial), ingresosEfectivo: num(c.totalIngresos), transferencias: num(c.totalTransf), egresos: num(c.totalEgresos), saldoFinal: num(c.saldoFinal), efectivoContado: num(c.efectivoContado), diferencia: num(c.diferencia), cerrado: c.efectivoContado !== null, cierreCajaId: c.cierreCajaId }));
  const dif = filas.filter((f) => f.cerrado).map((f) => dec(f.diferencia));
  return {
    desde, hasta,
    resumen: { cuadres: filas.length, abiertos: filas.length - dif.length, faltantes: num(sum(dif.filter((x) => x.isNegative()))), sobrantes: num(sum(dif.filter((x) => x.isPositive()))), diferenciaNeta: num(sum(dif)), ingresosEfectivo: num(sum(filas.map((f) => f.ingresosEfectivo))), transferencias: num(sum(filas.map((f) => f.transferencias))), egresos: num(sum(filas.map((f) => f.egresos))) },
    cuadres: filas,
    cierres: cierres.map((c) => ({ id: c.id, fechaDesde: dateStr(c.fechaDesde), fechaHasta: dateStr(c.fechaHasta), totalEfectivo: num(c.totalEfectivo), totalTransf: num(c.totalTransf), totalEgresos: num(c.totalEgresos), diferencia: num(c.diferencia), cuadres: c._count.cuadreTurnos, observacion: c.observacion }))
  };
}

// Comisiones de aliados cobradas en el rango, en detalle y por aliado.
export async function commissionsReport(query) {
  const { desde, hasta } = range(query);
  const rows = await repo.commissions(desde, hasta);
  const comisiones = rows.map((c) => ({ id: c.id, cedula: c.profesionalAliadoId, aliado: `${c.profesionalAliadoIdRef1.nombre} ${c.profesionalAliadoIdRef1.apellido}`, fechaCobro: c.fechaCobro, fechaDesde: dateStr(c.fechaDesde), fechaHasta: dateStr(c.fechaHasta), metodoPago: c.metodoPagoId, monto: num(c.monto) }));
  const porAliado = [...new Set(comisiones.map((c) => c.cedula))].map((cedula) => { const cs = comisiones.filter((c) => c.cedula === cedula); return { cedula, aliado: cs[0].aliado, periodos: cs.length, monto: num(sum(cs.map((c) => c.monto))) }; });
  return { desde, hasta, total: num(sum(comisiones.map((c) => c.monto))), porAliado, comisiones };
}
