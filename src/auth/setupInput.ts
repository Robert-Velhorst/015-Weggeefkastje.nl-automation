import { z } from 'zod';

export const setupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(200),
  displayName: z.string().trim().min(2).max(120),
  workspaceName: z.string().trim().min(2).max(120),
}).strict();
