import { z } from "zod";

export const telegramUserSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
});

export const telegramChatSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  type: z.enum(["private", "group", "supergroup", "channel"]),
});

export const telegramMessageSchema = z.object({
  message_id: z.number(),
  text: z.string().optional(),
  from: telegramUserSchema.optional(),
  chat: telegramChatSchema,
});

export const telegramCallbackQuerySchema = z.object({
  id: z.string(),
  data: z.string(),
  from: telegramUserSchema,
  message: telegramMessageSchema.optional(),
});

export const telegramUpdateSchema = z.object({
  update_id: z.number(),
  message: telegramMessageSchema.optional(),
  callback_query: telegramCallbackQuerySchema.optional(),
});

export type TelegramUser = z.infer<typeof telegramUserSchema>;
export type TelegramMessage = z.infer<typeof telegramMessageSchema>;
export type TelegramCallbackQuery = z.infer<typeof telegramCallbackQuerySchema>;
export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
