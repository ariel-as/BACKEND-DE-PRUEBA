import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api } from './helpers.js';
import { prisma } from '../config/prisma.js';

test('matriz de permisos por rol (sección 3)', async (t) => {
  const tk = await tokens();
  const as = (rol) => api(tk[rol]);
  const expect = async (rol, method, url, status, body) => { const r = await as(rol)[method](url, body); assert.equal(r.status, status, `${rol} ${method.toUpperCase()} ${url} → ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`); return r; };

  await t.test('/auth/me devuelve los permisos de cada rol', async () => {
    const rec = await expect('REC', 'get', '/auth/me', 200), con = await expect('CON', 'get', '/auth/me', 200), adm = await expect('ADM', 'get', '/auth/me', 200), cli = await expect('CLI', 'get', '/auth/me', 200);
    assert.ok(rec.body.usuario.permisos.includes('caja:operar'));
    assert.ok(!rec.body.usuario.permisos.includes('usuarios:gestionar'));
    assert.ok(con.body.usuario.permisos.includes('caja:cierre'));
    assert.ok(adm.body.usuario.permisos.includes('usuarios:gestionar'));
    assert.deepEqual(cli.body.usuario.permisos, []);
    assert.ok(!('empleadoActivo' in rec.body.usuario));
  });
  await t.test('resumen: cada rol recibe sus indicadores; el cliente no entra', async () => {
    const rec = await expect('REC', 'get', '/admin/resumen', 200), con = await expect('CON', 'get', '/admin/resumen', 200), ent = await expect('ENT', 'get', '/admin/resumen', 200);
    assert.ok('pedidosPendientes' in rec.body && !('bajoStock' in rec.body));
    assert.ok('bajoStock' in con.body && !('mensajesPendientes' in con.body));
    assert.ok('misRutinas' in ent.body);
    await expect('CLI', 'get', '/admin/resumen', 403);
  });
  await t.test('panel genérico: CON lee, REC y ENT solo sus catálogos, escritura solo ADM', async () => {
    await expect('CON', 'get', '/admin/tablas/kardex', 200);
    await expect('REC', 'get', '/admin/tablas/kardex', 403);
    await expect('ENT', 'get', '/admin/tablas/kardex', 403);
    await expect('REC', 'get', '/admin/entidades/cargo', 200);
    await expect('CON', 'post', '/admin/entidades/cargo', 403, { id: 'XXX', descripcion: 'Prueba' });
    const lista = await expect('REC', 'get', '/admin/tablas', 200);
    assert.ok(lista.body.some((x) => x.tabla === 'cargo' && x.modo === 'lectura'));
    assert.ok(!lista.body.some((x) => x.tabla === 'kardex'));
  });
  await t.test('el entrenador solo ve sus clases', async () => {
    const r = await expect('ENT', 'get', '/admin/entidades/clase', 200);
    const emp = await prisma.empleado.findFirst({ where: { usuario: { login: 'entrenador@planetafitness.ec' } } });
    assert.ok(r.body.data.every((c) => c.empleadoId === emp.id));
  });
  await t.test('productos: REC y CON leen, solo ADM edita', async () => {
    await expect('REC', 'get', '/admin/productos', 200);
    await expect('ENT', 'get', '/admin/productos', 403);
    await expect('CON', 'post', '/productos', 403, {});
  });
  await t.test('pedidos: REC y CON leen; solo REC gestiona', async () => {
    await expect('REC', 'get', '/pedidos', 200);
    await expect('CON', 'get', '/pedidos', 200);
    await expect('ENT', 'get', '/pedidos', 403);
    await expect('CON', 'patch', '/pedidos/1/estado', 403, { estado: 'X' });
  });
  await t.test('usuarios: solo ADM', async () => {
    await expect('REC', 'post', '/admin/usuarios', 403, {});
    await expect('CON', 'patch', '/admin/usuarios/1/estado', 403, { estado: 'A' });
  });
});
