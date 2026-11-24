import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';
import { tokens, api, ensureShift, cedula } from './helpers.js';
import { prisma } from '../config/prisma.js';

const hoy = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const mas = (s, n) => { const d = new Date(`${s}T12:00:00-05:00`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dia = (s) => new Date(`${s}T12:00:00-05:00`);
const digitos = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
const detalleRutina = () => ({ editable: true, dias: [{ nombre: 'Día 1', ejercicios: [{ nombre: 'Sentadilla', grupo: 'Pierna', series: 3, repeticiones: 12, descanso: '60s', nota: 'Rodillas alineadas.' }] }] });

test('prioridad 3: asistencia, suspensiones, anulación, compras, rutinas, aliados y mensajes', async (t) => {
  const tk = await tokens(), adm = api(tk.ADM), rec = api(tk.REC), ent = api(tk.ENT), con = api(tk.CON), cli = api(tk.CLI);
  await ensureShift(tk.REC);
  const suf = String(Date.now()).slice(-6), a = cedula(`170${suf}`), b = cedula(`171${suf}`);
  for (const [ced, nombre] of [[a, 'Sara'], [b, 'Tomás']]) assert.equal((await rec.post('/admin/clientes', { cedula: ced, nombre, apellido: 'Prioridad' })).status, 201);
  const inscribir = async (clienteId, membresiaId, monto) => { const r = await rec.post('/admin/inscripciones', { clienteId, membresiaId, pagos: [{ metodoPago: 'EF', monto }] }); assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body; };

  await t.test('asistencia del personal: entrada, repetida, salida, permisos y reporte con atraso y falta', async () => {
    const REC = '1700000050';
    await prisma.asistenciaEmpleado.deleteMany({ where: { empleadoId: REC, fecha: { in: [dia(hoy()), dia(mas(hoy(), -1)), dia(mas(hoy(), -2))] } } });
    const e = await rec.post('/admin/personal/asistencia/entrada', {});
    assert.equal(e.status, 201, JSON.stringify(e.body)); assert.equal(e.body.empleadoId, REC);
    const again = await rec.post('/admin/personal/asistencia/entrada', {});
    assert.equal(again.status, 409); assert.match(again.body.mensaje, /ya marcó la entrada/);
    assert.equal((await rec.post('/admin/personal/asistencia/entrada', { empleadoId: '1711111110' })).status, 403);
    await prisma.asistenciaEmpleado.update({ where: { id: e.body.id }, data: { horaEntrada: '00:00' } });
    const s = await rec.post('/admin/personal/asistencia/salida', {});
    assert.equal(s.status, 200); assert.ok(s.body.horaSalida);
    assert.equal((await rec.post('/admin/personal/asistencia/salida', {})).status, 409);
    // Ayer entró a las 07:00 con turno de 06:00 (60 minutos de atraso); anteayer no marcó.
    await prisma.asistenciaEmpleado.create({ data: { empleadoId: REC, fecha: dia(mas(hoy(), -1)), horaEntrada: '07:00', horaSalida: '10:00' } });
    assert.equal((await rec.get('/admin/personal/asistencia')).status, 403);
    assert.equal((await ent.get('/admin/personal/asistencia')).status, 403);
    const r = await con.get(`/admin/personal/asistencia?desde=${mas(hoy(), -2)}&hasta=${mas(hoy(), -1)}&empleadoId=${REC}`);
    assert.equal(r.status, 200);
    const fila = r.body.empleados[0], ayer = fila.detalle.find((d) => d.fecha === mas(hoy(), -1)), anteayer = fila.detalle.find((d) => d.fecha === mas(hoy(), -2));
    if (ayer) { assert.equal(ayer.estado, 'atraso'); assert.equal(ayer.minutosAtraso, 60); }
    if (anteayer) assert.equal(anteayer.estado, 'falta');
    const corr = await adm.patch(`/admin/personal/asistencia/${e.body.id}`, { horaEntrada: '06:00', observacion: 'Corrección' });
    assert.equal(corr.status, 200); assert.equal(corr.body.horaEntrada, '06:00');
  });

  let mensual;
  await t.test('suspensión médica: suma días, sin solaparse, solo planes por tiempo; anularla resta los días (ADM)', async () => {
    mensual = await inscribir(a, 'MI1', 35);
    const fin = mensual.fechaFin;
    const s = await rec.post(`/admin/inscripciones/${mensual.id}/suspensiones`, { fechaInicio: mas(hoy(), 1), fechaFin: mas(hoy(), 5), motivo: 'Esguince de tobillo', certificado: 'CERT-001' });
    assert.equal(s.status, 201, JSON.stringify(s.body)); assert.equal(s.body.fechaFin, mas(fin, 5));
    const choque = await rec.post(`/admin/inscripciones/${mensual.id}/suspensiones`, { fechaInicio: mas(hoy(), 3), fechaFin: mas(hoy(), 8), motivo: 'Otra lesión', certificado: 'CERT-002' });
    assert.equal(choque.status, 409); assert.match(choque.body.mensaje, /Se cruza/);
    const tarjeta = await inscribir(b, 'TAR', 40);
    assert.equal((await rec.post(`/admin/inscripciones/${tarjeta.id}/suspensiones`, { fechaInicio: mas(hoy(), 1), fechaFin: mas(hoy(), 2), motivo: 'Gripe fuerte', certificado: 'CERT-003' })).status, 409);
    const susId = s.body.suspensiones[0].id;
    assert.equal((await rec.patch(`/admin/suspensiones/${susId}/anular`, { motivo: 'Certificado equivocado' })).status, 403);
    const x = await adm.patch(`/admin/suspensiones/${susId}/anular`, { motivo: 'Certificado equivocado' });
    assert.equal(x.status, 200); assert.equal(x.body.fechaFin, fin); assert.equal(x.body.suspensiones[0].estado, 'X');
    assert.equal((await adm.patch(`/admin/suspensiones/${susId}/anular`, { motivo: 'Otra vez' })).status, 409);
  });

  await t.test('anular inscripción: con entradas se rechaza; sin entradas anula pagos, devuelve en caja, factura por anular y (A4) sus suspensiones', async () => {
    const usada = await inscribir(b, 'MI1', 35);
    assert.equal((await rec.post('/admin/entradas', { clienteId: b, inscripcionId: usada.id })).status, 201);
    const r1 = await adm.patch(`/admin/inscripciones/${usada.id}/anular`, { motivo: 'Cliente se arrepintió' });
    assert.equal(r1.status, 409); assert.match(r1.body.mensaje, /entrada/);
    const ins = await inscribir(a, 'MI2', 60);
    assert.equal((await rec.post(`/admin/inscripciones/${ins.id}/suspensiones`, { fechaInicio: mas(hoy(), 2), fechaFin: mas(hoy(), 4), motivo: 'Reposo médico', certificado: 'CERT-010' })).status, 201);
    const f = await con.post('/admin/facturas', { inscripcionId: ins.id });
    assert.equal(f.status, 201, JSON.stringify(f.body));
    assert.equal(f.body.estado, 'E');
    assert.equal((await con.patch(`/admin/facturas/${f.body.id}/sri`, { numComprobante: `001-001-${digitos(9)}`, claveAcceso: digitos(49) })).status, 200);
    assert.equal((await rec.patch(`/admin/inscripciones/${ins.id}/anular`, { motivo: 'Error de cobro' })).status, 403);
    const x = await adm.patch(`/admin/inscripciones/${ins.id}/anular`, { motivo: 'Error de cobro' });
    assert.equal(x.status, 200, JSON.stringify(x.body)); assert.equal(x.body.estado, 'X');
    assert.ok(x.body.pagos.every((p) => p.estado === 'A'));
    assert.ok(x.body.suspensiones.length === 1 && x.body.suspensiones.every((s) => s.estado === 'X'));
    const dev = await prisma.movimientoCaja.count({ where: { tipoMovimientoId: 'DEV', pagoIdRef1: { inscripcionId: ins.id } } });
    assert.equal(dev, x.body.pagos.length);
    const porAnular = await con.get('/admin/facturas/por-anular?limit=100');
    assert.ok(porAnular.body.data.some((y) => y.id === f.body.id));
    assert.equal((await adm.patch(`/admin/inscripciones/${ins.id}/anular`, { motivo: 'Otra vez' })).status, 409);
  });

  await t.test('órdenes de compra: crear, autorizar, recibir en partes y completa', async () => {
    const antes = (await prisma.producto.findUnique({ where: { id: 'PF0001' } })).stock;
    const body = { proveedorId: '1790000000001', items: [{ productoId: 'PF0001', cantidad: 5, costoUnit: 2 }, { productoId: 'PF0004', cantidad: 3, costoUnit: 1.5 }] };
    assert.equal((await con.post('/admin/compras', body)).status, 403);
    const o = await adm.post('/admin/compras', body);
    assert.equal(o.status, 201, JSON.stringify(o.body)); assert.equal(o.body.estado, 'P'); assert.equal(o.body.monto, 14.5);
    assert.equal((await con.get(`/admin/compras/${o.body.id}`)).status, 200);
    assert.equal((await adm.post(`/admin/compras/${o.body.id}/recepciones`, { items: [{ productoId: 'PF0001', cantidad: 1 }] })).status, 409);
    const au = await adm.patch(`/admin/compras/${o.body.id}/autorizar`);
    assert.equal(au.status, 200); assert.equal(au.body.estado, 'A'); assert.equal(au.body.empAutorizaId, '1711111110');
    const p1 = await adm.post(`/admin/compras/${o.body.id}/recepciones`, { items: [{ productoId: 'PF0001', cantidad: 3, fechaCaducidad: '2027-06-30' }] });
    assert.equal(p1.status, 201, JSON.stringify(p1.body)); assert.equal(p1.body.estado, 'M');
    const over = await adm.post(`/admin/compras/${o.body.id}/recepciones`, { items: [{ productoId: 'PF0001', cantidad: 3, fechaCaducidad: '2027-06-30' }] });
    assert.equal(over.status, 409); assert.match(over.body.mensaje, /quedan 2/);
    const p2 = await adm.post(`/admin/compras/${o.body.id}/recepciones`, { items: [{ productoId: 'PF0001', cantidad: 2, fechaCaducidad: '2027-06-30' }, { productoId: 'PF0004', cantidad: 3, fechaCaducidad: '2027-06-30' }] });
    assert.equal(p2.status, 201, JSON.stringify(p2.body)); assert.equal(p2.body.estado, 'R');
    assert.ok(p2.body.items.every((i) => i.pendiente === 0 && i.lotes.length >= 1));
    assert.equal((await prisma.producto.findUnique({ where: { id: 'PF0001' } })).stock, antes + 5);
    assert.equal((await adm.patch(`/admin/compras/${o.body.id}/anular`)).status, 409);
    const otra = await adm.post('/admin/compras', body);
    assert.equal((await adm.patch(`/admin/compras/${otra.body.id}/anular`)).body.estado, 'X');
  });

  await t.test('rutinas: el entrenador crea para clientes con plan que incluye rutina; REC solo lee; el cliente ve la suya', async () => {
    const r = await ent.post('/admin/rutinas', { clienteId: a, nivelId: 'PRI', objetivo: 'Tonificar', detalle: detalleRutina() });
    assert.equal(r.status, 201, JSON.stringify(r.body)); assert.equal(r.body.empleadoId, '1700000068');
    assert.equal(Array.isArray(r.body.detalle.dias), true);
    const diario = await inscribir(b, 'PDI', 3); void diario;
    const sinPlan = cedula(`172${suf}`);
    assert.equal((await rec.post('/admin/clientes', { cedula: sinPlan, nombre: 'Uriel', apellido: 'Prioridad' })).status, 201);
    assert.equal((await ent.post('/admin/rutinas', { clienteId: sinPlan, nivelId: 'PRI', objetivo: 'Bajar de peso', detalle: detalleRutina() })).status, 409);
    assert.equal((await rec.post('/admin/rutinas', { clienteId: a, nivelId: 'PRI', objetivo: 'Otra', detalle: detalleRutina() })).status, 403);
    assert.equal((await rec.get(`/admin/rutinas?clienteId=${a}`)).body.data.length >= 1, true);
    const u = await ent.put(`/admin/rutinas/${r.body.id}`, { objetivo: 'Tonificar y resistencia' });
    assert.equal(u.status, 200); assert.equal(u.body.objetivo, 'Tonificar y resistencia');
    // Rutina vigente del cliente web.
    await inscribir('1712345675', 'MI1', 35);
    const mia = await ent.post('/admin/rutinas', { clienteId: '1712345675', nivelId: 'PRI', objetivo: 'Fuerza', detalle: detalleRutina() });
    assert.equal(mia.status, 201, JSON.stringify(mia.body));
    const v = await cli.get('/rutinas/mi-rutina');
    assert.equal(v.status, 200); assert.equal(v.body.id, mia.body.id);
    assert.equal(v.body.detalle.dias[0].ejercicios[0].series, 3);
  });

  await t.test('comisiones de aliados: cobrar, sin solaparse, pagados y pendientes, reporte', async () => {
    const anio = 2100 + Math.floor(Math.random() * 800);
    const periodo = { fechaDesde: `${anio}-01-01`, fechaHasta: `${anio}-01-31`, metodoPago: 'EF' };
    assert.equal((await ent.post('/admin/aliados/1700000043/comisiones', periodo)).status, 403);
    const c = await rec.post('/admin/aliados/1700000043/comisiones', periodo);
    assert.equal(c.status, 201, JSON.stringify(c.body)); assert.equal(c.body.monto, 50);
    const mov = await prisma.movimientoCaja.findFirst({ where: { comisionAliadoId: c.body.id } });
    assert.equal(mov.tipoMovimientoId, 'ING');
    assert.equal((await rec.post('/admin/aliados/1700000043/comisiones', { ...periodo, fechaDesde: `${anio}-01-15`, fechaHasta: `${anio}-02-15` })).status, 409);
    assert.equal((await rec.post('/admin/aliados/1700000043/comisiones', { ...periodo, fechaDesde: `${anio}-03-01`, fechaHasta: `${anio}-03-31`, metodoPago: 'TR' })).status, 400);
    const st = await con.get(`/admin/aliados/comisiones?cedula=1700000043&desde=${anio}-01-01&hasta=${anio}-12-31`);
    assert.equal(st.status, 200);
    const al = st.body.aliados[0];
    assert.ok(al.pagados.some((p) => p.id === c.body.id)); assert.equal(al.pendientes.length, 11);
    const rep = await con.get('/admin/reportes/comisiones');
    assert.ok(rep.body.comisiones.some((x) => x.id === c.body.id));
  });

  await t.test('mensajes de contacto: bandeja y marcar respondido', async () => {
    const m = await request(app).post('/api/v1/contacto').send({ nombre: 'Visitante', correo: 'visitante@correo.ec', mensaje: 'Quiero información de los planes.' });
    assert.equal(m.status, 201);
    assert.equal((await ent.get('/admin/mensajes')).status, 403);
    const l = await rec.get('/admin/mensajes?estado=P&limit=100');
    const msg = l.body.data.find((x) => x.mensaje === 'Quiero información de los planes.' && x.estado === 'P');
    assert.ok(msg); assert.ok(l.body.pendientes >= 1);
    const r = await rec.patch(`/admin/mensajes/${msg.id}/respondido`);
    assert.equal(r.status, 200); assert.equal(r.body.estado, 'R'); assert.equal(r.body.empleadoId, '1700000050');
    assert.equal((await rec.patch(`/admin/mensajes/${msg.id}/respondido`)).status, 409);
  });
  await prisma.$disconnect();
});
