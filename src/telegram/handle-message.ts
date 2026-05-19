import { resolveTelegramUser } from "../services/reminder-service.js";
import { sendTelegramMessage } from "./api.js";
import {
  buildHelpText,
  buildReplyKeyboard,
  extractCommand,
  formatDisplayName,
} from "./format.js";
import { handleTelegramFreeText } from "./handle-free-text.js";
import { sendReminderList } from "./reminder-list.js";
import type { TelegramMessage } from "./schemas.js";

export async function handleTelegramMessage(message: TelegramMessage) {
  if (!message.from) {
    return;
  }

  if (message.chat.type !== "private") {
    return;
  }

  if (!message.text?.trim()) {
    await sendTelegramMessage({
      chat_id: message.chat.id,
      text: "Only text based messages are supported",
      reply_to_message_id: message.message_id,
      reply_markup: buildReplyKeyboard(),
    });
    return;
  }

  const user = await resolveTelegramUser({
    telegramUserId: message.from.id,
    telegramChatId: message.chat.id,
    displayName: formatDisplayName(message.from),
  });

  const normalizedText = message.text.trim().toLowerCase();
  const parsed = extractCommand(message.text);

  if (parsed?.command === "/start") {
    await sendTelegramMessage({
      chat_id: message.chat.id,
      text: buildHelpText(),
      parse_mode: "HTML",
      reply_to_message_id: message.message_id,
      reply_markup: buildReplyKeyboard(),
    });
    return;
  }

  if (normalizedText === "show reminders" || normalizedText === "list reminders" || normalizedText === "list") {
    await sendReminderList(user, message.chat.id, message.message_id);
    return;
  }

  if (normalizedText === "help" || parsed?.command === "/help") {
    await sendTelegramMessage({
      chat_id: message.chat.id,
      text: buildHelpText(),
      parse_mode: "HTML",
      reply_to_message_id: message.message_id,
      reply_markup: buildReplyKeyboard(),
    });
    return;
  }

  if (parsed) {
    await sendTelegramMessage({
      chat_id: message.chat.id,
      text: "Invalid command. Use the buttons below or just send me a reminder in natural language.",
      reply_to_message_id: message.message_id,
      reply_markup: buildReplyKeyboard(),
    });
    return;
  }

  await handleTelegramFreeText(user, message);
}
