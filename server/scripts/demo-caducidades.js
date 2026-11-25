import { prisma } from '../config/prisma.js';
import { addDays, asDate, localToday } from '../utils/dates.js';
import { proximasCaducidades } from '../services/inventory.service.js';

const aplicar = process.argv.includes('--aplicar');
const hoy = localToday();
const pronto = addDays(hoy, 5), lejano = addDays(hoy, 20), sinControl = addDays(hoy, 3);
const productos = [
  { id: 'PF9001', nombre: 'Suplemento con caducidad (demo)', controlaCaducidad: 'S', diasAlertaCad: 30, metodoSalida: 'E', stockMin: 20, lotes: [{ marca: 'DEMO-CAD-5', fecha: pronto, cantidad: 10 }, { marca: 'DEMO-CAD-20', fecha: lejano, cantidad: 8 }] },
  { id: 'PF9002', nombre: 'Barra proteica sin control de caducidad (demo)', controlaCaducidad: 'N', diasAlertaCad: null, metodoSalida: 'F', stockMin: 20, lotes: [{ marca: 'DEMO-CAD-SC', fecha: sinControl, cantidad: 5 }] }
];
const comun = { categoriaId: 'SUP', unidadMedidaId: 'UND', descripcion: 'Datos de demostración de caducidades.', precioVenta: '1.00', costoPromedio: '1.0000', pagaIva: 'N', esContable: 'S', metodoValora: 'P', publicarWeb: 'S', estado: 'A' };

async function ejecutar(tx, p) {
  const { lotes, ...datos } = p;
  await tx.producto.upsert({ where: { id: p.id }, create: { ...comun, ...datos, stock: 0 }, update: { ...comun, nombre: p.nombre, controlaCaducidad: p.controlaCaducidad, diasAlertaCad: p.diasAlertaCad, metodoSalida: p.metodoSalida, stockMin: p.stockMin } });
  for (const l of p.lotes) {
    const dato = { fechaIngreso: asDate(hoy), fechaCaducidad: asDate(l.fecha), cantidadInicial: l.cantidad, cantidadDisponible: l.cantidad, costoUnit: '1.00', estado: 'D' };
    const actual = await tx.loteProducto.findFirst({ where: { productoId: p.id, numFabricante: l.marca } });
    if (actual) await tx.loteProducto.update({ where: { id: actual.id }, data: dato });
    else {
      const creado = await tx.loteProducto.create({ data: { productoId: p.id, numFabricante: l.marca, ...dato } });
      await tx.kardex.create({ data: { loteProductoId: creado.id, tipoMovimientoId: 'AJP', empleadoId: '1711111110', fecha: asDate(hoy), cantidad: l.cantidad, costoUnit: '1.0000', saldoCantidad: l.cantidad, costoPromedio: '1.0000', saldoValor: String(l.cantidad), observacion: 'Demo caducidades' } });
    }
  }
  const stock = p.lotes.reduce((n, l) => n + l.cantidad, 0);
  await tx.producto.update({ where: { id: p.id }, data: { stock } });
}

console.log(`Modo: ${aplicar ? 'APLICAR' : 'PRUEBA (no cambia nada)'}`);
for (const p of productos) console.log(`${p.id} ${p.nombre}: controla=${p.controlaCaducidad}, lotes=${p.lotes.map((l) => `${l.marca} ${l.fecha} (${l.cantidad} u.)`).join('; ')}`);
if (aplicar) {
  await prisma.$transaction(async (tx) => { for (const p of productos) await ejecutar(tx, p); });
  const mapa = await proximasCaducidades();
  for (const p of productos) console.log(`${p.id}: proximaCaducidad=${mapa.get(p.id)?.proximaCaducidad ?? null}, diasParaCaducar=${mapa.get(p.id)?.diasParaCaducar ?? null}`);
}
await prisma.$disconnect();
