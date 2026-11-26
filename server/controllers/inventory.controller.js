import { ApiError } from '../utils/ApiError.js';
import { pagination, pageResult } from '../utils/pagination.js';
import { num, num4 } from '../utils/money.js';
import { dateStr, localToday, asDate, daysBetween } from '../utils/dates.js';
import { inventoryRepository as repo } from '../models/inventory.repository.js';
import { receiveWithoutOrder, adjustStock, writeOffLot, setLotBlock, salidaInfo, inventoryAlerts } from '../services/inventory.service.js';

const ESTADOS = { D: 'Disponible', A: 'Agotado', C: 'Caducado', B: 'Bloqueado' };
const lotDto = (l) => ({ id: l.id, productoId: l.productoId, producto: l.producto?.nombre, categoriaId: l.producto?.categoriaId, ...salidaInfo(l.producto || {}), ordenCompraId: l.ordenCompraId, numFabricante: l.numFabricante, fechaIngreso: dateStr(l.fechaIngreso), fechaCaducidad: dateStr(l.fechaCaducidad), cantidadInicial: l.cantidadInicial, cantidadDisponible: l.cantidadDisponible, costoUnit: num(l.costoUnit), estado: l.estado, estadoNombre: ESTADOS[l.estado] });
async function productState(productoId, extra = {}) {
  const p = await repo.product(productoId);
  if (!p) throw new ApiError(404, 'Producto no encontrado.');
  return { productoId: p.id, nombre: p.nombre, stock: p.stock, stockMin: p.stockMin, costoPromedio: num4(p.costoPromedio), sumaLotes: p.loteProductos.reduce((n, l) => n + l.cantidadDisponible, 0), ...extra };
}
const movesDto = (r) => (r.moves || []).map((m) => ({ loteProductoId: m.loteProductoId, cantidad: m.cantidad, costoUnit: num4(m.costoUnit) }));

export async function receive(req, res) { const r = await receiveWithoutOrder(req.body, req.user.empleadoId); res.status(201).json(await productState(req.body.productoId, { lote: r.lote ? lotDto(r.lote) : null })); }
export async function adjust(req, res) { const r = await adjustStock(req.body, req.user.empleadoId); res.status(201).json(await productState(req.body.productoId, { movimientos: movesDto(r) })); }
export async function writeOff(req, res) { const r = await writeOffLot(Number(req.params.id), req.body.observacion, req.user.empleadoId); res.status(201).json(await productState(r.productoId, { loteProductoId: r.loteProductoId, cantidadBaja: r.cantidad })); }
export async function block(req, res) { res.json(lotDto(await setLotBlock(Number(req.params.id), req.body.bloquear))); }
export async function lots(req, res) {
  const { page, limit, skip } = pagination(req.query), where = {};
  if (req.query.productoId) where.productoId = String(req.query.productoId);
  if (req.query.estado) where.estado = String(req.query.estado);
  if (req.query.categoriaId || req.query.metodoSalida) {
    where.producto = { ...(req.query.categoriaId ? { categoriaId: String(req.query.categoriaId) } : {}), ...(req.query.metodoSalida ? { controlaCaducidad: req.query.metodoSalida === 'FEFO' ? 'S' : 'N' } : {}) };
  }
  if (req.query.conStock === 'S') where.cantidadDisponible = { gt: 0 };
  if (req.query.caducaDesde || req.query.caducaHasta) where.fechaCaducidad = { ...(req.query.caducaDesde ? { gte: asDate(req.query.caducaDesde) } : {}), ...(req.query.caducaHasta ? { lte: asDate(req.query.caducaHasta) } : {}) };
  if (req.query.porCaducar === 'S') {
    // Lotes con unidades que caducan dentro de los días de alerta de su producto (30 si no tiene).
    const rows = (await repo.lots({ ...where, estado: where.estado || 'D', cantidadDisponible: { gt: 0 }, fechaCaducidad: { ...(where.fechaCaducidad || {}), not: null } }, 0, 10000)).filter((l) => daysBetween(localToday(), dateStr(l.fechaCaducidad)) <= (l.producto.diasAlertaCad ?? 30));
    return res.json(pageResult(rows.slice(skip, skip + limit).map(lotDto), page, limit, rows.length));
  }
  const [rows, total] = await Promise.all([repo.lots(where, skip, limit), repo.countLots(where)]);
  res.json(pageResult(rows.map(lotDto), page, limit, total));
}
export async function alerts(_req, res) {
  const data = await inventoryAlerts();
  const lot = (l) => ({ ...lotDto(l), diasRestantes: l.diasRestantes });
  const product = (p) => ({ productoId: p.id, nombre: p.nombre, categoriaId: p.categoriaId, ...salidaInfo(p), proximaCaducidad: p.proximaCaducidad, diasParaCaducar: p.diasParaCaducar, stock: p.stock, stockMin: p.stockMin });
  res.json({ conteos: data.conteos, porCaducar: data.porCaducar.map(lot), caducadosConUnidades: data.caducadosConUnidades.map(lot), sinStockYMinimo: data.sinStockYMinimo.map(product) });
}
export async function kardex(req, res) {
  const { page, limit, skip } = pagination(req.query), productoId = req.params.productoId;
  const state = await productState(productoId);
  const [rows, total] = await Promise.all([repo.kardex(productoId, skip, limit), repo.countKardex(productoId)]);
  res.json({ producto: { ...state, cuadra: state.stock === state.sumaLotes }, ...pageResult(rows.map((k) => ({ id: k.id, fecha: k.fecha, tipo: k.tipoMovimientoId, descripcion: k.tipoMovimientoIdRef1.descripcion, sentido: k.tipoMovimientoIdRef1.tipo, loteProductoId: k.loteProductoId, ventaId: k.ventaId, cantidad: k.cantidad, costoUnit: num4(k.costoUnit), saldoCantidad: k.saldoCantidad, costoPromedio: num4(k.costoPromedio), saldoValor: num(k.saldoValor), empleadoId: k.empleadoId, observacion: k.observacion })), page, limit, total) });
}
const supplierDto = (x) => ({ proveedorId: x.proveedorId, nombre: x.proveedorIdRef1.nombre, telefono: x.proveedorIdRef1.telefono, correo: x.proveedorIdRef1.correo, contacto: x.proveedorIdRef1.contacto });
export async function suppliers(req, res) { await productState(req.params.id); res.json((await repo.suppliers(req.params.id)).map(supplierDto)); }
export async function replaceSuppliers(req, res) {
  await productState(req.params.id);
  const ids = [...new Set(req.body.proveedores)];
  if ((await repo.findSuppliers(ids)).length !== ids.length) throw new ApiError(400, 'Uno o más proveedores no existen.');
  await repo.replaceSuppliers(req.params.id, ids);
  res.json((await repo.suppliers(req.params.id)).map(supplierDto));
}
