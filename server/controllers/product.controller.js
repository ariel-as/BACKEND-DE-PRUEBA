import { productRepository } from '../models/product.repository.js';
import { pagination, pageResult } from '../utils/pagination.js';
import { ApiError } from '../utils/ApiError.js';
import { conIva, num, num4 } from '../utils/money.js';
import { createProduct, updateProduct, deactivateProduct, salidaInfo } from '../services/inventory.service.js';

const gymIva = async () => (await productRepository.gym())?.porcentajeIva ?? 0;
function dto(p, gymPct) {
  const iva = p.pagaIva === 'S' ? num(gymPct) : 0;
  return { id: p.id, nombre: p.nombre, descripcion: p.descripcion, categoriaId: p.categoriaId, categoria: p.categoria?.descripcion, unidadMedidaId: p.unidadMedidaId, contenido: p.contenido == null ? null : Number(p.contenido), talla: p.talla, precio: num(p.precioVenta), porcentajeIva: iva, precioConIva: num(conIva(p.precioVenta, iva)), stock: p.stock, disponible: p.estado === 'A' && p.stock > 0, ...salidaInfo(p), createdAt: p.fechaCreacion };
}
const adminDto = (p, pct) => ({ ...dto(p, pct), stockMin: p.stockMin, costoPromedio: num4(p.costoPromedio), pagaIva: p.pagaIva, esContable: p.esContable, diasAlertaCad: p.diasAlertaCad, publicarWeb: p.publicarWeb, estado: p.estado });
export async function list(req, res) { const { page, limit, skip } = pagination(req.query); if (Object.keys(req.query).some((k) => !['page', 'limit', 'categoria'].includes(k))) throw new ApiError(400, 'Hay filtros no permitidos.'); const [rows, total, pct] = await Promise.all([productRepository.list(skip, limit, req.query.categoria), productRepository.count(req.query.categoria), gymIva()]); res.json(pageResult(rows.map((p) => dto(p, pct)), page, limit, total)); }
export async function get(req, res) { const p = await productRepository.findPublished(req.params.id); if (!p) throw new ApiError(404, 'Producto no encontrado.'); res.json(dto(p, await gymIva())); }
export async function adminList(req, res) { const { page, limit, skip } = pagination(req.query); if (Object.keys(req.query).some((k) => !['page', 'limit', 'estado'].includes(k))) throw new ApiError(400, 'Hay filtros no permitidos.'); const where = req.query.estado ? { estado: String(req.query.estado) } : {}; const [rows, total, pct] = await Promise.all([productRepository.adminList(where, skip, limit), productRepository.adminCount(where), gymIva()]); res.json(pageResult(rows.map((p) => adminDto(p, pct)), page, limit, total)); }
export async function create(req, res) { const p = await createProduct(req.body, req.user.empleadoId); res.location(`/api/v1/productos/${encodeURIComponent(p.id)}`).status(201).json(adminDto(p, await gymIva())); }
export async function update(req, res) { const p = await updateProduct(req.params.id, req.body, req.user.empleadoId); res.json(adminDto(p, await gymIva())); }
export async function remove(req, res) { await deactivateProduct(req.params.id); res.status(204).end(); }
