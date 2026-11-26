import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { localToday, todayDate, asDate, validDate, dateStr, addDays } from '../utils/dates.js';
import { plantillas, ejerciciosPorGrupo } from '../config/plantillas-rutina.js';

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

export const parseDetalle = (raw) => {
  if (raw && typeof raw === 'object' && Array.isArray(raw.dias)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.dias)) return parsed;
    } catch {}
    return { editable: true, dias: [], nota: raw };
  }
  return { editable: true, dias: [], nota: '' };
};
const serializeDetalle = (detalle) => (typeof detalle === 'string' ? detalle : JSON.stringify(detalle ?? { editable: true, dias: [] }));

export const estadoRutina = (r, hoy = localToday()) => {
  if (!r.fechaFin) return 'vigente';
  const fin = dateStr(r.fechaFin) ?? String(r.fechaFin).slice(0, 10);
  if (fin < hoy) return 'vencida';
  return fin <= addDays(hoy, 7) ? 'por vencer' : 'vigente';
};

export const plantillasDisponibles = () => plantillas;
export const catalogoEjercicios = () => ejerciciosPorGrupo;

export async function fichaCliente(cedula) {
  const c = await prisma.cliente.findUnique({
    where: { id: cedula },
    select: { id: true, nombre: true, apellido: true, correo: true, nivelId: true, nivelIdRef1: { select: { descripcion: true } } }
  });
  if (!c) throw new ApiError(404, 'No se encontró el cliente.');
  const hoy = todayDate();
  const ins = await prisma.inscripcion.findFirst({
    where: { estado: 'A', fechaInicio: { lte: hoy }, OR: [{ fechaFin: null }, { fechaFin: { gte: hoy } }], inscripcionClientes: { some: { clienteId: cedula } } },
    select: { id: true, fechaFin: true, membresiaIdRef1: { select: { id: true, nombre: true, incluyeRutina: true } } }
  });
  const r = await prisma.rutina.findFirst({
    where: { clienteId: cedula, fechaInicio: { lte: hoy }, OR: [{ fechaFin: null }, { fechaFin: { gte: hoy } }] },
    include: { empleadoIdRef1: { select: { nombre: true, apellido: true } }, nivelIdRef1: { select: { descripcion: true } } },
    orderBy: [{ fechaInicio: 'desc' }, { id: 'desc' }]
  });
  return {
    cedula: c.id,
    nombre: `${c.nombre} ${c.apellido}`,
    correo: c.correo,
    nivelId: c.nivelId ?? null,
    nivel: c.nivelIdRef1?.descripcion ?? null,
    planActivo: ins ? { id: ins.id, nombre: ins.membresiaIdRef1.nombre, incluyeRutina: ins.membresiaIdRef1.incluyeRutina === 'S', fechaFin: dateStr(ins.fechaFin) } : null,
    rutinaVigente: r ? { id: r.id, empleadoId: r.empleadoId, nivelId: r.nivelId, objetivo: r.objetivo, detalle: parseDetalle(r.detalle), fechaInicio: dateStr(r.fechaInicio), fechaFin: dateStr(r.fechaFin), nivel: r.nivelIdRef1?.descripcion ?? null, entrenador: r.empleadoIdRef1 ? `${r.empleadoIdRef1.nombre} ${r.empleadoIdRef1.apellido}` : null } : null
  };
}

export async function create(user, { clienteId, nivelId, objetivo, detalle, fechaInicio, fechaFin }) {
  if (!user.empleadoId) throw new ApiError(403, 'Tu cuenta debe estar vinculada a un empleado para registrar esta operación');
  dates(fechaInicio, fechaFin);
  const ini = fechaInicio || localToday();
  if (fechaFin && fechaFin < ini) throw new ApiError(400, 'La fecha de fin no puede ser anterior a la de inicio.');
  return prisma.$transaction(async (tx) => {
    await checkClient(tx, clienteId);
    if (!await tx.nivel.findUnique({ where: { id: nivelId } })) throw new ApiError(409, 'El nivel no existe.');
    return tx.rutina.create({ data: { clienteId, empleadoId: user.empleadoId, nivelId, objetivo, detalle: serializeDetalle(detalle), fechaInicio: asDate(ini), fechaFin: fechaFin ? asDate(fechaFin) : null } });
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
    const data = { ...(body.nivelId ? { nivelId: body.nivelId } : {}), ...(body.objetivo ? { objetivo: body.objetivo } : {}), ...(body.detalle !== undefined ? { detalle: serializeDetalle(body.detalle) } : {}), fechaInicio: asDate(ini), fechaFin: fin ? asDate(fin) : null };
    return tx.rutina.update({ where: { id }, data });
  });
}
