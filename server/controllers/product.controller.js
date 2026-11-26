import { productRepository } from '../models/product.repository.js';
import { pagination, pageResult } from '../utils/pagination.js';
import { ApiError } from '../utils/ApiError.js';
import { conIva, num, num4 } from '../utils/money.js';
import { createProduct, updateProduct, deactivateProduct, salidaInfo, proximasCaducidades, caducidadDe } from '../services/inventory.service.js';

const gymIva = async () => (await productRepository.gym())?.porcentajeIva ?? 0;
const urls = (p) => (p.imagenes ?? []).map((i) => i.fotoUrl);
function dto(p, gymPct) {
  const iva = p.pagaIva === 'S' ? num(gymPct) : 0;
  return { id: p.id, nombre: p.nombre, descripcion: p.descripcion, categoriaId: p.categoriaId, categoria: p.categoria?.descripcion, unidadMedidaId: p.unidadMedidaId, contenido: p.contenido == null ? null : Number(p.contenido), talla: p.talla, precio: num(p.precioVenta), porcentajeIva: iva, precioConIva: num(conIva(p.precioVenta, iva)), stock: p.stock, disponible: p.estado === 'A' && p.stock > 0, fotos: urls(p), ...salidaInfo(p), createdAt: p.fechaCreacion };
}
const adminDto = (p, pct, exp = {}) => ({ ...dto(p, pct), stockMin: p.stockMin, costoPromedio: num4(p.costoPromedio), pagaIva: p.pagaIva, esContable: p.esContable, diasAlertaCad: p.diasAlertaCad, publicarWeb: p.publicarWeb, estado: p.estado, proximaCaducidad: exp.proximaCaducidad ?? null, diasParaCaducar: exp.diasParaCaducar ?? null });
export async function list(req, res) { const { page, limit, skip } = pagination(req.query); if (Object.keys(req.query).some((k) => !['page', 'limit', 'categoria'].includes(k))) throw new ApiError(400, 'Hay filtros no permitidos.'); const [rows, total, pct] = await Promise.all([productRepository.list(skip, limit, req.query.categoria), productRepository.count(req.query.categoria), gymIva()]); res.json(pageResult(rows.map((p) => dto(p, pct)), page, limit, total)); }
export async function get(req, res) { const p = await productRepository.findPublished(req.params.id); if (!p) throw new ApiError(404, 'Producto no encontrado.'); res.json(dto(p, await gymIva())); }
export async function adminList(req, res) {
  const { page, limit, skip } = pagination(req.query);
  if (Object.keys(req.query).some((k) => !['page', 'limit', 'estado', 'orden'].includes(k))) throw new ApiError(400, 'Hay filtros no permitidos.');
  const orden = req.query.orden;
  if (orden && orden !== 'caducidad') throw new ApiError(400, 'orden solo admite caducidad.');
  const where = req.query.estado ? { estado: String(req.query.estado) } : {};
  const [rows, total, pct, proximas] = await Promise.all([
    productRepository.adminList(where, orden === 'caducidad' ? 0 : skip, orden === 'caducidad' ? 10000 : limit),
    productRepository.adminCount(where), gymIva(), proximasCaducidades()
  ]);
  let mapped = rows.map((p) => adminDto(p, pct, caducidadDe(p, proximas)));
  if (orden === 'caducidad') mapped = mapped.sort((a, b) => {
    if (a.proximaCaducidad === b.proximaCaducidad) return a.id.localeCompare(b.id);
    if (!a.proximaCaducidad) return 1;
    if (!b.proximaCaducidad) return -1;
    return a.proximaCaducidad.localeCompare(b.proximaCaducidad);
  });
  res.json(pageResult(orden === 'caducidad' ? mapped.slice(skip, skip + limit) : mapped, page, limit, total));
}
export async function adminGet(req, res) {
  const p = await productRepository.findById(req.params.id);
  if (!p) throw new ApiError(404, 'Producto no encontrado.');
  res.json(adminDto(p, await gymIva(), caducidadDe(p, await proximasCaducidades())));
}
export async function create(req, res) { const p = await createProduct(req.body, req.user.empleadoId); res.location(`/api/v1/productos/${encodeURIComponent(p.id)}`).status(201).json(adminDto(p, await gymIva())); }
export async function update(req, res) { const p = await updateProduct(req.params.id, req.body, req.user.empleadoId); res.json(adminDto(p, await gymIva())); }
export async function remove(req, res) { await deactivateProduct(req.params.id); res.status(204).end(); }
export async function listFotos(req, res) {
  if (!await productRepository.findById(req.params.id)) throw new ApiError(404, 'Producto no encontrado.');
  res.json((await productRepository.listFotos(req.params.id)).map(({ id, fotoUrl }) => ({ id, fotoUrl })));
}
export async function createFoto(req, res) {
  if (!await productRepository.findById(req.params.id)) throw new ApiError(404, 'Producto no encontrado.');
  const foto = await productRepository.createFoto(req.params.id, req.body.fotoUrl);
  res.status(201).json({ id: foto.id, productoId: foto.productoId, fotoUrl: foto.fotoUrl });
}
export async function deleteFoto(req, res) {
  const foto = await productRepository.findFoto(Number(req.params.id));
  if (!foto) throw new ApiError(404, 'Foto no encontrada.');
  await productRepository.deleteFoto(foto.id);
  res.status(204).end();
}
