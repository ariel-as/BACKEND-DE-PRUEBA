import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../config/prisma.js';

test('contrato principal de Planeta Fitness requiere una base migrada y el seed', async (t) => {
  const adminLogin=await request(app).post('/api/v1/auth/login').send({correo:'admin@planetafitness.ec',contrasena:process.env.SEED_ADMIN_PASSWORD||'Admin12345'});
  const clientLogin=await request(app).post('/api/v1/auth/login').send({correo:'cliente@planetafitness.ec',contrasena:process.env.SEED_CLIENTE_PASSWORD||'Cliente12345'});
  assert.equal(adminLogin.status,200);assert.equal(clientLogin.status,200);
  const adminToken=adminLogin.body.token,clientToken=clientLogin.body.token;
  const id=`PF${Date.now()}`.slice(0,13);
  const payload={id,nombre:'Producto de integración',categoriaId:'SUP',unidadMedidaId:'UND',precio:10,stock:5,stockMin:1,costoUnit:4,pagaIva:'S',esContable:'S',controlaCaducidad:'N',publicarWeb:'S',estado:'A'};

  await t.test('login entrega sesión y roles',()=>{assert.equal(adminLogin.body.tipo,'Bearer');assert.equal(adminLogin.body.usuario.rol,'admin');assert.equal(clientLogin.body.usuario.rol,'user');});
  await t.test('administrador crea producto y registra su stock',async()=>{const r=await request(app).post('/api/v1/productos').set('Authorization',`Bearer ${adminToken}`).send(payload);assert.equal(r.status,201);assert.equal(r.body.stock,5);});
  await t.test('el cliente no puede crear productos',async()=>{const r=await request(app).post('/api/v1/productos').set('Authorization',`Bearer ${clientToken}`).send({...payload,id:`${id}X`});assert.equal(r.status,403);});
  await t.test('catálogo público responde paginado',async()=>{const r=await request(app).get('/api/v1/productos');assert.equal(r.status,200);assert.ok(Array.isArray(r.body.data));assert.ok('pagination'in r.body);});
  let orderId;
  await t.test('pedido usa precio de base aunque el carrito mande otro',async()=>{const r=await request(app).post('/api/v1/pedidos').set('Authorization',`Bearer ${clientToken}`).send({metodoPago:'EF',items:[{productoId:id,cantidad:1,precio:0.01}]});assert.equal(r.status,201);orderId=r.body.id;assert.equal(r.body.detalles[0].precioUnitario,10);const stored=await prisma.pedido.findUnique({where:{id:orderId},include:{detalles:true}});assert.ok(stored);assert.equal(stored.detalles.length,1);});
  await t.test('el administrador ve pedidos y el cliente no puede consultar todos',async()=>{assert.equal((await request(app).get('/api/v1/pedidos').set('Authorization',`Bearer ${adminToken}`)).status,200);assert.equal((await request(app).get('/api/v1/pedidos').set('Authorization',`Bearer ${clientToken}`)).status,403);});
  await t.test('mis pedidos requiere sesión',async()=>{assert.equal((await request(app).get('/api/v1/pedidos/mis-pedidos')).status,401);});
  await t.test('entrada mal formada y contenido no JSON se rechazan',async()=>{const bad=await request(app).post('/api/v1/auth/login').set('Content-Type','application/json').send('{');const plain=await request(app).post('/api/v1/auth/login').set('Content-Type','text/plain').send('correo=prueba');assert.equal(bad.status,400);assert.equal(plain.status,415);});
  await t.test('login rechaza campos adicionales',async()=>{const r=await request(app).post('/api/v1/auth/login').send({correo:'admin@planetafitness.ec',contrasena:process.env.SEED_ADMIN_PASSWORD||'Admin12345',rol:'ADM'});assert.equal(r.status,400);});
  await t.test('stock insuficiente devuelve conflicto',async()=>{const r=await request(app).post('/api/v1/pedidos').set('Authorization',`Bearer ${clientToken}`).send({metodoPago:'EF',items:[{productoId:id,cantidad:6}]});assert.equal(r.status,409);});
  await t.test('el panel protege tablas de solo lectura y nombres no permitidos',async()=>{const path='/api/v1/admin/tablas';assert.equal((await request(app).post(`${path}/kardex`).set('Authorization',`Bearer ${adminToken}`).send({})).status,403);assert.equal((await request(app).get(`${path}/__proto__`).set('Authorization',`Bearer ${adminToken}`)).status,404);});
  await t.test('la sesión del cliente expone su clienteId',async()=>{const r=await request(app).get('/api/v1/auth/me').set('Authorization',`Bearer ${clientToken}`);assert.equal(r.status,200);assert.equal(r.body.usuario.clienteId,'1712345675');});
  await t.test('el stock se descuenta de forma atómica al crear el pedido',async()=>{const p=await prisma.producto.findUnique({where:{id}});assert.equal(p.stock,4);});
  await t.test('la paginación informa el límite aplicado',async()=>{const r=await request(app).get('/api/v1/productos?limit=9999');assert.equal(r.status,200);assert.equal(r.body.pagination.limit,100);});
  await t.test('un identificador mal codificado devuelve 400',async()=>{const r=await request(app).get('/api/v1/admin/tablas/producto/%25').set('Authorization',`Bearer ${adminToken}`);assert.equal(r.status,400);});
  await t.test('el panel no expone hashes de contraseñas',async()=>{const r=await request(app).get('/api/v1/admin/tablas/usuario').set('Authorization',`Bearer ${adminToken}`);assert.equal(r.status,200);assert.ok(r.body.data.length);assert.ok(r.body.data.every((u)=>!('claveHash' in u)));});
  await t.test('el personal sin rol ADM no entra al panel administrativo',async()=>{const created=await request(app).post('/api/v1/admin/usuarios').set('Authorization',`Bearer ${adminToken}`).send({login:'staff-test@planetafitness.ec',password:'Staff12345',roles:['REC'],empleadoId:'1700000019'});assert.ok([201,409].includes(created.status));const login=await request(app).post('/api/v1/auth/login').send({correo:'staff-test@planetafitness.ec',contrasena:'Staff12345'});assert.equal(login.status,200);assert.equal(login.body.usuario.rol,'staff');assert.equal((await request(app).get('/api/v1/admin/resumen').set('Authorization',`Bearer ${login.body.token}`)).status,403);});
});
