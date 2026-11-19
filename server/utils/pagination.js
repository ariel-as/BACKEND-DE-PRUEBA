import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';
export function pagination(query) {
  const page = Number(query.page ?? 1), limit = Number(query.limit ?? env.pageLimit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1) throw new ApiError(400, 'page y limit deben ser enteros positivos.');
  return { page, limit: Math.min(limit, env.maxLimit), skip: (page - 1) * Math.min(limit, env.maxLimit) };
}
export const pageResult = (data, page, limit, total) => ({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
