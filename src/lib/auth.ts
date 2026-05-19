import type { FastifyRequest } from "fastify";

import { resolveTelegramUser } from "../services/reminder-service.js";

const TELEGRAM_USER_ID_HEADER = "x-telegram-user-id";
const TELEGRAM_CHAT_ID_HEADER = "x-telegram-chat-id";
const TELEGRAM_DISPLAY_NAME_HEADER = "x-telegram-display-name";
const TELEGRAM_TIMEZONE_HEADER = "x-user-timezone";

export async function resolveAuthenticatedUser(request: FastifyRequest) {
  const telegramUserId = request.headers[TELEGRAM_USER_ID_HEADER] as string | undefined;
  const telegramChatId = request.headers[TELEGRAM_CHAT_ID_HEADER] as string | undefined;
  const displayName = request.headers[TELEGRAM_DISPLAY_NAME_HEADER] as string | undefined;
  const timezone = request.headers[TELEGRAM_TIMEZONE_HEADER] as string | undefined;

  if (!telegramUserId || !telegramChatId) {
    throw request.server.httpErrors.unauthorized(
      `Missing ${TELEGRAM_USER_ID_HEADER} or ${TELEGRAM_CHAT_ID_HEADER} header.`,
    );
  }

  return resolveTelegramUser({
    telegramUserId,
    telegramChatId,
    displayName,
    timezone,
  });
}
