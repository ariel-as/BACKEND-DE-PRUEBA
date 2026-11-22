import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { dec, r2, sum, num } from '../utils/money.js';
import { localToday, localTime, asDate, todayDate, dateStr } from '../utils/dates.js';

// ---- Caja (BACKEND_FASE2 4.9) ----
// Un turno de caja es una fila de cuadre_turno por turno y fecha; queda abierto mientras efectivoContado sea nulo.

const NO_CAJA = 'Abre la caja del turno antes de cobrar';
const inHours = (t, hora) => t.horaInicio <= hora && hora < t.horaFin;

// Turno abierto de hoy que recibe los movimientos (el de la hora actual si hay varios). Lo bloquea.
export async function openShiftFor(tx) {
  const open = await tx.cuadreTurno.findMany({ where: { fecha: todayDate(), efectivoContado: null, cierreCajaId: null }, include: { turnoIdRef1: true }, orderBy: { id: 'desc' } });
  if (!open.length) throw new ApiError(409, NO_CAJA);
  const hora = localTime(), chosen = open.find((c) => inHours(c.turnoIdRef1, hora)) || open[0];
  await tx.$queryRaw`SELECT ctu_numero FROM cuadre_turno WHERE ctu_numero = ${chosen.id} FOR UPDATE`;
  const fresh = await tx.cuadreTurno.findUnique({ where: { id: chosen.id } });
  if (fresh.efectivoContado !== null || fresh.cierreCajaId !== null) throw new ApiError(409, NO_CAJA);
  return fresh;
}

// Valida la lista de pagos: uno o dos (EF y/o TR), referencia en TR y suma exacta al total.
export function checkPayments(pagos, total) {
  const expected = r2(total);
  if (!Array.isArray(pagos) || pagos.length < 1 || pagos.length > 2) throw new ApiError(400, `Envía uno o dos pagos que sumen ${expected.toFixed(2)}.`);
  if (pagos.length === 2 && pagos[0].metodoPago === pagos[1].metodoPago) throw new ApiError(400, 'Con dos pagos, uno es en efectivo y otro por transferencia.');
  for (const p of pagos) {
    if (!['EF', 'TR'].includes(p.metodoPago)) throw new ApiError(400, 'El método de pago debe ser EF o TR.');
    if (!(dec(p.monto).gt(0))) throw new ApiError(400, 'El monto de cada pago debe ser mayor que cero.');
    if (p.metodoPago === 'TR' && !String(p.referencia || '').trim()) throw new ApiError(400, 'La referencia es obligatoria en los pagos por transferencia.');
  }
  const paid = sum(pagos.map((p) => r2(p.monto)));
  if (!paid.eq(expected)) throw new ApiError(400, `El pago debe ser exactamente el total: ${expected.toFixed(2)}. Recibido: ${paid.toFixed(2)}.`);
  return pagos.map((p) => ({ metodoPagoId: p.metodoPago, monto: r2(p.monto), referencia: p.metodoPago === 'TR' ? String(p.referencia).trim() : (p.referencia ? String(p.referencia).trim() : null) }));
}

// Registra los pagos de una venta o inscripción y su ingreso ING en el turno abierto.
export async function registerPayments(tx, { pagos, total, ventaId = null, inscripcionId = null, empleadoId, concepto }) {
  const rows = checkPayments(pagos, total);
  const shift = await openShiftFor(tx);
  const created = [];
  for (const p of rows) {
    const pago = await tx.pago.create({ data: { ...p, ventaId, inscripcionId, empleadoId, fecha: todayDate(), estado: 'V' } });
    await tx.movimientoCaja.create({ data: { cuadreTurnoId: shift.id, tipoMovimientoId: 'ING', pagoId: pago.id, empleadoId, concepto: `${concepto} (${p.metodoPagoId})`, monto: p.monto } });
    created.push(pago);
  }
  return created;
}

// Ingreso de una comisión de aliado cobrada.
export async function registerCommissionIncome(tx, { comision, empleadoId, concepto }) {
  const shift = await openShiftFor(tx);
  return tx.movimientoCaja.create({ data: { cuadreTurnoId: shift.id, tipoMovimientoId: 'ING', comisionAliadoId: comision.id, empleadoId, concepto, monto: comision.monto } });
}

// Anula los pagos vigentes y registra la devolución DEV de cada uno por el mismo monto.
export async function refundPayments(tx, { where, empleadoId, concepto }) {
  const pagos = await tx.pago.findMany({ where: { ...where, estado: 'V' } });
  if (!pagos.length) return [];
  const shift = await openShiftFor(tx);
  for (const p of pagos) {
    await tx.pago.update({ where: { id: p.id }, data: { estado: 'A' } });
    await tx.movimientoCaja.create({ data: { cuadreTurnoId: shift.id, tipoMovimientoId: 'DEV', pagoId: p.id, empleadoId, concepto: `${concepto} (${p.metodoPagoId})`, monto: p.monto } });
  }
  return pagos;
}

// Totales de un turno a partir de sus movimientos.
// A1: una devolución por transferencia no sale del efectivo ni se resta de totalTransf (que es el ingreso bruto
// por transferencias y nunca queda negativo, así no choca con CHECK ctu_total_transf >= 0); se informa aparte.
export function computeTotals(saldoInicial, movimientos) {
  const metodo = (m) => m.pagoIdRef1?.metodoPagoId ?? m.comisionAliadoIdRef1?.metodoPagoId ?? 'EF';
  const pick = (fn) => sum(movimientos.filter(fn).map((m) => m.monto));
  const totalIngresos = pick((m) => m.tipoMovimientoId === 'ING' && metodo(m) === 'EF');
  const totalTransf = pick((m) => m.tipoMovimientoId === 'ING' && metodo(m) === 'TR');
  const totalEgresos = pick((m) => m.tipoMovimientoId === 'EGR' || (m.tipoMovimientoId === 'DEV' && metodo(m) === 'EF'));
  const devolucionesTransf = pick((m) => m.tipoMovimientoId === 'DEV' && metodo(m) === 'TR');
  return { totalIngresos, totalTransf, totalEgresos, devolucionesTransf, saldoFinal: r2(dec(saldoInicial).plus(totalIngresos).minus(totalEgresos)) };
}
const movInclude = { pagoIdRef1: { select: { metodoPagoId: true, ventaId: true, inscripcionId: true, estado: true } }, comisionAliadoIdRef1: { select: { metodoPagoId: true } } };
export const shiftInclude = { movimientoCajas: { include: movInclude, orderBy: { id: 'asc' } }, turnoIdRef1: true, empleadoIdRef1: { select: { nombre: true, apellido: true } } };

export function shiftDto(c) {
  const live = computeTotals(c.saldoInicial, c.movimientoCajas || []);
  const abierto = c.efectivoContado === null;
  return {
    id: c.id, turnoId: c.turnoId, turno: c.turnoIdRef1?.descripcion, fecha: dateStr(c.fecha), empleadoId: c.empleadoId, empleado: c.empleadoIdRef1 ? `${c.empleadoIdRef1.nombre} ${c.empleadoIdRef1.apellido}` : undefined,
    estado: abierto ? 'abierto' : 'cuadrado', cierreCajaId: c.cierreCajaId, saldoInicial: num(c.saldoInicial),
    totalIngresos: num(abierto ? live.totalIngresos : c.totalIngresos), totalTransf: num(abierto ? live.totalTransf : c.totalTransf), totalEgresos: num(abierto ? live.totalEgresos : c.totalEgresos),
    devolucionesTransf: num(live.devolucionesTransf), saldoFinal: num(abierto ? live.saldoFinal : c.saldoFinal), efectivoContado: num(c.efectivoContado), diferencia: num(c.diferencia),
    ...(c.movimientoCajas ? { movimientos: c.movimientoCajas.map((m) => ({ id: m.id, tipo: m.tipoMovimientoId, metodoPago: m.pagoIdRef1?.metodoPagoId ?? m.comisionAliadoIdRef1?.metodoPagoId ?? 'EF', pagoId: m.pagoId, comisionAliadoId: m.comisionAliadoId, concepto: m.concepto, monto: num(m.monto), fecha: m.fecha, empleadoId: m.empleadoId })) } : {})
  };
}

export async function openShift(user, { turnoId, saldoInicial }) {
  const turno = await prisma.turno.findUnique({ where: { id: turnoId } });
  if (!turno) throw new ApiError(400, 'El turno indicado no existe.');
  const closed = await prisma.cierreCaja.findFirst({ where: { fechaDesde: { lte: todayDate() }, fechaHasta: { gte: todayDate() } } });
  if (closed) throw new ApiError(409, 'El día de hoy ya está dentro de un cierre semanal.');
  const exists = await prisma.cuadreTurno.findUnique({ where: { turnoId_fecha: { turnoId, fecha: todayDate() } } });
  if (exists) throw new ApiError(409, `El turno ${turno.descripcion} de hoy ya fue abierto.`);
  const inicial = r2(saldoInicial);
  const c = await prisma.cuadreTurno.create({ data: { turnoId, empleadoId: user.empleadoId, fecha: todayDate(), saldoInicial: inicial, totalIngresos: dec(0), totalTransf: dec(0), totalEgresos: dec(0), saldoFinal: inicial }, include: shiftInclude });
  return shiftDto(c);
}

export async function currentShift() {
  const open = await prisma.cuadreTurno.findMany({ where: { fecha: todayDate(), efectivoContado: null, cierreCajaId: null }, include: shiftInclude, orderBy: { id: 'desc' } });
  if (!open.length) throw new ApiError(404, 'No hay un turno de caja abierto hoy.');
  const hora = localTime();
  return shiftDto(open.find((c) => inHours(c.turnoIdRef1, hora)) || open[0]);
}

// Gasto (EGR) o devolución manual (DEV ligada a un pago anulado, por el mismo monto).
export async function manualMovement(user, { tipo, concepto, monto, pagoId }) {
  return prisma.$transaction(async (tx) => {
    const shift = await openShiftFor(tx);
    if (tipo === 'EGR') {
      if (pagoId) throw new ApiError(400, 'Un gasto no va ligado a un pago.');
      if (!(dec(monto).gt(0))) throw new ApiError(400, 'El monto debe ser mayor que cero.');
      return tx.movimientoCaja.create({ data: { cuadreTurnoId: shift.id, tipoMovimientoId: 'EGR', empleadoId: user.empleadoId, concepto, monto: r2(monto) } });
    }
    if (!pagoId) throw new ApiError(400, 'Una devolución va ligada a un pago anulado.');
    const pago = await tx.pago.findUnique({ where: { id: pagoId } });
    if (!pago) throw new ApiError(404, 'No se encontró el pago.');
    if (pago.estado !== 'A') throw new ApiError(409, 'Solo se devuelve un pago anulado.');
    if (monto !== undefined && !r2(monto).eq(pago.monto)) throw new ApiError(409, `La devolución debe ser por el mismo monto del pago: ${num(pago.monto).toFixed(2)}.`);
    const dup = await tx.movimientoCaja.findFirst({ where: { pagoId, tipoMovimientoId: 'DEV' } });
    if (dup) throw new ApiError(409, 'Ese pago ya tiene su devolución registrada.');
    return tx.movimientoCaja.create({ data: { cuadreTurnoId: shift.id, tipoMovimientoId: 'DEV', pagoId, empleadoId: user.empleadoId, concepto, monto: pago.monto } });
  });
}

// Cuadre al cerrar el turno. A2: sin efectivo contado no se cierra.
export async function closeShift(id, { efectivoContado }) {
  if (efectivoContado === undefined || efectivoContado === null || efectivoContado === '' || !Number.isFinite(Number(efectivoContado)) || Number(efectivoContado) < 0) throw new ApiError(400, 'Ingresa el efectivo contado para cerrar el turno.');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT ctu_numero FROM cuadre_turno WHERE ctu_numero = ${id} FOR UPDATE`;
    const c = await tx.cuadreTurno.findUnique({ where: { id }, include: shiftInclude });
    if (!c) throw new ApiError(404, 'No se encontró el turno de caja.');
    if (c.cierreCajaId !== null) throw new ApiError(409, 'El turno pertenece a un cierre semanal y ya no se modifica.');
    if (c.efectivoContado !== null) throw new ApiError(409, 'El turno ya fue cuadrado.');
    const t = computeTotals(c.saldoInicial, c.movimientoCajas), contado = r2(efectivoContado);
    await tx.cuadreTurno.update({ where: { id }, data: { totalIngresos: t.totalIngresos, totalTransf: t.totalTransf, totalEgresos: t.totalEgresos, saldoFinal: t.saldoFinal, efectivoContado: contado, diferencia: contado.minus(t.saldoFinal) } });
    return shiftDto(await tx.cuadreTurno.findUnique({ where: { id }, include: shiftInclude }));
  });
}

// Cierre semanal (CON): sin solaparse, solo cuadres contados, y los asocia al cierre.
export async function weeklyClose(user, { fechaDesde, fechaHasta, observacion }) {
  if (fechaHasta < fechaDesde) throw new ApiError(400, 'La fecha final va después de la inicial.');
  if (fechaHasta > localToday()) throw new ApiError(409, 'El cierre no puede incluir días futuros.');
  return prisma.$transaction(async (tx) => {
    const gym = await tx.gimnasio.findFirst();
    await tx.$queryRaw`SELECT gim_ruc FROM gimnasio WHERE gim_ruc = ${gym.id} FOR UPDATE`;
    const desde = asDate(fechaDesde), hasta = asDate(fechaHasta);
    const overlap = await tx.cierreCaja.findFirst({ where: { fechaDesde: { lte: hasta }, fechaHasta: { gte: desde } } });
    if (overlap) throw new ApiError(409, `El periodo se cruza con el cierre ${overlap.id} (${dateStr(overlap.fechaDesde)} a ${dateStr(overlap.fechaHasta)}).`);
    const cuadres = await tx.cuadreTurno.findMany({ where: { fecha: { gte: desde, lte: hasta } } });
    if (!cuadres.length) throw new ApiError(409, 'No hay cuadres de turno en ese periodo.');
    const abiertos = cuadres.filter((c) => c.efectivoContado === null);
    if (abiertos.length) throw new ApiError(409, `Hay ${abiertos.length} turno(s) sin cuadrar en el periodo. Ciérralos antes del cierre semanal.`);
    const cierre = await tx.cierreCaja.create({ data: { empleadoId: user.empleadoId, fechaDesde: desde, fechaHasta: hasta, totalEfectivo: sum(cuadres.map((c) => c.totalIngresos)), totalTransf: sum(cuadres.map((c) => c.totalTransf)), totalEgresos: sum(cuadres.map((c) => c.totalEgresos)), diferencia: sum(cuadres.map((c) => c.diferencia)), observacion: observacion || null } });
    await tx.cuadreTurno.updateMany({ where: { id: { in: cuadres.map((c) => c.id) } }, data: { cierreCajaId: cierre.id } });
    return { ...closeDto(cierre), cuadres: cuadres.length };
  });
}
export const closeDto = (c) => ({ id: c.id, empleadoId: c.empleadoId, fechaDesde: dateStr(c.fechaDesde), fechaHasta: dateStr(c.fechaHasta), totalEfectivo: num(c.totalEfectivo), totalTransf: num(c.totalTransf), totalEgresos: num(c.totalEgresos), diferencia: num(c.diferencia), observacion: c.observacion, cuadres: c._count?.cuadreTurnos });
