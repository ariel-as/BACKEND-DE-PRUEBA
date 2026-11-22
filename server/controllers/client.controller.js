import { ApiError } from '../utils/ApiError.js';
import { pagination, pageResult } from '../utils/pagination.js';
import { asDate, dateStr } from '../utils/dates.js';
import { num, conIva } from '../utils/money.js';
import { clientRepository } from '../models/client.repository.js';
import { CONSUMIDOR_FINAL } from '../services/sale.service.js';

export const clientDto = (c) => ({ id: c.id, cedula: c.id, nombre: c.nombre, apellido: c.apellido, nivelId: c.nivelId, nivel: c.nivelIdRef1?.descripcion ?? null, ruc: c.ruc, direccion: c.direccion, telefono: c.telefono, correo: c.correo, sector: c.sector, fechaNacimiento: dateStr(c.fechaNacimiento), esEstudiante: c.esEstudiante, estado: c.estado, usuarioId: c.usuarioId, fechaRegistro: c.fechaRegistro });
const FIELDS = ['nombre', 'apellido', 'nivelId', 'ruc', 'direccion', 'telefono', 'correo', 'sector', 'fechaNacimiento', 'esEstudiante', 'estado'];
async function data(body) {
  const out = {};
  for (const k of FIELDS) if (body[k] !== undefined) out[k] = body[k] === '' ? null : body[k];
  if (out.correo) out.correo = out.correo.toLowerCase();
  if (out.fechaNacimiento) out.fechaNacimiento = asDate(out.fechaNacimiento);
  if (out.nivelId && !await clientRepository.findLevel(out.nivelId)) throw new ApiError(400, 'El nivel indicado no existe.');
  return out;
}
export async function list(req, res) { const { page, limit, skip } = pagination(req.query); const buscar = req.query.buscar ? String(req.query.buscar).trim() : ''; const [rows, total] = await Promise.all([clientRepository.list(buscar, skip, limit), clientRepository.count(buscar)]); res.json(pageResult(rows.map(clientDto), page, limit, total)); }
export async function create(req, res) {
  const { cedula } = req.body;
  if (await clientRepository.find(cedula)) throw new ApiError(409, 'Ya existe un cliente con esa cédula.');
  const c = await clientRepository.create({ id: cedula, ...(await data(req.body)), esEstudiante: req.body.esEstudiante || 'N', estado: 'A' });
  res.location(`/api/v1/admin/clientes/${c.id}`).status(201).json(clientDto(c));
}
export async function update(req, res) {
  const id = req.params.cedula;
  if (id === CONSUMIDOR_FINAL) throw new ApiError(409, 'CONSUMIDOR FINAL no se edita ni se desactiva.');
  if (!await clientRepository.find(id)) throw new ApiError(404, 'No se encontró el cliente.');
  res.json(clientDto(await clientRepository.update(id, await data(req.body))));
}
export async function history(req, res) {
  const h = await clientRepository.history(req.params.cedula);
  if (!h) throw new ApiError(404, 'No se encontró el cliente.');
  const pagos = [...h.inscripciones.flatMap((i) => i.pagos), ...h.ventas.flatMap((v) => v.pagos)].sort((a, b) => b.id - a.id);
  res.json({
    cliente: clientDto(h.cliente),
    inscripciones: h.inscripciones.map((i) => ({ id: i.id, membresiaId: i.membresiaId, plan: i.membresiaIdRef1.nombre, fechaInicio: dateStr(i.fechaInicio), fechaFin: dateStr(i.fechaFin), ingresosTotal: i.ingresosTotal, total: num(conIva(i.valor, i.porcentajeIva)), canal: i.canal, estado: i.estado, integrantes: i.inscripcionClientes.map((m) => ({ clienteId: m.clienteId, nombre: `${m.clienteIdRef1.nombre} ${m.clienteIdRef1.apellido}`, esTitular: m.esTitular })) })),
    entradas: h.entradas.map((e) => ({ id: e.id, inscripcionId: e.inscripcionId, fecha: dateStr(e.fecha), horaIngreso: e.horaIngreso, horaSalida: e.horaSalida, claseId: e.claseId, horarioId: e.horarioId })),
    ventas: h.ventas.map((v) => ({ id: v.id, fecha: v.fecha, canal: v.canal, total: num(v.total), estado: v.estado, pedidoId: v.pedidoId, lineas: v.detalleVentas.length })),
    pedidos: h.pedidos.map((p) => ({ id: p.id, fecha: p.fechaCreacion, total: num(p.total), estado: p.estado, metodoPago: p.metodoPagoId })),
    pagos: pagos.map((p) => ({ id: p.id, fecha: dateStr(p.fecha), metodoPago: p.metodoPagoId, monto: num(p.monto), referencia: p.referencia, estado: p.estado, ventaId: p.ventaId, inscripcionId: p.inscripcionId })),
    facturas: h.facturas.map((f) => ({ id: f.id, fecha: f.fecha, numComprobante: f.numComprobante, total: num(f.total), estado: f.estado, ventaId: f.ventaId, inscripcionId: f.inscripcionId }))
  });
}
