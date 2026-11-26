import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';
import { tokens, api } from './helpers.js';
import { prisma } from '../config/prisma.js';

test('correcciones fase 3 §4: tabla imagen y fotos de productos', async () => {
  const tk = await tokens(), adm = api(tk.ADM), cli = api(tk.CLI);
  const id = `PIM${Date.now()}`.slice(0, 13);
  try {
    const creado = await adm.post('/productos', { id, nombre: 'Producto con fotos', categoriaId: 'SUP', precio: 10, stockMin: 5, publicarWeb: 'S', estado: 'A' });
    assert.equal(creado.status, 201, JSON.stringify(creado.body));
    assert.deepEqual((await request(app).get(`/api/v1/productos/${id}`)).body.fotos, []);
    assert.equal((await cli.get(`/admin/productos/${id}/fotos`)).status, 403);
    const una = await adm.post(`/admin/productos/${id}/fotos`, { fotoUrl: 'https://cdn.example.com/p1.jpg' });
    assert.equal(una.status, 201, JSON.stringify(una.body));
    assert.equal(una.body.productoId, id);
    const dos = await adm.post(`/admin/productos/${id}/fotos`, { fotoUrl: 'https://cdn.example.com/p2.jpg' });
    assert.equal(dos.status, 201);
    assert.equal((await adm.post(`/admin/productos/${id}/fotos`, { fotoUrl: 'x', extra: 1 })).status, 400);
    assert.equal((await adm.get('/admin/productos/NOEXISTE/fotos')).status, 404);
    const listado = await adm.get(`/admin/productos/${id}/fotos`);
    assert.equal(listado.status, 200);
    assert.deepEqual(listado.body.map((f) => f.fotoUrl), ['https://cdn.example.com/p1.jpg', 'https://cdn.example.com/p2.jpg']);
    assert.deepEqual((await request(app).get(`/api/v1/productos/${id}`)).body.fotos, ['https://cdn.example.com/p1.jpg', 'https://cdn.example.com/p2.jpg']);
    assert.deepEqual((await adm.get(`/admin/productos/${id}`)).body.fotos, ['https://cdn.example.com/p1.jpg', 'https://cdn.example.com/p2.jpg']);
    const tablas = await adm.get('/admin/tablas');
    assert.ok(tablas.body.some((t) => t.tabla === 'imagen'));
    const panel = await adm.post('/admin/tablas/imagen', { productoId: id, fotoUrl: 'https://cdn.example.com/p3.jpg' });
    assert.equal(panel.status, 201, JSON.stringify(panel.body));
    assert.equal((await adm.get('/admin/tablas/imagen')).status, 200);
    assert.equal((await adm.delete(`/admin/fotos/${dos.body.id}`)).status, 204);
    assert.equal((await adm.delete(`/admin/fotos/${dos.body.id}`)).status, 404);
    assert.deepEqual((await adm.get(`/admin/productos/${id}/fotos`)).body.map((f) => f.fotoUrl), ['https://cdn.example.com/p1.jpg', 'https://cdn.example.com/p3.jpg']);
  } finally {
    await prisma.imagen.deleteMany({ where: { productoId: id } });
    await prisma.producto.updateMany({ where: { id }, data: { estado: 'I', publicarWeb: 'N' } });
  }
});
