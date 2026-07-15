import { customAlphabet } from "nanoid";
import { z } from "zod";

// Excludes look-alikes (0/O/1/I/l) so codes are safe to read aloud or type by hand.
export const generateCode = customAlphabet(
  "23456789abcdefghijkmnpqrstuvwxyz",
  8,
);

// One cart line, sanitized from the storefront's /cart.js payload.
export const shareItemSchema = z.object({
  variantId: z.coerce.string().regex(/^\d+$/),
  quantity: z.coerce.number().int().min(1).max(999),
  title: z.string().max(255).optional(),
  variantTitle: z.string().max(255).nullish(),
  image: z.string().max(2048).nullish(),
  properties: z.record(z.string(), z.string()).nullish(),
});

export const createShareSchema = z.object({
  items: z.array(shareItemSchema).min(1).max(50),
});

export type ShareItem = z.infer<typeof shareItemSchema>;
