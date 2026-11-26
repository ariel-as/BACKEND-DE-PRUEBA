import { prisma } from '../config/prisma.js';
import { addDays, asDate, localToday } from '../utils/dates.js';
import { proximasCaducidades } from '../services/inventory.service.js';

const aplicar = process.argv.includes('--aplicar');
const hoy = localToday();
const demostracion = ['PF9001', 'PF9002'];
const plazosCortos = [-3, 5, 12, 25, 45];
const plazosLargos = [120, 150, 180, 210, 240, 270, 300, 330, 360];
const fechaPara = (i) => addDays(hoy, i < plazosCortos.length ? plazosCortos[i] : plazosLargos[(i - plazosCortos.length) % plazosLargos.length]);

const productos = await prisma.producto.findMany({
  where: {
    id: { startsWith: 'PF', notIn: demostracion },
    controlaCaducidad: 'S',
    stock: { gt: 0 },
    loteProductos: { some: { cantidadDisponible: { gt: 0 } } }
  },
  select: {
    id: true,
    nombre: true,
    loteProductos: { where: { cantidadDisponible: { gt: 0 } }, select: { id: true, fechaCaducidad: true, cantidadDisponible: true }, orderBy: { id: 'asc' } }
  },
  orderBy: { id: 'asc' }
});
const lotes = productos.flatMap((p) => p.loteProductos.map((l) => ({ ...l, productoId: p.id })));
lotes.forEach((l, i) => { l.nuevaCaducidad = fechaPara(i); });

console.log(`Modo: ${aplicar ? 'APLICAR' : 'PRUEBA (no cambia nada)'}`);
console.log(`Productos reales con caducidad y unidades: ${productos.length}; lotes a fechar: ${lotes.length}`);
console.log(`Plazos: ${plazosCortos.map((n) => `${n} d`).join(', ')}; resto: ${plazosLargos[0]}-${plazosLargos.at(-1)} d`);
for (const p of productos) {
  const propios = lotes.filter((l) => l.productoId === p.id);
  console.log(`${p.id} ${p.nombre}: lotes=${propios.length}, proxima=${propios[0]?.nuevaCaducidad ?? null}`);
}
console.log(`Demostración a desactivar: ${demostracion.join(', ')}`);

if (aplicar) {
  await prisma.$transaction(async (tx) => {
    await tx.producto.updateMany({ where: { id: { in: demostracion } }, data: { estado: 'I', publicarWeb: 'N' } });
    for (const l of lotes) await tx.loteProducto.update({ where: { id: l.id }, data: { fechaCaducidad: asDate(l.nuevaCaducidad) } });
  });
  const mapa = await proximasCaducidades();
  for (const p of productos) console.log(`${p.id}: proximaCaducidad=${mapa.get(p.id)?.proximaCaducidad ?? null}, diasParaCaducar=${mapa.get(p.id)?.diasParaCaducar ?? null}`);
  console.log(`Demostración desactivada: ${demostracion.join(', ')}`);
}
await prisma.$disconnect();
