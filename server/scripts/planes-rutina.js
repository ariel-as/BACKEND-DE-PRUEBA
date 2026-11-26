import { prisma } from '../config/prisma.js';

// Todos los planes incluyen rutina (servicio RUT) excepto el pase diario PDI.
// Sin --aplicar solo muestra la tabla antes/después; con --aplicar escribe.
const aplicar = process.argv.includes('--aplicar');
const PDI = {
  nombre: 'Pase diario', descripcion: 'Acceso por un día al área de pesas y cardio.', tipo: 'T', duracion: 1, unidadDuracion: 'D',
  numIngresos: null, numPersonas: 1, precio: '3.00', pagaIva: 'N', incluyeRutina: 'N', esEstudiantil: 'N', publicarWeb: 'N', estado: 'A'
};

const leer = async () => (await prisma.membresia.findMany({
  select: { id: true, nombre: true, estado: true, precio: true, pagaIva: true, publicarWeb: true, incluyeRutina: true, membresiaServicios: { where: { servicioId: 'RUT' }, select: { servicioId: true } } },
  orderBy: { id: 'asc' }
})).map((m) => ({ id: m.id, nombre: m.nombre, estado: m.estado, precio: Number(m.precio).toFixed(2), pagaIva: m.pagaIva, publicarWeb: m.publicarWeb, incluyeRutina: m.incluyeRutina, RUT: m.membresiaServicios.length ? 'S' : 'N' }));

const esperado = (m) => m.id === 'PDI'
  ? { ...m, estado: 'A', precio: '3.00', pagaIva: 'N', publicarWeb: 'N', incluyeRutina: 'N', RUT: 'N' }
  : { ...m, incluyeRutina: 'S', RUT: 'S' };

const antes = await leer();
const despues = antes.map(esperado);
if (!antes.some((m) => m.id === 'PDI')) despues.push({ id: 'PDI', nombre: PDI.nombre, estado: 'A', precio: '3.00', pagaIva: 'N', publicarWeb: 'N', incluyeRutina: 'N', RUT: 'N' });

const campos = ['estado', 'precio', 'pagaIva', 'publicarWeb', 'incluyeRutina', 'RUT'];
const tabla = despues.map((d) => {
  const a = antes.find((x) => x.id === d.id);
  const fila = { plan: d.id, nombre: d.nombre };
  for (const c of campos) fila[c] = !a ? `— → ${d[c]}` : a[c] === d[c] ? d[c] : `${a[c]} → ${d[c]}`;
  fila.cambia = !a || campos.some((c) => a[c] !== d[c]) ? 'sí' : '';
  return fila;
});

console.log(`Modo: ${aplicar ? 'APLICAR' : 'PRUEBA (no cambia nada)'}`);
console.table(tabla);
const pendientes = tabla.filter((f) => f.cambia).length;
console.log(`Planes con cambios: ${pendientes}`);

if (aplicar && pendientes) {
  await prisma.$transaction(async (tx) => {
    await tx.servicio.upsert({ where: { id: 'RUT' }, create: { id: 'RUT', nombre: 'Rutinas', descripcion: 'Rutinas', tipo: 'I', estado: 'A' }, update: {} });
    await tx.membresia.upsert({ where: { id: 'PDI' }, create: { id: 'PDI', ...PDI }, update: { estado: 'A', precio: '3.00', pagaIva: 'N', publicarWeb: 'N', incluyeRutina: 'N' } });
    if (!antes.some((m) => m.id === 'PDI')) {
      const base = await tx.servicio.findMany({ where: { id: { in: ['PES', 'CAR'] } }, select: { id: true } });
      if (base.length) await tx.membresiaServicio.createMany({ data: base.map((s) => ({ membresiaId: 'PDI', servicioId: s.id })), skipDuplicates: true });
    }
    await tx.membresiaServicio.deleteMany({ where: { membresiaId: 'PDI', servicioId: 'RUT' } });
    await tx.membresia.updateMany({ where: { id: { not: 'PDI' } }, data: { incluyeRutina: 'S' } });
    const sinRut = antes.filter((m) => m.id !== 'PDI' && m.RUT === 'N').map((m) => ({ membresiaId: m.id, servicioId: 'RUT' }));
    if (sinRut.length) await tx.membresiaServicio.createMany({ data: sinRut, skipDuplicates: true });
  });
  const verificado = (await leer()).every((m) => { const e = esperado(m); return campos.every((c) => m[c] === e[c]); });
  console.log(verificado ? 'Cambios aplicados y verificados.' : 'ADVERTENCIA: la verificación posterior no coincide.');
}
await prisma.$disconnect();
