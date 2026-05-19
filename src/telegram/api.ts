import { env } from "../lib/env.js";

type TelegramSendMessagePayload = {
  chat_id: string;
  text: string;
  reply_to_message_id?: number;
  parse_mode?: "HTML";
  reply_markup?: {
    inline_keyboard?: Array<Array<{ text: string; callback_data: string }>>;
    keyboard?: Array<Array<{ text: string }>>;
    resize_keyboard?: boolean;
    is_persistent?: boolean;
  };
};

type TelegramEditMessageTextPayload = {
  chat_id: string;
  message_id: number;
  text: string;
  parse_mode?: "HTML";
  reply_markup?: {
    inline_keyboard?: Array<Array<{ text: string; callback_data: string }>>;
  };
};

type TelegramDeleteMessagePayload = {
  chat_id: string;
  message_id: number;
};

type TelegramAnswerCallbackQueryPayload = {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
};

type TelegramSendDocumentPayload = {
  chat_id: string;
  filename: string;
  content: string;
  caption?: string;
  reply_to_message_id?: number;
  parse_mode?: "HTML";
};

export class TelegramConfigurationError extends Error {
  constructor() {
    super("Telegram is not fully configured. Expected TELEGRAM_BOT_TOKEN.");
  }
}

export class TelegramRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Telegram request failed with status ${status}.`);
  }
}

export function isTelegramMessageNotModifiedError(error: unknown) {
  return error instanceof TelegramRequestError && error.body.includes("message is not modified");
}

export function isTelegramBotKickedError(error: unknown) {
  return error instanceof TelegramRequestError && error.body.includes("bot was kicked from the group chat");
}

function getTelegramApiBaseUrl() {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new TelegramConfigurationError();
  }

  return `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
}

async function telegramRequest<T>(method: string, payload: object) {
  const response = await fetch(`${getTelegramApiBaseUrl()}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new TelegramRequestError(response.status, await response.text());
  }

  return (await response.json()) as T;
}

export async function sendTelegramMessage(payload: TelegramSendMessagePayload) {
  return telegramRequest("sendMessage", payload);
}

type TelegramSendMessageResult = {
  result?: { message_id?: number };
};

export function extractTelegramMessageId(response: unknown): number | undefined {
  return (response as TelegramSendMessageResult | undefined)?.result?.message_id;
}

export async function editTelegramMessageText(payload: TelegramEditMessageTextPayload) {
  return telegramRequest("editMessageText", payload);
}

export async function answerTelegramCallbackQuery(payload: TelegramAnswerCallbackQueryPayload) {
  return telegramRequest("answerCallbackQuery", payload);
}

export async function deleteTelegramMessage(payload: TelegramDeleteMessagePayload) {
  return telegramRequest("deleteMessage", payload);
}

export async function sendTelegramDocument(payload: TelegramSendDocumentPayload) {
  const form = new FormData();
  form.set("chat_id", payload.chat_id);
  if (payload.caption) {
    form.set("caption", payload.caption);
  }
  if (payload.reply_to_message_id !== undefined) {
    form.set("reply_to_message_id", String(payload.reply_to_message_id));
  }
  if (payload.parse_mode) {
    form.set("parse_mode", payload.parse_mode);
  }

  const blob = new Blob([payload.content], {
    type: "text/calendar;charset=utf-8",
  });
  form.set("document", blob, payload.filename);

  const response = await fetch(`${getTelegramApiBaseUrl()}/sendDocument`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new TelegramRequestError(response.status, await response.text());
  }

  return response.json();
}
