import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { PoolsideConfigurationError, PoolsideRequestError } from "../lib/poolside.js";
import {
  isTelegramBotKickedError,
  sendTelegramMessage,
  TelegramConfigurationError,
  TelegramRequestError,
} from "./api.js";
import type { TelegramMessage } from "./schemas.js";

type TelegramWebhookErrorOutcome = {
  logMessage: string;
  userMessage?: string;
  fallbackCode?: string;
  shouldRethrow: boolean;
  logLevel: "error" | "warn";
};

export function classifyTelegramWebhookError(error: unknown): TelegramWebhookErrorOutcome {
  if (error instanceof TelegramConfigurationError) {
    return {
      logMessage: "Telegram bot token is missing.",
      shouldRethrow: true,
      logLevel: "error",
    };
  }

  if (isTelegramBotKickedError(error)) {
    return {
      logMessage: "Telegram bot is no longer in the target group chat.",
      shouldRethrow: false,
      logLevel: "warn",
      fallbackCode: "telegram_bot_removed",
    };
  }

  if (error instanceof TelegramRequestError) {
    return {
      logMessage: "Telegram API request failed.",
      shouldRethrow: true,
      logLevel: "error",
    };
  }

  if (error instanceof PoolsideConfigurationError) {
    return {
      logMessage: "Poolside is not configured for free-text parsing.",
      userMessage: "AI parsing is not configured yet.",
      fallbackCode: "poolside_not_configured",
      shouldRethrow: false,
      logLevel: "error",
    };
  }

  if (error instanceof PoolsideRequestError || error instanceof SyntaxError || error instanceof z.ZodError) {
    return {
      logMessage: "Poolside parsing failed.",
      userMessage: "I couldn't confidently parse that into a reminder. Please try again.",
      fallbackCode: "poolside_parse_failed",
      shouldRethrow: false,
      logLevel: "warn",
    };
  }

  return {
    logMessage: "Unhandled Telegram webhook error.",
    shouldRethrow: true,
    logLevel: "error",
  };
}

export async function handleTelegramWebhookError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  message?: TelegramMessage,
) {
  const outcome = classifyTelegramWebhookError(error);

  if (outcome.logLevel === "warn") {
    request.log.warn({ err: error }, outcome.logMessage);
  } else if (error instanceof TelegramRequestError) {
    request.log.error({ err: error, body: error.body, status: error.status }, outcome.logMessage);
  } else {
    request.log.error({ err: error }, outcome.logMessage);
  }

  if (outcome.userMessage && message) {
    await sendTelegramMessage({
      chat_id: message.chat.id,
      text: outcome.userMessage,
      reply_to_message_id: message.message_id,
    });
  }

  if (!outcome.shouldRethrow) {
    reply.code(200);
    return {
      handled: true as const,
      payload: { ok: true, fallback: outcome.fallbackCode ?? "handled_error" },
    };
  }

  return { handled: false as const };
}
