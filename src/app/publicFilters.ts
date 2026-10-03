import { z } from 'zod';
import { PRODUCT_CATEGORIES } from '../categories.js';

export const PROVINCES = ['Drenthe', 'Flevoland', 'Fryslân', 'Gelderland', 'Groningen', 'Limburg', 'Noord-Brabant', 'Noord-Holland', 'Overijssel', 'Utrecht', 'Zeeland', 'Zuid-Holland'] as const;

export const publicFiltersSchema = z.object({
  query: z.string().trim().max(240).optional(),
  category: z.preprocess((value) => typeof value === 'string' ? [value] : value,
    z.array(z.enum([...PRODUCT_CATEGORIES, 'unknown'])).max(9).default([])),
  province: z.enum(PROVINCES).optional(),
  sort: z.enum(['address', 'recent']).default('address'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
