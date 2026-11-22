import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { r2, num } from '../utils/money.js';
import { localToday, asDate, validDate, dateStr, addDays } from '../utils/dates.js';
import { registerCommissionIncome } from './cash.service.js';

// ---- Comisiones de profesionales aliados (BACKEND_FASE2 4.14) ----
// Cobrar el periodo: sin solaparse con otro del mismo aliado (bloqueo FOR UPDATE del aliado) y con su ingreso en caja.
export async function chargeCommission(user, cedula, { fechaDesde, fechaHasta, monto, metodoPago, referencia }) {
  if (!user.empleadoId) throw new ApiError(403, 'Tu cuenta debe estar vinculada a un empleado para registrar esta operación');
  if (!validDate(fechaDesde) || !validDate(fechaHasta)) throw new ApiError(400, 'Las fechas van con el formato AAAA-MM-DD.');
  if (fechaHasta < fechaDesde) throw new ApiError(400, 'La fecha hasta no puede ser anterior a la fecha desde.');
  if (metodoPago === 'TR' && !String(referencia || '').trim()) throw new ApiError(400, 'La referencia es obligatoria en los pagos por transferencia.');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pal_cedula FROM profesional_aliado WHERE pal_cedula = ${cedula} FOR UPDATE`;
    const aliado = await tx.profesionalAliado.findUnique({ where: { id: cedula } });
    if (!aliado) throw new ApiError(404, 'No se encontró el profesional aliado.');
    if (aliado.estado !== 'A') throw new ApiError(409, 'El profesional aliado está inactivo.');
    const choque = await tx.comisionAliado.findFirst({ where: { profesionalAliadoId: cedula, fechaDesde: { lte: asDate(fechaHasta) }, fechaHasta: { gte: asDate(fechaDesde) } } });
    if (choque) throw new ApiError(409, `El periodo se cruza con uno ya cobrado (${dateStr(choque.fechaDesde)} a ${dateStr(choque.fechaHasta)}).`);
    // Normalmente el monto es el valor de comisión vigente del aliado; se guarda por historial.
    const valor = r2(monto ?? aliado.valorComision);
    if (!valor.gt(0)) throw new ApiError(409, 'El aliado no tiene un valor de comisión; indica el monto.');
    const comision = await tx.comisionAliado.create({ data: { profesionalAliadoId: cedula, empleadoId: user.empleadoId, metodoPagoId: metodoPago, fechaDesde: asDate(fechaDesde), fechaHasta: asDate(fechaHasta), monto: valor, referencia: referencia ? String(referencia).trim() : null } });
    await registerCommissionIncome(tx, { comision, empleadoId: user.empleadoId, concepto: `Comisión de ${aliado.nombre} ${aliado.apellido} (${fechaDesde} a ${fechaHasta})`.slice(0, 200) });
    return comision;
  });
}

// Pagados y pendientes por aliado. Los periodos pendientes son los meses del rango que ningún pago cubre.
export async function commissionsStatus({ desde, hasta, cedula }) {
  const hoy = localToday(), fin = hasta || hoy, ini = desde || `${fin.slice(0, 4)}-01-01`;
  if (!validDate(ini) || !validDate(fin) || ini > fin) throw new ApiError(400, 'desde y hasta van con el formato AAAA-MM-DD y desde no puede ser posterior a hasta.');
  const aliados = await prisma.profesionalAliado.findMany({ where: { ...(cedula ? { id: cedula } : { estado: 'A' }) }, include: { servicioIdRef1: { select: { nombre: true } }, comisionAliados: { orderBy: { fechaDesde: 'asc' } } }, orderBy: [{ apellido: 'asc' }] });
  const meses = [];
  const nextMonth = (m) => { const y = Number(m.slice(0, 4)), mo = Number(m.slice(5, 7)); return mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`; };
  for (let m = `${ini.slice(0, 7)}-01`; m <= fin; m = nextMonth(m)) meses.push({ desde: m, hasta: addDays(nextMonth(m), -1) });
  return {
    desde: ini, hasta: fin,
    aliados: aliados.map((a) => {
      const pagados = a.comisionAliados.map((c) => ({ id: c.id, fechaDesde: dateStr(c.fechaDesde), fechaHasta: dateStr(c.fechaHasta), monto: num(c.monto), metodoPago: c.metodoPagoId, referencia: c.referencia, fechaCobro: c.fechaCobro }));
      const pendientes = meses.filter((p) => !pagados.some((c) => c.fechaDesde <= p.hasta && c.fechaHasta >= p.desde)).map((p) => ({ ...p, montoSugerido: num(a.valorComision) }));
      return { cedula: a.id, nombre: `${a.nombre} ${a.apellido}`, servicio: a.servicioIdRef1?.nombre, estado: a.estado, valorComision: num(a.valorComision), pagados: pagados.filter((c) => c.fechaHasta >= ini && c.fechaDesde <= fin), pendientes };
    })
  };
}
