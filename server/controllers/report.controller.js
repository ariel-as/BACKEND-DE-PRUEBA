import { ApiError } from '../utils/ApiError.js';
import { toCsv } from '../utils/csv.js';
import * as reports from '../services/report.service.js';

// Cada reporte responde JSON. Con ?formato=csv devuelve una de sus listas como CSV
// (la indicada en ?seccion= o la primera por defecto).
const SECCIONES = {
  clientes: ['porVencer', 'activos', 'vencidos'], entradas: ['porDia', 'porHora'], ventas: ['porDia', 'porProducto'],
  ganancia: ['productos'], inventario: ['valorizado', 'porCaducar', 'bajoMinimo', 'kardex'], inscripciones: ['porPlan', 'porTipo'],
  caja: ['cuadres', 'cierres'], comisiones: ['comisiones', 'porAliado']
};
const send = (nombre, fn) => async (req, res) => {
  const data = await fn(req.query);
  if (req.query.formato === undefined || req.query.formato === 'json') return res.json(data);
  if (req.query.formato !== 'csv') throw new ApiError(400, 'formato debe ser json o csv.');
  const seccion = req.query.seccion || SECCIONES[nombre][0];
  if (!SECCIONES[nombre].includes(seccion) || !Array.isArray(data[seccion])) throw new ApiError(400, `seccion debe ser una de: ${SECCIONES[nombre].filter((s) => Array.isArray(data[s])).join(', ')}.`);
  res.type('text/csv; charset=utf-8').attachment(`reporte-${nombre}-${seccion}.csv`).send(toCsv(data[seccion]));
};
export const clients = send('clientes', reports.clientsReport);
export const entries = send('entradas', reports.entriesReport);
export const sales = send('ventas', reports.salesReport);
export const profit = send('ganancia', reports.profitReport);
export const inventory = send('inventario', reports.inventoryReport);
export const enrollments = send('inscripciones', reports.enrollmentsReport);
export const cash = send('caja', reports.cashReport);
export const commissions = send('comisiones', reports.commissionsReport);
