import { z } from 'zod';

export const verificationNoteSchema = z.object({
  outcome: z.enum(['screened', 'needs_evidence', 'conflicting_evidence', 'corroborated', 'address_corrected']),
  findings: z.string().trim().min(3).max(2000),
  remainingChecks: z.string().trim().min(3).max(1500),
  searchArea: z.string().trim().max(160).default(''),
  sourceUrls: z.array(z.string().url().max(1000).refine(value => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  }, 'Gebruik een openbare http(s)-bronlink zonder inloggegevens.')).max(10).default([]),
  checkedAt: z.string().datetime(),
}).strict();

export type VerificationNoteInput = z.infer<typeof verificationNoteSchema>;
export interface VerificationNote extends VerificationNoteInput { id: string; createdAt: string }
export const verificationQueueSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  query: z.string().trim().max(160).default(''),
  researched: z.enum(['all', 'yes', 'no']).default('all'),
});
