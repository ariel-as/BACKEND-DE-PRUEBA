// Fechas con el día y la hora local de Ecuador (UTC−5).
const OFFSET = 5 * 60 * 60 * 1000;
const local = () => new Date(Date.now() - OFFSET);
export const localToday = () => local().toISOString().slice(0, 10);
export const localTime = () => local().toISOString().slice(11, 16);
// Una columna DATE se arma al mediodía de Ecuador para que no cambie de día.
export const asDate = (s) => new Date(`${s}T12:00:00-05:00`);
export const todayDate = () => asDate(localToday());
export const validDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(asDate(s).valueOf()) && asDate(s).toISOString().slice(0, 10) === s;
export const dateStr = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
export const addDays = (s, n) => { const d = asDate(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const daysBetween = (a, b) => Math.round((asDate(b) - asDate(a)) / 86400000);
export const clampMonth = (date, months) => {
  const day = date.getUTCDate(), target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  target.setUTCDate(Math.min(day, new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()));
  return target;
};
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
export const normalizeDay = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
export const weekday = (s) => DIAS[asDate(s).getUTCDay()];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const longDate = (d) => { const s = dateStr(d); return `${Number(s.slice(8, 10))} de ${MESES[Number(s.slice(5, 7)) - 1]} de ${s.slice(0, 4)}`; };
// Fin de un plan por tiempo: D → inicio + duración − 1 día; M → inicio + meses − 1 día.
export function planEnd(start, membership) {
  const date = asDate(start);
  const raw = membership.unidadDuracion === 'M' ? clampMonth(date, membership.duracion) : new Date(date.getTime() + membership.duracion * 86400000);
  raw.setUTCDate(raw.getUTCDate() - 1);
  return raw;
}
