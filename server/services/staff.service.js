import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { localToday, localTime, todayDate, asDate, addDays, dateStr, weekday, normalizeDay, validDate, daysBetween } from '../utils/dates.js';

// ---- Asistencia del personal (BACKEND_FASE2 4.3) ----
// Cada empleado marca la propia; ADM puede marcar y corregir la de cualquiera (empleadoId).
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
function target(user, empleadoId) {
  const isAdmin = user.roles.includes('ADM');
  if (empleadoId && empleadoId !== user.empleadoId && !isAdmin) throw new ApiError(403, 'Solo un administrador marca la asistencia de otro empleado.');
  const id = empleadoId || user.empleadoId;
  if (!id) throw new ApiError(403, 'Tu cuenta debe estar vinculada a un empleado para registrar esta operación');
  return id;
}
async function activeEmployee(tx, id) {
  const e = await tx.empleado.findUnique({ where: { id }, include: { turnoIdRef1: true } });
  if (!e || e.estado !== 'A') throw new ApiError(409, 'El empleado no existe o está inactivo.');
  return e;
}

// Entrada: una por empleado y día (UNIQUE emp_cedula, ase_fecha).
export async function markEntry(user, { empleadoId, observacion }) {
  const id = target(user, empleadoId);
  return prisma.$transaction(async (tx) => {
    const e = await activeEmployee(tx, id);
    await tx.$queryRaw`SELECT emp_cedula FROM empleado WHERE emp_cedula = ${id} FOR UPDATE`;
    const prev = await tx.asistenciaEmpleado.findFirst({ where: { empleadoId: id, fecha: todayDate() } });
    if (prev) throw new ApiError(409, `${e.nombre} ya marcó la entrada hoy a las ${prev.horaEntrada}.`);
    return tx.asistenciaEmpleado.create({ data: { empleadoId: id, fecha: todayDate(), horaEntrada: localTime(), observacion: observacion || null } });
  });
}

// Salida: va después de la entrada abierta de hoy.
export async function markExit(user, { empleadoId, observacion }) {
  const id = target(user, empleadoId);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT emp_cedula FROM empleado WHERE emp_cedula = ${id} FOR UPDATE`;
    const a = await tx.asistenciaEmpleado.findFirst({ where: { empleadoId: id, fecha: todayDate() } });
    if (!a) throw new ApiError(409, 'Primero marca la entrada de hoy.');
    if (a.horaSalida) throw new ApiError(409, `La salida ya se marcó a las ${a.horaSalida}.`);
    const hora = localTime();
    if (hora <= a.horaEntrada) throw new ApiError(409, 'La salida debe ser al menos un minuto después de la entrada.');
    return tx.asistenciaEmpleado.update({ where: { id: a.id }, data: { horaSalida: hora, ...(observacion ? { observacion } : {}) } });
  });
}

// Corrección (solo ADM): horas y observación de un registro.
export async function correct(id, { horaEntrada, horaSalida, observacion }) {
  const a = await prisma.asistenciaEmpleado.findUnique({ where: { id } });
  if (!a) throw new ApiError(404, 'No se encontró el registro de asistencia.');
  const entrada = horaEntrada ?? a.horaEntrada, salida = horaSalida === undefined ? a.horaSalida : horaSalida;
  if (!HORA.test(entrada) || (salida !== null && !HORA.test(salida))) throw new ApiError(400, 'Las horas van con el formato HH:MM.');
  if (salida !== null && salida <= entrada) throw new ApiError(409, 'La salida debe ser posterior a la entrada.');
  return prisma.asistenciaEmpleado.update({ where: { id }, data: { horaEntrada: entrada, horaSalida: salida, observacion: observacion === undefined ? a.observacion : observacion } });
}

// Reporte por rango: atrasos (entrada después del inicio del turno) y faltas en los días abiertos sin registro.
export async function report({ desde, hasta, empleadoId }) {
  const fin = hasta || localToday(), ini = desde || addDays(fin, -6);
  if (!validDate(ini) || !validDate(fin)) throw new ApiError(400, 'desde y hasta van con el formato AAAA-MM-DD.');
  if (ini > fin) throw new ApiError(400, 'desde no puede ser posterior a hasta.');
  if (daysBetween(ini, fin) > 92) throw new ApiError(400, 'El rango máximo del reporte de asistencia es de 93 días.');
  const [empleados, registros, horario] = await Promise.all([
    prisma.empleado.findMany({ where: { estado: 'A', ...(empleadoId ? { id: empleadoId } : {}) }, include: { turnoIdRef1: true, cargoIdRef1: { select: { descripcion: true } } }, orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }] }),
    prisma.asistenciaEmpleado.findMany({ where: { fecha: { gte: asDate(ini), lte: asDate(fin) }, ...(empleadoId ? { empleadoId } : {}) }, orderBy: [{ fecha: 'asc' }] }),
    prisma.horarioAtencion.findMany()
  ]);
  if (empleadoId && !empleados.length) throw new ApiError(404, 'No se encontró el empleado o está inactivo.');
  // Días que cuentan: hasta hoy, y solo los que el gimnasio abre (si no hay horario cargado, todos).
  const cerrados = new Set(horario.filter((h) => h.abierto === 'N').map((h) => normalizeDay(h.dia)));
  const dias = [];
  for (let d = ini; d <= fin && d <= localToday(); d = addDays(d, 1)) if (!cerrados.has(weekday(d))) dias.push(d);
  const toMin = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const filas = empleados.map((e) => {
    const propios = new Map(registros.filter((r) => r.empleadoId === e.id).map((r) => [dateStr(r.fecha), r]));
    const inicio = e.turnoIdRef1?.horaInicio ?? null;
    const detalle = dias.map((d) => {
      const r = propios.get(d);
      // Hoy todavía no es falta: el turno puede no haber empezado.
      if (!r) return { fecha: d, estado: d === localToday() ? 'sin registro' : 'falta' };
      const atraso = inicio ? Math.max(0, toMin(r.horaEntrada) - toMin(inicio)) : 0;
      return { fecha: d, id: r.id, estado: atraso ? 'atraso' : 'a tiempo', horaEntrada: r.horaEntrada, horaSalida: r.horaSalida, minutosAtraso: atraso, observacion: r.observacion };
    });
    return {
      empleadoId: e.id, nombre: `${e.nombre} ${e.apellido}`, cargo: e.cargoIdRef1?.descripcion, turno: e.turnoIdRef1 ? { id: e.turnoIdRef1.id, descripcion: e.turnoIdRef1.descripcion, horaInicio: e.turnoIdRef1.horaInicio, horaFin: e.turnoIdRef1.horaFin } : null,
      diasLaborables: dias.length, asistencias: detalle.filter((x) => x.horaEntrada).length, atrasos: detalle.filter((x) => x.estado === 'atraso').length,
      minutosAtraso: detalle.reduce((n, x) => n + (x.minutosAtraso || 0), 0), faltas: detalle.filter((x) => x.estado === 'falta').length, detalle
    };
  });
  return { desde: ini, hasta: fin, empleados: filas };
}
