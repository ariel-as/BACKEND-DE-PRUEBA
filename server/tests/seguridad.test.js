import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';
import { tokens, api, cedula } from './helpers.js';

test('seguridad (4.1) y datos del gimnasio (4.2)', async (t) => {
  const tk = await tokens(), adm = api(tk.ADM), rec = api(tk.REC);
  const suf = String(Date.now()).slice(-7), ced = cedula(`170${suf.slice(1)}`), correo = `cuenta-${suf}@planetafitness.ec`;
  let userId;
  await t.test('el panel rechaza un empleado con cédula inválida y acepta una válida', async () => {
    const bad = await adm.post('/admin/entidades/empleado', { id: '1234567890', cargoId: 'REC', nombre: 'Mal', apellido: 'Cedula', fechaIngreso: '2026-01-01', estado: 'A' });
    assert.equal(bad.status, 400);
    const ok = await adm.post('/admin/entidades/empleado', { id: ced, cargoId: 'REC', turnoId: 'TAR', nombre: 'Cuenta', apellido: 'Prueba', fechaIngreso: '2026-01-01', estado: 'A' });
    assert.equal(ok.status, 201, JSON.stringify(ok.body));
  });
  await t.test('ADM crea la cuenta y la lista muestra roles y vínculo; REC no puede listar', async () => {
    const r = await adm.post('/admin/usuarios', { login: correo, password: 'Cuenta12345', roles: ['REC'], empleadoId: ced });
    assert.equal(r.status, 201); userId = r.body.id;
    const list = await adm.get(`/admin/usuarios?buscar=${encodeURIComponent(correo)}`);
    assert.equal(list.status, 200); assert.equal(list.body.data[0].empleado.id, ced); assert.deepEqual(list.body.data[0].roles, ['REC']);
    assert.equal((await rec.get('/admin/usuarios')).status, 403);
  });
  await t.test('reemplazar roles: quitar es pasar a I; no se deja sin roles', async () => {
    const r = await adm.put(`/admin/usuarios/${userId}/roles`, { roles: ['CON'] });
    assert.equal(r.status, 200); assert.deepEqual(r.body.roles, ['CON']); assert.deepEqual(r.body.rolesInactivos, ['REC']);
    assert.equal((await adm.put(`/admin/usuarios/${userId}/roles`, { roles: [] })).status, 400);
    assert.equal((await adm.put(`/admin/usuarios/${userId}/roles`, { roles: ['CLI'] })).status, 409);
  });
  await t.test('ADM no puede quitarse su propio rol de administrador', async () => {
    const me = await adm.get('/auth/me');
    assert.equal((await adm.put(`/admin/usuarios/${me.body.usuario.id}/roles`, { roles: ['REC'] })).status, 409);
  });
  await t.test('cambiar correo y restablecer contraseña', async () => {
    const nuevo = `nuevo-${suf}@planetafitness.ec`;
    const r = await adm.put(`/admin/usuarios/${userId}`, { correo: nuevo, contrasena: 'Nueva12345' });
    assert.equal(r.status, 200); assert.equal(r.body.login, nuevo);
    const login = await request(app).post('/api/v1/auth/login').send({ correo: nuevo, contrasena: 'Nueva12345' });
    assert.equal(login.status, 200); assert.ok(login.body.usuario.permisos.includes('caja:cierre'));
    assert.equal((await adm.put(`/admin/usuarios/${userId}`, { correo: 'admin@planetafitness.ec' })).status, 409);
  });
  await t.test('datos del gimnasio: todos leen, solo ADM edita', async () => {
    const g = await rec.get('/admin/gimnasio');
    assert.equal(g.status, 200); assert.ok(g.body.aforoMax > 0);
    assert.equal((await rec.put('/admin/gimnasio', { aforoMax: 10 })).status, 403);
    const upd = await adm.put('/admin/gimnasio', { aforoMax: g.body.aforoMax, porcentajeIva: g.body.porcentajeIva });
    assert.equal(upd.status, 200); assert.equal(upd.body.aforoMax, g.body.aforoMax);
    assert.equal((await adm.put('/admin/gimnasio', { ruc: 'x' })).status, 400);
  });
  await t.test('horario de atención por día', async () => {
    const h = await rec.get('/admin/gimnasio/horario');
    assert.equal(h.status, 200);
    const dias = h.body.map(({ dia, abierto, horaApertura, horaCierre }) => ({ dia, abierto, horaApertura, horaCierre }));
    assert.equal((await adm.put('/admin/gimnasio/horario', { dias: [{ dia: 'Lunes', abierto: 'S', horaApertura: '10:00', horaCierre: '09:00' }] })).status, 400);
    const upd = await adm.put('/admin/gimnasio/horario', { dias });
    assert.equal(upd.status, 200); assert.equal(upd.body.length, dias.length);
  });
});
