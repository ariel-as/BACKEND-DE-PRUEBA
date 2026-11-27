import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api } from './helpers.js';

test('imagen por enlace de productos', async (t) => {
  const tk = await tokens(), adm = api(tk.ADM);
  const id = `IM${Date.now()}`.slice(0, 13), url = 'https://cdn.example.com/img/proteina.png', url2 = 'https://images.example.org/a.jpg?w=400';
  const base = { id, nombre: 'Producto con imagen', categoriaId: 'ACC', precio: 5, stock: 0, stockMin: 0, costoUnit: 1, pagaIva: 'N', esContable: 'S', controlaCaducidad: 'N', publicarWeb: 'S', estado: 'A' };
  await t.test('guardar, cambiar y quitar la URL', async () => {
    const c = await adm.post('/productos', { ...base, imagenUrl: url });
    assert.equal(c.status, 201, JSON.stringify(c.body)); assert.equal(c.body.imagenUrl, url);
    assert.equal((await adm.get(`/admin/productos/${id}`)).body.imagenUrl, url);
    assert.equal((await adm.get(`/productos/${id}`)).body.imagenUrl, url);
    const u = await adm.put(`/productos/${id}`, { imagenUrl: url2 });
    assert.equal(u.status, 200, JSON.stringify(u.body)); assert.equal(u.body.imagenUrl, url2);
    const lista = await adm.get('/admin/productos?limit=100');
    assert.ok(lista.body.data.every((p) => 'imagenUrl' in p));
    assert.ok(((await adm.get('/productos?limit=100')).body.data).every((p) => 'imagenUrl' in p));
    assert.equal((await adm.put(`/productos/${id}`, { imagenUrl: '' })).body.imagenUrl, null);
    assert.equal((await adm.put(`/productos/${id}`, { imagenUrl: url })).body.imagenUrl, url);
    assert.equal((await adm.put(`/productos/${id}`, { imagenUrl: null })).body.imagenUrl, null);
  });
  await t.test('rechaza http, javascript, data, texto inválido y largo', async () => {
    for (const bad of ['http://cdn.example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'no es una url', 'https://', 'https:// con espacios.com', `https://example.com/${'a'.repeat(290)}`]) {
      const r = await adm.put(`/productos/${id}`, { imagenUrl: bad });
      assert.equal(r.status, 400, bad); assert.match(JSON.stringify(r.body), /imagenUrl/);
    }
    const c = await adm.post('/productos', { ...base, id: `${id}`.slice(0, 11) + 'X', imagenUrl: 'http://x.com/a.png' });
    assert.equal(c.status, 400);
  });
});
