import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';
import { env } from '../config/env.js';

test('CORS en su propio middleware', async (t) => {
  const permitido = env.corsOrigins[0], ajeno = 'https://sitio-no-permitido.example';
  await t.test('un origen permitido recibe Access-Control-Allow-Origin y las cabeceras expuestas', async () => {
    const r = await request(app).get('/api/v1/salud').set('Origin', permitido);
    assert.equal(r.status, 200);
    assert.equal(r.headers['access-control-allow-origin'], permitido);
    assert.match(r.headers['access-control-expose-headers'], /Location/);
    assert.match(r.headers['access-control-expose-headers'], /RateLimit/);
  });
  await t.test('el preflight de un origen permitido responde 204 con métodos y cabeceras', async () => {
    const r = await request(app).options('/api/v1/pedidos').set('Origin', permitido).set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'Authorization,Content-Type');
    assert.equal(r.status, 204);
    assert.match(r.headers['access-control-allow-methods'], /PATCH/);
    assert.match(r.headers['access-control-allow-headers'], /Authorization/);
  });
  await t.test('un origen no permitido recibe 403 con el formato de errores, también en OPTIONS', async () => {
    const r = await request(app).get('/api/v1/salud').set('Origin', ajeno);
    assert.equal(r.status, 403); assert.equal(r.body.mensaje, 'Origen no permitido por CORS'); assert.ok(r.body.correlationId);
    assert.equal(r.headers['access-control-allow-origin'], undefined);
    const p = await request(app).options('/api/v1/pedidos').set('Origin', ajeno).set('Access-Control-Request-Method', 'POST');
    assert.equal(p.status, 403); assert.equal(p.body.mensaje, 'Origen no permitido por CORS');
  });
  await t.test('una petición sin Origin funciona', async () => {
    const r = await request(app).get('/api/v1/salud');
    assert.equal(r.status, 200); assert.equal(r.headers['access-control-allow-origin'], undefined);
  });
});
