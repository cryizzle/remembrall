import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(8989),
  HOST: z.string().min(1).default("0.0.0.0"),
  POOLSIDE_API_KEY: z.string().min(1).optional(),
  POOLSIDE_BASE_URL: z.string().url().optional(),
  POOLSIDE_MODEL: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);

export function isPoolsideConfigured() {
  return Boolean(env.POOLSIDE_API_KEY && env.POOLSIDE_BASE_URL && env.POOLSIDE_MODEL);
}
