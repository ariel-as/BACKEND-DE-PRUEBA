import { env } from '../config/env.js';
import { ApiError } from './ApiError.js';
export function pagination(query) {
  const page = Number(query.page ?? 1), requested = Number(query.limit ?? env.pageLimit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(requested) || requested < 1) throw new ApiError(400, 'page y limit deben ser enteros positivos.');
  const limit = Math.min(requested, env.maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}
export const pageResult = (data, page, limit, total) => ({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
