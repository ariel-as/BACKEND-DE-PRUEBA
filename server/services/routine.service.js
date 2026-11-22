import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { localToday, todayDate, asDate, validDate, dateStr } from '../utils/dates.js';

// ---- Rutinas (BACKEND_FASE2 4.8) ----
// El entrenador crea y edita rutinas solo para clientes con una inscripción activa en un plan con rutina,
// y solo ve y edita las suyas. ADM ve y edita todas; REC solo las lee.
const own = (user) => ({ empleadoId: user.empleadoId ?? '-' });
// Leer: ADM y quien tiene rutinas:leer ven todas; el entrenador, las suyas. Editar: ADM todas; el entrenador, las suyas.
export const readWhere = (user) => (user.roles.includes('ADM') || user.permisos.includes('rutinas:leer') ? {} : own(user));
const editWhere = (user) => (user.roles.includes('ADM') ? {} : own(user));

async function checkClient(tx, clienteId) {
  const c = await tx.cliente.findUnique({ where: { id: clienteId } });
  if (!c || c.estado !== 'A') throw new ApiError(409, 'El cliente no existe o está inactivo.');
  const hoy = todayDate();
  const ins = await tx.inscripcion.findFirst({ where: { estado: 'A', fechaInicio: { lte: hoy }, OR: [{ fechaFin: null }, { fechaFin: { gte: hoy } }], membresiaIdRef1: { incluyeRutina: 'S' }, inscripcionClientes: { some: { clienteId } } } });
  if (!ins) throw new ApiError(409, `${c.nombre} ${c.apellido} no tiene una inscripción activa en un plan que incluya rutina.`);
  return c;
}
function dates(fechaInicio, fechaFin) {
  if (fechaInicio !== undefined && !validDate(fechaInicio)) throw new ApiError(400, 'fechaInicio va con el formato AAAA-MM-DD.');
  if (fechaFin && !validDate(fechaFin)) throw new ApiError(400, 'fechaFin va con el formato AAAA-MM-DD.');
}

export async function create(user, { clienteId, nivelId, objetivo, detalle, fechaInicio, fechaFin }) {
  if (!user.empleadoId) throw new ApiError(403, 'Tu cuenta debe estar vinculada a un empleado para registrar esta operación');
  dates(fechaInicio, fechaFin);
  const ini = fechaInicio || localToday();
  if (fechaFin && fechaFin < ini) throw new ApiError(400, 'La fecha de fin no puede ser anterior a la de inicio.');
  return prisma.$transaction(async (tx) => {
    await checkClient(tx, clienteId);
    if (!await tx.nivel.findUnique({ where: { id: nivelId } })) throw new ApiError(409, 'El nivel no existe.');
    return tx.rutina.create({ data: { clienteId, empleadoId: user.empleadoId, nivelId, objetivo, detalle, fechaInicio: asDate(ini), fechaFin: fechaFin ? asDate(fechaFin) : null } });
  });
}

export async function update(user, id, body) {
  dates(body.fechaInicio, body.fechaFin);
  return prisma.$transaction(async (tx) => {
    const r = await tx.rutina.findFirst({ where: { id, ...editWhere(user) } });
    if (!r) throw new ApiError(404, 'No se encontró la rutina o no es tuya.');
    const ini = body.fechaInicio ?? dateStr(r.fechaInicio), fin = body.fechaFin === undefined ? dateStr(r.fechaFin) : body.fechaFin;
    if (fin && fin < ini) throw new ApiError(400, 'La fecha de fin no puede ser anterior a la de inicio.');
    if (body.nivelId && !await tx.nivel.findUnique({ where: { id: body.nivelId } })) throw new ApiError(409, 'El nivel no existe.');
    const data = { ...(body.nivelId ? { nivelId: body.nivelId } : {}), ...(body.objetivo ? { objetivo: body.objetivo } : {}), ...(body.detalle ? { detalle: body.detalle } : {}), fechaInicio: asDate(ini), fechaFin: fin ? asDate(fin) : null };
    return tx.rutina.update({ where: { id }, data });
  });
}

