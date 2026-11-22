import { ApiError } from '../utils/ApiError.js';
import { pagination, pageResult } from '../utils/pagination.js';
import { dec, conIva, num } from '../utils/money.js';
import { orderRepository } from '../models/order.repository.js';
import { createOrder, cancelOwn, changeState } from '../services/order.service.js';
import { hasPermission } from '../config/permisos.js';

const ESTADOS = { P: 'Pendiente de pago', R: 'Pago reportado', C: 'Pagado', E: 'Retirado', X: 'Cancelado' };
const orderDto = (p, staff = false) => ({ id: p.id, userId: p.usuarioId, metodoPago: p.metodoPagoId, total: num(p.total), estado: p.estado, estadoNombre: ESTADOS[p.estado], refTransferencia: p.refTransferencia, comprobante: p.comprobante, ventaId: p.ventas?.id ?? null, createdAt: p.fechaCreacion, fechaReportePago: p.fechaReportePago, fechaRetiro: p.fechaRetiro, ...(staff ? { usuario: { id: p.usuario.id, login: p.usuario.login } } : {}), detalles: p.detalles.map((d) => ({ id: d.id, pedidoId: d.pedidoId, productoId: d.productoId, nombre: d.producto.nombre, cantidad: d.cantidad, precioUnitario: num(d.precioUnitario), porcentajeIva: num(d.porcentajeIva), subtotal: num(conIva(dec(d.precioUnitario).times(d.cantidad), d.porcentajeIva)) })) });
const canSeeAll = (user) => hasPermission(user, 'pedidos:leer');

export async function create(req, res) { const order = await createOrder(req.user, req.body); res.location(`/api/v1/pedidos/${order.id}`).status(201).json(orderDto(order)); }
export async function mine(req, res) { const { page, limit, skip } = pagination(req.query); const where = { usuarioId: req.user.id }; const [rows, total] = await Promise.all([orderRepository.list(where, skip, limit), orderRepository.count(where)]); res.json(pageResult(rows.map((x) => orderDto(x)), page, limit, total)); }
export async function all(req, res) { const { page, limit, skip } = pagination(req.query), where = req.query.estado ? { estado: String(req.query.estado) } : {}; const [rows, total] = await Promise.all([orderRepository.list(where, skip, limit), orderRepository.count(where)]); res.json(pageResult(rows.map((x) => orderDto(x, true)), page, limit, total)); }
export async function get(req, res) { const p = await orderRepository.findById(Number(req.params.id)); if (!p || (!canSeeAll(req.user) && p.usuarioId !== req.user.id)) throw new ApiError(404, 'Pedido no encontrado.'); res.json(orderDto(p, canSeeAll(req.user))); }
export async function cancel(req, res) { await cancelOwn(req.user, Number(req.params.id)); res.json({ mensaje: 'Pedido cancelado.' }); }
export async function setState(req, res) { res.json(orderDto(await changeState(req.user, Number(req.params.id), req.body), true)); }
