import { ApiError } from '../utils/ApiError.js';
import { num } from '../utils/money.js';
import { gymRepository } from '../models/gym.repository.js';

const dto = (g) => ({ id: g.id, nombre: g.nombre, direccion: g.direccion, telefono: g.telefono, correo: g.correo, aforoMax: g.aforoMax, propietaria: g.propietaria, porcentajeIva: num(g.porcentajeIva), establecimiento: g.establecimiento, puntoEmision: g.puntoEmision });
const scheduleDto = (h) => ({ id: h.id, dia: h.dia, abierto: h.abierto, horaApertura: h.horaApertura, horaCierre: h.horaCierre });
async function current() { const g = await gymRepository.find(); if (!g) throw new ApiError(404, 'No hay datos del gimnasio.'); return g; }
export async function get(_req, res) { res.json(dto(await current())); }
// Cambiar el IVA no toca inscripciones, ventas ni facturas: cada una guarda su porcentaje histórico.
export async function update(req, res) { const g = await current(); const data = { ...req.body }; if (data.porcentajeIva !== undefined) data.porcentajeIva = String(data.porcentajeIva); res.json(dto(await gymRepository.update(g.id, data))); }
export async function schedule(_req, res) { res.json((await gymRepository.schedule()).map(scheduleDto)); }
export async function replaceSchedule(req, res) {
  const g = await current();
  const dias = req.body.dias.map((d) => (d.abierto === 'S' ? { dia: d.dia, abierto: 'S', horaApertura: d.horaApertura, horaCierre: d.horaCierre } : { dia: d.dia, abierto: 'N', horaApertura: null, horaCierre: null }));
  for (const d of dias) if (d.abierto === 'S' && (!d.horaApertura || !d.horaCierre || d.horaCierre <= d.horaApertura)) throw new ApiError(400, `Revisa las horas de ${d.dia}: la hora de cierre va después de la de apertura.`);
  if (new Set(dias.map((d) => d.dia.toLowerCase())).size !== dias.length) throw new ApiError(400, 'Cada día se indica una sola vez.');
  res.json((await gymRepository.replaceSchedule(g.id, dias)).map(scheduleDto));
}
