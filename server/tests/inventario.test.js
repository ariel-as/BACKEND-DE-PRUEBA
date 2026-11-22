import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api } from './helpers.js';
import { prisma } from '../config/prisma.js';

test('inventario: recepción, ajustes, bajas, lotes y kárdex (4.13)', async (t) => {
  const tk = await tokens(), adm = api(tk.ADM), rec = api(tk.REC), con = api(tk.CON);
  const id = `PI${Date.now()}`.slice(0, 13);
  const future = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10), soon = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  assert.equal((await adm.post('/productos', { id, nombre: 'Suplemento de inventario', categoriaId: 'SUP', precio: 20, stock: 0, stockMin: 2, pagaIva: 'S', esContable: 'S', controlaCaducidad: 'S', publicarWeb: 'N', estado: 'A' })).status, 201);
  let lote;
  await t.test('permisos: REC y CON leen; solo ADM registra movimientos', async () => {
    assert.equal((await rec.post('/admin/inventario/entradas', { productoId: id, cantidad: 1, costoUnit: 5, fechaCaducidad: future })).status, 403);
    assert.equal((await con.get('/admin/inventario/lotes')).status, 200);
    assert.equal((await rec.get(`/admin/inventario/kardex/${id}`)).status, 200);
  });
  await t.test('recibir mercadería sin orden: la caducidad es obligatoria si el producto la controla', async () => {
    assert.equal((await adm.post('/admin/inventario/entradas', { productoId: id, cantidad: 10, costoUnit: 8 })).status, 400);
    const r = await adm.post('/admin/inventario/entradas', { productoId: id, cantidad: 10, costoUnit: 8, fechaCaducidad: future, numFabricante: 'FAB-01' });
    assert.equal(r.status, 201, JSON.stringify(r.body)); assert.equal(r.body.stock, 10); assert.equal(r.body.costoPromedio, 8); lote = r.body.lote;
    const r2 = await adm.post('/admin/inventario/entradas', { productoId: id, cantidad: 10, costoUnit: 12, fechaCaducidad: soon });
    assert.equal(r2.body.stock, 20); assert.equal(r2.body.costoPromedio, 10);
  });
  await t.test('ajustes con observación obligatoria; el negativo sale por FEFO', async () => {
    assert.equal((await adm.post('/admin/inventario/ajustes', { productoId: id, cantidad: -2 })).status, 400);
    const r = await adm.post('/admin/inventario/ajustes', { productoId: id, cantidad: -3, observacion: 'Producto dañado' });
    assert.equal(r.status, 201); assert.equal(r.body.stock, 17);
    const lotes = await prisma.loteProducto.findMany({ where: { productoId: id }, orderBy: { fechaCaducidad: 'asc' } });
    assert.equal(lotes[0].cantidadDisponible, 7);
    assert.equal((await adm.post('/admin/inventario/ajustes', { productoId: id, cantidad: -999, observacion: 'Demasiado' })).status, 409);
  });
  await t.test('lotes por caducar y bloqueo de un lote', async () => {
    const r = await con.get(`/admin/inventario/lotes?productoId=${id}&porCaducar=S`);
    assert.equal(r.status, 200); assert.equal(r.body.data.length, 1); assert.equal(r.body.data[0].fechaCaducidad, soon);
    const b = await adm.patch(`/admin/inventario/lotes/${lote.id}/bloqueo`, { bloquear: true });
    assert.equal(b.status, 200); assert.equal(b.body.estado, 'B');
    assert.equal((await adm.patch(`/admin/inventario/lotes/${lote.id}/bloqueo`, { bloquear: true })).status, 409);
    assert.equal((await adm.patch(`/admin/inventario/lotes/${lote.id}/bloqueo`, { bloquear: false })).body.estado, 'D');
  });
  await t.test('baja por caducidad solo de lotes vencidos', async () => {
    assert.equal((await adm.post(`/admin/inventario/lotes/${lote.id}/baja`, { observacion: 'No venció' })).status, 409);
    const vencido = await prisma.loteProducto.findFirst({ where: { productoId: id, fechaCaducidad: new Date(`${soon}T12:00:00-05:00`) } });
    await prisma.loteProducto.update({ where: { id: vencido.id }, data: { fechaIngreso: new Date('2020-01-01T17:00:00Z'), fechaCaducidad: new Date('2020-06-01T17:00:00Z') } });
    const r = await adm.post(`/admin/inventario/lotes/${vencido.id}/baja`, { observacion: 'Lote caducado' });
    assert.equal(r.status, 201, JSON.stringify(r.body)); assert.equal(r.body.cantidadBaja, 7); assert.equal(r.body.stock, 10);
    assert.equal((await prisma.loteProducto.findUnique({ where: { id: vencido.id } })).estado, 'C');
  });
  await t.test('el kárdex cuadra con el stock', async () => {
    const r = await rec.get(`/admin/inventario/kardex/${id}?limit=100`);
    assert.equal(r.status, 200); assert.equal(r.body.producto.cuadra, true);
    const last = r.body.data.at(-1);
    assert.equal(last.saldoCantidad, r.body.producto.stock); assert.equal(r.body.producto.stock, r.body.producto.sumaLotes);
    assert.deepEqual(r.body.data.map((k) => k.tipo), ['COM', 'COM', 'AJN', 'CAD']);
  });
  await t.test('proveedores del producto', async () => {
    const r = await adm.put(`/admin/productos/${id}/proveedores`, { proveedores: ['1790000000001'] });
    assert.equal(r.status, 200); assert.equal(r.body[0].proveedorId, '1790000000001');
    assert.equal((await adm.put(`/admin/productos/${id}/proveedores`, { proveedores: ['0000000000000'] })).status, 400);
    assert.equal((await con.get(`/admin/productos/${id}/proveedores`)).body.length, 1);
    assert.equal((await rec.put(`/admin/productos/${id}/proveedores`, { proveedores: [] })).status, 403);
  });
});
