import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { localToday, localTime, todayDate, dateStr, longDate, weekday, normalizeDay } from '../utils/dates.js';
import { isDayPass } from './enrollment.service.js';

// ---- Control de entradas (BACKEND_FASE2 4.7) ----
// Cada rechazo es un 409 con un mensaje que recepción puede leer en voz alta.
const no = (msg) => new ApiError(409, msg);
const vigentToday = (ins) => dateStr(ins.fechaInicio) <= localToday() && (!ins.fechaFin || dateStr(ins.fechaFin) >= localToday());

function stateMessage(ins) {
  if (ins.estado === 'P') return 'La inscripción todavía no está pagada.';
  if (ins.estado === 'X') return 'La inscripción fue anulada.';
  if (ins.estado === 'S') return 'La membresía está suspendida.';
  if (ins.estado === 'V') return ins.fechaFin ? `La membresía venció el ${longDate(ins.fechaFin)}.` : `La tarjeta ya usó sus ${ins.ingresosTotal} ingresos.`;
  return null;
}

export async function registerEntry(user, { clienteId, inscripcionId, claseId, horarioId }) {
  if ((claseId && !horarioId) || (!claseId && horarioId)) throw new ApiError(400, 'Para entrar a una clase indica la clase y el horario.');
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT ins_numero FROM inscripcion WHERE ins_numero = ${inscripcionId} FOR UPDATE`;
    const ins = await tx.inscripcion.findUnique({ where: { id: inscripcionId }, include: { membresiaIdRef1: { include: { membresiaServicios: true } }, suspensions: { where: { estado: 'A' } } } });
    if (!ins) throw new ApiError(404, 'No se encontró la inscripción.');
    const msg = stateMessage(ins);
    if (msg) throw no(msg);
    if (dateStr(ins.fechaInicio) > localToday()) throw no(`La membresía empieza el ${longDate(ins.fechaInicio)}.`);
    if (ins.fechaFin && dateStr(ins.fechaFin) < localToday()) throw no(`La membresía venció el ${longDate(ins.fechaFin)}.`);
    const susp = ins.suspensions.find((s) => dateStr(s.fechaInicio) <= localToday() && dateStr(s.fechaFin) >= localToday());
    if (susp) throw no(`La membresía está suspendida hasta el ${longDate(susp.fechaFin)}.`);
    const member = await tx.inscripcionCliente.findUnique({ where: { inscripcionId_clienteId: { inscripcionId, clienteId } }, include: { clienteIdRef1: true } });
    if (!member) throw no('Esa persona no es integrante de esta inscripción.');
    const open = await tx.asistenciaCliente.findFirst({ where: { inscripcionId, clienteId, fecha: todayDate(), horaSalida: null } });
    if (open) throw no(`${member.clienteIdRef1.nombre} ya tiene una entrada abierta desde las ${open.horaIngreso}.`);
    let used = 0;
    if (ins.ingresosTotal) { used = await tx.asistenciaCliente.count({ where: { inscripcionId } }); if (used >= ins.ingresosTotal) throw no(`La tarjeta ya usó sus ${ins.ingresosTotal} ingresos.`); }
    const gym = await tx.gimnasio.findFirst();
    await tx.$queryRaw`SELECT gim_ruc FROM gimnasio WHERE gim_ruc = ${gym.id} FOR UPDATE`;
    const inside = await tx.asistenciaCliente.count({ where: { fecha: todayDate(), horaSalida: null } });
    if (inside >= gym.aforoMax) throw no(`El gimnasio está lleno (${inside} de ${gym.aforoMax}).`);
    let claseNombre = null;
    if (claseId) {
      // A3: el pase diario solo da acceso al área del gimnasio; rechaza cualquier clase.
      if (isDayPass(ins.membresiaIdRef1)) throw no('El pase diario no incluye clases; solo da acceso al área de pesas y cardio.');
      await tx.$queryRaw`SELECT cla_codigo FROM clase_horario WHERE cla_codigo = ${claseId} AND hor_codigo = ${horarioId} FOR UPDATE`;
      const ch = await tx.claseHorario.findUnique({ where: { claseId_horarioId: { claseId, horarioId } }, include: { claseIdRef1: true, horarioIdRef1: true } });
      if (!ch) throw no('Esa clase no se dicta en ese horario.');
      const clase = ch.claseIdRef1;
      if (clase.estado !== 'A' || ch.estado !== 'A') throw no(`La clase de ${clase.nombre} está suspendida.`);
      if (!ins.membresiaIdRef1.membresiaServicios.some((s) => s.servicioId === clase.servicioId)) throw no(`El plan ${ins.membresiaIdRef1.nombre} no incluye la clase de ${clase.nombre}.`);
      if (normalizeDay(ch.horarioIdRef1.dia) !== weekday(localToday())) throw no(`La clase de ${clase.nombre} en ese horario es el ${ch.horarioIdRef1.dia}, no hoy.`);
      const enClase = await tx.asistenciaCliente.count({ where: { claseId, horarioId, fecha: todayDate() } });
      if (enClase >= clase.cupoMax) throw no(`La clase de ${clase.nombre} está llena (${enClase} de ${clase.cupoMax}).`);
      claseNombre = clase.nombre;
    }
    const entry = await tx.asistenciaCliente.create({ data: { clienteId, inscripcionId, claseId: claseId || null, horarioId: horarioId || null, fecha: todayDate(), horaIngreso: localTime() } });
    // Al registrar la última entrada de una tarjeta, pasa a V en la misma transacción.
    if (ins.ingresosTotal && used + 1 >= ins.ingresosTotal) await tx.inscripcion.update({ where: { id: inscripcionId }, data: { estado: 'V' } });
    return { ...entry, ingresosRestantes: ins.ingresosTotal ? ins.ingresosTotal - used - 1 : null, cliente: `${member.clienteIdRef1.nombre} ${member.clienteIdRef1.apellido}`, clase: claseNombre };
  });
}

export async function registerExit(id) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT asc_numero FROM asistencia_cliente WHERE asc_numero = ${id} FOR UPDATE`;
    const e = await tx.asistenciaCliente.findUnique({ where: { id } });
    if (!e) throw new ApiError(404, 'No se encontró la entrada.');
    if (e.horaSalida) throw no(`La salida ya se registró a las ${e.horaSalida}.`);
    const hora = dateStr(e.fecha) < localToday() ? '23:59' : localTime();
    if (hora <= e.horaIngreso) throw no('La salida debe ser al menos un minuto después de la entrada.');
    return tx.asistenciaCliente.update({ where: { id }, data: { horaSalida: hora } });
  });
}

export async function capacity() {
  const [gym, inside] = await Promise.all([prisma.gimnasio.findFirst(), prisma.asistenciaCliente.count({ where: { fecha: todayDate(), horaSalida: null } })]);
  return { fecha: localToday(), personasAdentro: inside, aforoMax: gym.aforoMax, disponible: Math.max(0, gym.aforoMax - inside) };
}

// Para recepción: inscripciones activas de la persona y las clases de hoy que su plan incluye.
export async function accessInfo(cedula) {
  const cliente = await prisma.cliente.findUnique({ where: { id: cedula } });
  if (!cliente) throw new ApiError(404, 'No se encontró el cliente.');
  const rows = await prisma.inscripcion.findMany({ where: { estado: 'A', inscripcionClientes: { some: { clienteId: cedula } } }, include: { membresiaIdRef1: { include: { membresiaServicios: true } }, suspensions: { where: { estado: 'A' } }, _count: { select: { inscripcionClientes: true } } }, orderBy: { id: 'desc' } });
  const today = weekday(localToday());
  const clasesHoy = await prisma.claseHorario.findMany({ where: { estado: 'A', claseIdRef1: { estado: 'A' } }, include: { claseIdRef1: true, horarioIdRef1: true } });
  const deHoy = clasesHoy.filter((c) => normalizeDay(c.horarioIdRef1.dia) === today);
  const ocupados = await prisma.asistenciaCliente.groupBy({ by: ['claseId', 'horarioId'], where: { fecha: todayDate(), claseId: { not: null } }, _count: { _all: true } });
  const out = [];
  for (const ins of rows.filter(vigentToday)) {
    const usados = ins.ingresosTotal ? await prisma.asistenciaCliente.count({ where: { inscripcionId: ins.id } }) : null;
    const suspendida = ins.suspensions.some((s) => dateStr(s.fechaInicio) <= localToday() && dateStr(s.fechaFin) >= localToday());
    const servicios = new Set(ins.membresiaIdRef1.membresiaServicios.map((s) => s.servicioId));
    const abierta = await prisma.asistenciaCliente.findFirst({ where: { inscripcionId: ins.id, clienteId: cedula, fecha: todayDate(), horaSalida: null } });
    out.push({
      inscripcionId: ins.id, membresiaId: ins.membresiaId, plan: ins.membresiaIdRef1.nombre, fechaInicio: dateStr(ins.fechaInicio), fechaFin: dateStr(ins.fechaFin), ingresosTotal: ins.ingresosTotal, ingresosRestantes: ins.ingresosTotal ? ins.ingresosTotal - usados : null, suspendida, entradaAbiertaId: abierta?.id ?? null,
      clasesHoy: isDayPass(ins.membresiaIdRef1) ? [] : deHoy.filter((c) => servicios.has(c.claseIdRef1.servicioId)).map((c) => ({ claseId: c.claseId, horarioId: c.horarioId, clase: c.claseIdRef1.nombre, horaInicio: c.horarioIdRef1.horaInicio, horaFin: c.horarioIdRef1.horaFin, cupoMax: c.claseIdRef1.cupoMax, ocupados: ocupados.find((o) => o.claseId === c.claseId && o.horarioId === c.horarioId)?._count._all ?? 0 }))
    });
  }
  return { cliente: { id: cliente.id, nombre: `${cliente.nombre} ${cliente.apellido}`, estado: cliente.estado }, inscripciones: out };
}
