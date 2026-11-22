import request from 'supertest';
import app from '../app.js';

// Cuentas del seed por rol. Las contraseñas se pueden cambiar con las variables SEED_*.
export const CUENTAS = {
  ADM: ['admin@planetafitness.ec', process.env.SEED_ADMIN_PASSWORD || 'Admin12345'],
  CLI: ['cliente@planetafitness.ec', process.env.SEED_CLIENTE_PASSWORD || 'Cliente12345'],
  REC: ['recepcion@planetafitness.ec', process.env.SEED_RECEPCION_PASSWORD || 'Recepcion12345'],
  ENT: ['entrenador@planetafitness.ec', process.env.SEED_ENTRENADOR_PASSWORD || 'Entrenador12345'],
  CON: ['contadora@planetafitness.ec', process.env.SEED_CONTADORA_PASSWORD || 'Contadora12345']
};
export async function tokens() {
  const out = {};
  for (const [rol, [correo, contrasena]] of Object.entries(CUENTAS)) {
    const r = await request(app).post('/api/v1/auth/login').send({ correo, contrasena });
    if (r.status !== 200) throw new Error(`No se pudo iniciar sesión con ${correo}: ${r.status}`);
    out[rol] = r.body.token;
  }
  return out;
}
// Cliente HTTP con token: api(token).get('/ruta')
export const api = (token) => ({
  get: (url) => request(app).get(`/api/v1${url}`).set('Authorization', `Bearer ${token}`),
  post: (url, body = {}) => request(app).post(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(body),
  put: (url, body = {}) => request(app).put(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url, body = {}) => request(app).patch(`/api/v1${url}`).set('Authorization', `Bearer ${token}`).send(body),
  delete: (url) => request(app).delete(`/api/v1${url}`).set('Authorization', `Bearer ${token}`)
});
// Cédula ecuatoriana válida a partir de 9 dígitos.
export const cedula = (nueve) => nueve + String((10 - [...nueve].reduce((n, d, i) => { let x = Number(d); if (i % 2 === 0) { x *= 2; if (x > 9) x -= 9; } return n + x; }, 0) % 10) % 10);
