import test from 'node:test';
import assert from 'node:assert/strict';
import { tokens, api, ensureShift, cedula } from './helpers.js';
import { prisma } from '../config/prisma.js';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

test('control de entradas y aforo (4.7)', async (t) => {
  const tk = await tokens(), rec = api(tk.REC), adm = api(tk.ADM), ent = api(tk.ENT), con = api(tk.CON);
  await ensureShift(tk.REC);
  const suf = String(Date.now()).slice(-6), a = cedula(`173${suf}`), b = cedula(`174${suf}`), c = cedula(`175${suf}`);
  for (const [ced, nombre] of [[a, 'Ana'], [b, 'Beto'], [c, 'Carla']]) assert.equal((await rec.post('/admin/clientes', { cedula: ced, nombre, apellido: 'Entradas' })).status, 201);
  const inscribir = async (clienteId, membresiaId, monto) => { const r = await rec.post('/admin/inscripciones', { clienteId, membresiaId, pagos: [{ metodoPago: 'EF', monto }] }); assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body; };
  // Fixtures: un horario de Boxeo para hoy y un plan sin clases que no es pase diario.
  const hoy = DIAS[new Date(Date.now() - 5 * 3600000).getUTCDay()];
  const boxeo = await prisma.clase.findUnique({ where: { nombre: 'Boxeo' } });
  const horario = await prisma.horario.upsert({ where: { dia_horaInicio_horaFin: { dia: hoy, horaInicio: '00:01', horaFin: '23:58' } }, create: { dia: hoy, horaInicio: '00:01', horaFin: '23:58' }, update: {} });
  await prisma.claseHorario.upsert({ where: { claseId_horarioId: { claseId: boxeo.id, horarioId: horario.id } }, create: { claseId: boxeo.id, horarioId: horario.id, estado: 'A' }, update: { estado: 'A' } });
  const otroDia = await prisma.claseHorario.findFirst({ where: { claseId: boxeo.id, horarioIdRef1: { dia: { not: hoy } } } });
  await prisma.membresia.upsert({ where: { id: 'TPRB' }, create: { id: 'TPRB', nombre: 'Plan de prueba solo pesas', tipo: 'T', duracion: 1, unidadDuracion: 'M', numPersonas: 1, precio: '20', pagaIva: 'N', incluyeRutina: 'N', esEstudiantil: 'N', publicarWeb: 'N', estado: 'A' }, update: { estado: 'A' } });
  await prisma.membresiaServicio.upsert({ where: { membresiaId_servicioId: { membresiaId: 'TPRB', servicioId: 'PES' } }, create: { membresiaId: 'TPRB', servicioId: 'PES' }, update: {} });
  const mensual = await inscribir(a, 'MI1', 35), diario = await inscribir(b, 'PDI', 3), soloPesas = await inscribir(c, 'TPRB', 20);
  let entrada;
  try {
    await t.test('permisos: ENT ve el aforo, no registra entradas; CON no entra', async () => {
      assert.equal((await ent.post('/admin/entradas', { clienteId: a, inscripcionId: mensual.id })).status, 403);
      assert.equal((await ent.get('/admin/aforo')).status, 200);
      assert.equal((await con.get('/admin/aforo')).status, 403);
    });
    await t.test('acceso por cédula: inscripciones activas y clases de hoy del plan', async () => {
      const r = await rec.get(`/admin/clientes/${a}/acceso`);
      assert.equal(r.status, 200); const i = r.body.inscripciones.find((x) => x.inscripcionId === mensual.id);
      assert.ok(i.clasesHoy.some((x) => x.claseId === boxeo.id && x.horarioId === horario.id));
      const d = await rec.get(`/admin/clientes/${b}/acceso`);
      assert.deepEqual(d.body.inscripciones[0].clasesHoy, []);
    });
    await t.test('entrada a una clase de hoy y entrada abierta repetida', async () => {
      const r = await rec.post('/admin/entradas', { clienteId: a, inscripcionId: mensual.id, claseId: boxeo.id, horarioId: horario.id });
      assert.equal(r.status, 201, JSON.stringify(r.body)); entrada = r.body; assert.equal(entrada.clase, 'Boxeo');
      const again = await rec.post('/admin/entradas', { clienteId: a, inscripcionId: mensual.id });
      assert.equal(again.status, 409); assert.match(again.body.mensaje, /entrada abierta/);
    });
    await t.test('registrar salida', async () => {
      await prisma.asistenciaCliente.update({ where: { id: entrada.id }, data: { horaIngreso: '00:00' } });
      const r = await rec.patch(`/admin/entradas/${entrada.id}/salida`);
      assert.equal(r.status, 200); assert.ok(r.body.horaSalida);
      assert.equal((await rec.patch(`/admin/entradas/${entrada.id}/salida`)).status, 409);
    });
    if (otroDia) await t.test('una clase de otro día se rechaza', async () => {
      const r = await rec.post('/admin/entradas', { clienteId: a, inscripcionId: mensual.id, claseId: otroDia.claseId, horarioId: otroDia.horarioId });
      assert.equal(r.status, 409); assert.match(r.body.mensaje, /no hoy/);
    });
    await t.test('A3: el pase diario rechaza cualquier clase', async () => {
      const r = await rec.post('/admin/entradas', { clienteId: b, inscripcionId: diario.id, claseId: boxeo.id, horarioId: horario.id });
      assert.equal(r.status, 409); assert.match(r.body.mensaje, /pase diario no incluye clases/);
    });
    await t.test('plan que no incluye la clase', async () => {
      const r = await rec.post('/admin/entradas', { clienteId: c, inscripcionId: soloPesas.id, claseId: boxeo.id, horarioId: horario.id });
      assert.equal(r.status, 409); assert.match(r.body.mensaje, /no incluye la clase de Boxeo/);
    });
    await t.test('quien no es integrante no entra', async () => {
      const r = await rec.post('/admin/entradas', { clienteId: c, inscripcionId: mensual.id });
      assert.equal(r.status, 409); assert.match(r.body.mensaje, /no es integrante/);
    });
    await t.test('tarjeta agotada: la última entrada la pasa a V y la siguiente se rechaza', async () => {
      const tarjeta = await inscribir(c, 'TAR', 40);
      await prisma.inscripcion.update({ where: { id: tarjeta.id }, data: { ingresosTotal: 1 } });
      const r = await rec.post('/admin/entradas', { clienteId: c, inscripcionId: tarjeta.id });
      assert.equal(r.status, 201); assert.equal(r.body.ingresosRestantes, 0);
      assert.equal((await prisma.inscripcion.findUnique({ where: { id: tarjeta.id } })).estado, 'V');
      const again = await rec.post('/admin/entradas', { clienteId: c, inscripcionId: tarjeta.id });
      assert.equal(again.status, 409); assert.match(again.body.mensaje, /tarjeta ya usó sus 1 ingresos/);
    });
    await t.test('aforo lleno', async () => {
      const af = (await rec.get('/admin/aforo')).body, original = af.aforoMax;
      assert.ok(af.personasAdentro >= 1);
      await adm.put('/admin/gimnasio', { aforoMax: af.personasAdentro });
      try {
        const r = await rec.post('/admin/entradas', { clienteId: b, inscripcionId: diario.id });
        assert.equal(r.status, 409); assert.equal(r.body.mensaje, `El gimnasio está lleno (${af.personasAdentro} de ${af.personasAdentro}).`);
      } finally { await adm.put('/admin/gimnasio', { aforoMax: original }); }
      const list = await rec.get('/admin/entradas?abiertas=S');
      assert.equal(list.status, 200); assert.ok(list.body.data.every((e) => e.horaSalida === null));
    });
  } finally {
    // Cierra las entradas que dejó abiertas la prueba para no llenar el aforo en corridas repetidas.
    await prisma.asistenciaCliente.updateMany({ where: { clienteId: { in: [a, b, c] }, horaSalida: null }, data: { horaSalida: '23:59' } });
  }
});
