import 'dotenv/config';

const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Falta configurar la variable ${key} en .env`);
}
if (Buffer.byteLength(process.env.JWT_SECRET) < 48) throw new Error('JWT_SECRET debe tener al menos 48 bytes.');
if (/(reemplaza|cambia|placeholder|your[-_ ]?secret)/i.test(process.env.JWT_SECRET)) throw new Error('JWT_SECRET debe ser un valor aleatorio, no un texto de ejemplo.');
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production' && (!corsOrigins.length || corsOrigins.includes('*'))) throw new Error('CORS_ORIGINS debe contener orígenes explícitos en producción.');

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development', port: Number(process.env.PORT || 5050),
  frontendDir: process.env.FRONTEND_DIR || '',
  databaseUrl: process.env.DATABASE_URL, jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h', corsOrigins,
  jsonLimit: process.env.JSON_LIMIT || '100kb',
  pageLimit: Number(process.env.PAGINATION_DEFAULT_LIMIT || 10), maxLimit: Number(process.env.PAGINATION_MAX_LIMIT || 100),
  rateWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000), rateMax: Number(process.env.RATE_LIMIT_MAX || 300),
  loginRateMax: Number(process.env.LOGIN_RATE_LIMIT_MAX || 10), bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  https: process.env.HTTPS === 'true', httpsKey: process.env.HTTPS_KEY, httpsCert: process.env.HTTPS_CERT
});
