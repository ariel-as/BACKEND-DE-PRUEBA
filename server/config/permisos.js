// Matriz de permisos por rol (BACKEND_FASE2 sección 3). ADM puede todo.
// Cada permiso es un texto 'grupo:accion'. Este es el único lugar donde se define quién hace qué.
export const PERMISOS_POR_ROL = {
  REC: [
    'resumen:ver', 'gimnasio:leer', 'catalogos:leer', 'empleados:leer', 'asistencia:marcar',
    'clientes:leer', 'clientes:editar', 'planes:leer',
    'inscripciones:leer', 'inscripciones:gestionar',
    'entradas:gestionar', 'aforo:ver', 'clases:leer', 'rutinas:leer',
    'aliados:leer', 'aliados:cobrar', 'inventario:leer',
    'pedidos:leer', 'pedidos:gestionar', 'ventas:leer', 'ventas:crear',
    'facturas:leer', 'facturas:generar', 'caja:operar', 'caja:leer',
    'mensajes:gestionar', 'reportes:clientes', 'reportes:entradas'
  ],
  ENT: [
    'resumen:ver', 'gimnasio:leer', 'catalogos:leer', 'asistencia:marcar',
    'clientes:leer', 'planes:leer', 'inscripciones:leer', 'aforo:ver',
    'clases:propias', 'rutinas:gestionar'
  ],
  CON: [
    'resumen:ver', 'gimnasio:leer', 'catalogos:leer', 'empleados:leer', 'asistencia:reporte',
    'clientes:leer', 'planes:leer', 'inscripciones:leer',
    'aliados:leer', 'aliados:cobrar', 'inventario:leer', 'compras:leer',
    'pedidos:leer', 'ventas:leer', 'facturas:leer', 'facturas:generar', 'facturas:sri',
    'caja:leer', 'caja:cierre',
    'reportes:clientes', 'reportes:entradas', 'reportes:todos', 'tablas:leer'
  ],
  CLI: []
};
// Permisos que solo tiene ADM (además de todos los anteriores).
const SOLO_ADM = [
  'usuarios:gestionar', 'gimnasio:editar', 'catalogos:editar', 'empleados:editar', 'asistencia:gestionar',
  'planes:editar', 'inscripciones:anular', 'clases:leer', 'clases:editar', 'aliados:editar',
  'inventario:gestionar', 'compras:gestionar', 'ventas:anular', 'tablas:escribir'
];
export const TODOS = [...new Set([...Object.values(PERMISOS_POR_ROL).flat(), ...SOLO_ADM])].sort();

export function permisosDe(roles = []) {
  if (roles.includes('ADM')) return TODOS;
  return [...new Set(roles.flatMap((r) => PERMISOS_POR_ROL[r] || []))].sort();
}
export const hasPermission = (user, ...perms) => !!user && (user.roles?.includes('ADM') || perms.some((p) => permisosDe(user.roles).includes(p)));

// Permisos de lectura y escritura de cada tabla del panel genérico.
// Una tabla sin grupo propio solo se lee con 'tablas:leer' (CON) y se escribe con 'tablas:escribir' (ADM).
const GRUPO_TABLA = {
  gimnasio: 'gimnasio', horario_atencion: 'gimnasio',
  cargo: 'catalogos', turno: 'catalogos', nivel: 'catalogos', categoria: 'catalogos', unidad_medida: 'catalogos', metodo_pago: 'catalogos', tipo_movimiento: 'catalogos', servicio: 'catalogos',
  empleado: 'empleados', cliente: 'clientes',
  membresia: 'planes', membresia_servicio: 'planes', promocion: 'planes', membresia_promocion: 'planes',
  clase: 'clases', horario: 'clases', clase_horario: 'clases',
  proveedor: 'compras', producto_proveedor: 'compras', profesional_aliado: 'aliados'
};
export function tablePermissions(tabla) {
  const g = GRUPO_TABLA[tabla];
  const leer = ['tablas:leer', ...(g ? [`${g}:leer`] : []), ...(g === 'clases' ? ['clases:propias'] : [])];
  return { leer, escribir: ['tablas:escribir'] };
}
