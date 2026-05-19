import type { FastifyPluginAsync } from "fastify";

import { env } from "../lib/env.js";
import { handleTelegramCallbackQuery } from "../telegram/handle-callback.js";
import { handleTelegramMessage } from "../telegram/handle-message.js";
import { handleTelegramWebhookError } from "../telegram/errors.js";
import { telegramUpdateSchema } from "../telegram/schemas.js";

export const telegramRoutes: FastifyPluginAsync = async (app) => {
  app.post("/telegram/webhook", async (request, reply) => {
    const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET;
    const receivedSecret = request.headers["x-telegram-bot-api-secret-token"];

    if (expectedSecret && receivedSecret !== expectedSecret) {
      throw app.httpErrors.unauthorized("Invalid Telegram webhook secret.");
    }

    const update = telegramUpdateSchema.parse(request.body);

    try {
      if (update.callback_query) {
        await handleTelegramCallbackQuery(update.callback_query);
      } else if (update.message?.from) {
        await handleTelegramMessage(update.message);
      } else {
        reply.code(200);
        return { ok: true, ignored: true };
      }
    } catch (error) {
      const handled = await handleTelegramWebhookError(request, reply, error, update.message);
      if (handled.handled) {
        return handled.payload;
      }

      throw error;
    }

    reply.code(200);
    return { ok: true };
  });
};
