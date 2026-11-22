import { num } from '../utils/money.js';
import { dateStr } from '../utils/dates.js';
import * as service from '../services/ally.service.js';

// 4.14 Comisiones de profesionales aliados: cobrar un periodo y ver pagados y pendientes.
export async function charge(req, res) {
  const c = await service.chargeCommission(req.user, req.params.cedula, req.body);
  res.status(201).json({ id: c.id, profesionalAliadoId: c.profesionalAliadoId, fechaDesde: dateStr(c.fechaDesde), fechaHasta: dateStr(c.fechaHasta), monto: num(c.monto), metodoPago: c.metodoPagoId, referencia: c.referencia, fechaCobro: c.fechaCobro, empleadoId: c.empleadoId });
}
export async function status(req, res) { res.json(await service.commissionsStatus(req.query)); }
