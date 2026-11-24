import { prisma } from '../config/prisma.js';
import { ApiError } from '../utils/ApiError.js';
import { hasPermission } from '../config/permisos.js';
import { asDate, localToday, dateStr, weekday, normalizeDay } from '../utils/dates.js';
import { range } from './report.service.js';
import { classRepository as repo } from '../models/class.repository.js';

const estadoApi = (e) => (e === 'S' ? 'I' : e);
const estadoDb = (e) => (e === 'I' ? 'S' : e);
const clave = (claseId, horarioId) => `${claseId}:${horarioId}`;

async function ocupaciones(ids, fecha) {
  const rows = await prisma.asistenciaCliente.groupBy({ by: ['claseId', 'horarioId'], where: { claseId: { in: ids }, fecha: asDate(fecha) }, _count: { _all: true } });
  return new Map(rows.filter((r) => r.claseId && r.horarioId).map((r) => [clave(r.claseId, r.horarioId), r._count._all]));
}

function dto(c, ocupados = new Map(), fecha = localToday()) {
  const estado = estadoApi(c.estado);
  return {
    id: c.id,
    nombre: c.nombre,
    descripcion: c.descripcion,
    servicioId: c.servicioId,
    servicio: c.servicioIdRef1?.nombre ?? null,
    entrenadorId: c.empleadoId,
    entrenador: c.empleadoIdRef1 ? `${c.empleadoIdRef1.nombre} ${c.empleadoIdRef1.apellido}` : null,
    especialidad: c.empleadoIdRef1?.especialidad ?? null,
    lugar: c.lugar,
    cupoMax: c.cupoMax,
    estado,
    estadoNombre: estado === 'A' ? 'Activa' : 'De baja',
    fechaCupo: fecha,
    horarios: c.claseHorarios.map((h) => {
      const reservas = ocupados.get(clave(c.id, h.horarioId)) ?? 0;
      return {
        id: h.horarioId,
        horarioId: h.horarioId,
        dia: h.horarioIdRef1.dia,
        horaInicio: h.horarioIdRef1.horaInicio,
        horaFin: h.horarioIdRef1.horaFin,
        cupoMax: c.cupoMax,
        reservas,
        cupoDisponible: Math.max(0, c.cupoMax - reservas)
      };
    })
  };
}

async function validarReferencias({ servicioId, empleadoId, horarios }) {
  const [servicio, empleado, encontrados] = await Promise.all([
    prisma.servicio.findUnique({ where: { id: servicioId } }),
    prisma.empleado.findUnique({ where: { id: empleadoId } }),
    prisma.horario.findMany({ where: { id: { in: horarios } }, select: { id: true } })
  ]);
  if (!servicio || servicio.estado !== 'A') throw new ApiError(400, 'El servicio de la clase no existe o está inactivo.');
  if (!empleado || empleado.estado !== 'A') throw new ApiError(400, 'El entrenador no existe o está inactivo.');
  if (encontrados.length !== horarios.length) throw new ApiError(400, 'Uno de los horarios no existe.');
}

function sinRepetidos(horarios) {
  if (new Set(horarios).size !== horarios.length) throw new ApiError(400, 'Los horarios de una clase no se repiten.');
}

export async function list(user, query, page, limit, skip) {
  const where = {};
  if (query.estado) where.estado = estadoDb(query.estado);
  if (query.entrenadorId) where.empleadoId = query.entrenadorId;
  if (query.dia) where.claseHorarios = { some: { estado: 'A', horarioIdRef1: { dia: { equals: query.dia, mode: 'insensitive' } } } };
  if (!hasPermission(user, 'clases:leer') && hasPermission(user, 'clases:propias')) where.empleadoId = user.empleadoId ?? '-';
  const [rows, total] = await Promise.all([repo.list(where, skip, limit), repo.count(where)]);
  const ocupados = await ocupaciones(rows.map((r) => r.id), localToday());
  return { data: rows.map((r) => dto(r, ocupados)), page, limit, total };
}

export async function detail(id) {
  const clase = await repo.find(Number(id));
  if (!clase) throw new ApiError(404, 'No se encontró la clase.');
  return dto(clase, await ocupaciones([clase.id], localToday()));
}

export async function create(body) {
  const horarios = body.horarios;
  sinRepetidos(horarios);
  await validarReferencias(body);
  const id = await prisma.$transaction(async (tx) => {
    const clase = await tx.clase.create({ data: {
      nombre: body.nombre.trim(), descripcion: body.descripcion ?? null, lugar: body.lugar ?? null,
      servicioId: body.servicioId, empleadoId: body.empleadoId, cupoMax: body.cupoMax,
      estado: estadoDb(body.estado ?? 'A')
    } });
    await tx.claseHorario.createMany({ data: horarios.map((horarioId) => ({ claseId: clase.id, horarioId, estado: 'A' })) });
    return clase.id;
  });
  return detail(id);
}

export async function update(id, body) {
  const claseId = Number(id);
  if (!await repo.find(claseId)) throw new ApiError(404, 'No se encontró la clase.');
  if (body.horarios) {
    sinRepetidos(body.horarios);
    await validarReferencias({ ...body, horarios: body.horarios });
  }
  const data = {};
  for (const campo of ['nombre', 'descripcion', 'lugar', 'servicioId', 'empleadoId', 'cupoMax']) if (body[campo] !== undefined) data[campo] = campo === 'nombre' ? body[campo].trim() : body[campo];
  if (body.estado !== undefined) data.estado = estadoDb(body.estado);
  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) await tx.clase.update({ where: { id: claseId }, data });
    if (body.horarios) {
      await tx.claseHorario.deleteMany({ where: { claseId } });
      await tx.claseHorario.createMany({ data: body.horarios.map((horarioId) => ({ claseId, horarioId, estado: 'A' })) });
    }
  });
  return detail(claseId);
}

export async function deactivate(id) {
  const claseId = Number(id);
  if (!await repo.find(claseId)) throw new ApiError(404, 'No se encontró la clase.');
  await prisma.$transaction(async (tx) => {
    await tx.clase.update({ where: { id: claseId }, data: { estado: 'S' } });
    await tx.claseHorario.updateMany({ where: { claseId }, data: { estado: 'S' } });
  });
  return detail(claseId);
}

export async function reserve(inscripcionId, body) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT ins_numero FROM inscripcion WHERE ins_numero = ${inscripcionId} FOR UPDATE`;
    await tx.$queryRaw`SELECT cla_codigo FROM clase_horario WHERE cla_codigo = ${body.claseId} AND hor_codigo = ${body.horarioId} FOR UPDATE`;
    const ins = await tx.inscripcion.findUnique({ where: { id: inscripcionId }, include: { inscripcionClientes: { where: { esTitular: 'S' } } } });
    if (!ins) throw new ApiError(404, 'No se encontró la inscripción.');
    if (ins.estado !== 'A') throw new ApiError(409, 'Solo se reserva cupo con una inscripción activa.');
    if (dateStr(ins.fechaInicio) > localToday() || (ins.fechaFin && dateStr(ins.fechaFin) < localToday())) throw new ApiError(409, 'La inscripción no está vigente hoy.');
    const titular = ins.inscripcionClientes[0];
    if (!titular) throw new ApiError(409, 'La inscripción no tiene titular.');
    const ch = await tx.claseHorario.findUnique({ where: { claseId_horarioId: { claseId: body.claseId, horarioId: body.horarioId } }, include: { claseIdRef1: true, horarioIdRef1: true } });
    if (!ch) throw new ApiError(409, 'Esa clase no se dicta en ese horario.');
    if (ch.claseIdRef1.estado !== 'A' || ch.estado !== 'A') throw new ApiError(409, 'La clase no está activa.');
    if (normalizeDay(ch.horarioIdRef1.dia) !== weekday(localToday())) throw new ApiError(409, `La clase se dicta el ${ch.horarioIdRef1.dia}, no hoy.`);
    const ocupados = await tx.asistenciaCliente.count({ where: { claseId: body.claseId, horarioId: body.horarioId, fecha: asDate(localToday()) } });
    if (body.cupoMax < ocupados) throw new ApiError(409, `El cupo no puede bajar de las ${ocupados} reservas actuales.`);
    if (ocupados >= body.cupoMax) throw new ApiError(409, `La clase está llena (${ocupados} de ${body.cupoMax}).`);
    const repetida = await tx.asistenciaCliente.findFirst({ where: { inscripcionId, clienteId: titular.clienteId, claseId: body.claseId, horarioId: body.horarioId, fecha: asDate(localToday()) } });
    if (repetida) throw new ApiError(409, 'Ese cliente ya tiene una reserva en este horario.');
    if (ch.claseIdRef1.cupoMax !== body.cupoMax) await tx.clase.update({ where: { id: body.claseId }, data: { cupoMax: body.cupoMax } });
    const reserva = await tx.asistenciaCliente.create({ data: { clienteId: titular.clienteId, inscripcionId, claseId: body.claseId, horarioId: body.horarioId, fecha: asDate(localToday()), horaIngreso: ch.horarioIdRef1.horaInicio } });
    return { id: reserva.id, inscripcionId, clienteId: titular.clienteId, claseId: body.claseId, horarioId: body.horarioId, fecha: localToday(), cupoMax: body.cupoMax, reservas: ocupados + 1, cupoDisponible: body.cupoMax - ocupados - 1 };
  });
}

export async function attendance(query) {
  const { desde, hasta } = range(query, 30);
  const where = { claseId: { not: null }, fecha: { gte: asDate(desde), lte: asDate(hasta) } };
  if (query.claseId) where.claseId = Number(query.claseId);
  if (query.entrenadorId) where.claseIdhorarioIdRef1 = { claseIdRef1: { empleadoId: query.entrenadorId } };
  const rows = await prisma.asistenciaCliente.findMany({
    where,
    include: {
      claseIdhorarioIdRef1: { include: { claseIdRef1: { include: { empleadoIdRef1: { select: { id: true, nombre: true, apellido: true } }, servicioIdRef1: { select: { nombre: true } } } }, horarioIdRef1: true } },
      inscripcionIdclienteIdRef1: { include: { clienteIdRef1: { select: { nombre: true, apellido: true } } } }
    },
    orderBy: [{ fecha: 'asc' }, { horaIngreso: 'asc' }]
  });
  const porClase = new Map(), porEntrenador = new Map();
  const detalle = rows.map((r) => {
    const clase = r.claseIdhorarioIdRef1?.claseIdRef1;
    const entrenador = clase?.empleadoIdRef1;
    const nombreClase = clase?.nombre ?? null, nombreEntrenador = entrenador ? `${entrenador.nombre} ${entrenador.apellido}` : null;
    const claseEntry = porClase.get(r.claseId) || { claseId: r.claseId, clase: nombreClase, entrenadorId: entrenador?.id ?? null, entrenador: nombreEntrenador, reservas: 0 };
    claseEntry.reservas += 1;
    porClase.set(r.claseId, claseEntry);
    if (entrenador) {
      const entrenadorEntry = porEntrenador.get(entrenador.id) || { entrenadorId: entrenador.id, entrenador: nombreEntrenador, reservas: 0 };
      entrenadorEntry.reservas += 1;
      porEntrenador.set(entrenador.id, entrenadorEntry);
    }
    return {
      id: r.id,
      inscripcionId: r.inscripcionId,
      clienteId: r.clienteId,
      cliente: r.inscripcionIdclienteIdRef1?.clienteIdRef1 ? `${r.inscripcionIdclienteIdRef1.clienteIdRef1.nombre} ${r.inscripcionIdclienteIdRef1.clienteIdRef1.apellido}` : null,
      claseId: r.claseId,
      clase: nombreClase,
      horarioId: r.horarioId,
      dia: r.claseIdhorarioIdRef1?.horarioIdRef1?.dia ?? null,
      horaInicio: r.claseIdhorarioIdRef1?.horarioIdRef1?.horaInicio ?? null,
      entrenadorId: entrenador?.id ?? null,
      entrenador: nombreEntrenador,
      fecha: dateStr(r.fecha),
      horaReserva: r.horaIngreso
    };
  });
  return {
    desde,
    hasta,
    resumen: {
      reservas: rows.length,
      porClase: [...porClase.values()].sort((a, b) => a.claseId - b.claseId),
      porEntrenador: [...porEntrenador.values()].sort((a, b) => a.entrenadorId.localeCompare(b.entrenadorId))
    },
    detalle
  };
}
