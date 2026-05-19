import { ReminderSource } from "@prisma/client";

import { generateStructuredReminderAction } from "../lib/poolside.js";
import {
  getReminderEditSessionKey,
  reminderEditSessions,
} from "../lib/sessions.js";
import type { resolveTelegramUser } from "../services/reminder-service.js";
import {
  applyReminderWriteForUser,
  getReminderForUser,
} from "../services/reminder-service.js";
import { deleteTelegramMessage, extractTelegramMessageId, sendTelegramMessage } from "./api.js";
import {
  buildReminderInlineKeyboardForReminder,
  buildReplyKeyboard,
  escapeHtml,
  formatReminderCard,
} from "./format.js";
import type { TelegramMessage } from "./schemas.js";
import { getRandomThinkingPhrase } from "./thinking-phrases.js";

type ReminderUser = Awaited<ReturnType<typeof resolveTelegramUser>>;

async function withThinkingMessage<T>(
  chatId: string,
  replyToMessageId: number,
  fn: () => Promise<T>,
): Promise<T> {
  const thinkingResponse = await sendTelegramMessage({
    chat_id: chatId,
    text: getRandomThinkingPhrase(),
    reply_to_message_id: replyToMessageId,
  });
  const thinkingMessageId = extractTelegramMessageId(thinkingResponse);

  try {
    return await fn();
  } finally {
    if (thinkingMessageId) {
      try {
        await deleteTelegramMessage({
          chat_id: chatId,
          message_id: thinkingMessageId,
        });
      } catch {
        // Best-effort cleanup for the temporary thinking message.
      }
    }
  }
}

export async function handleTelegramFreeText(user: ReminderUser, message: TelegramMessage) {
  const editSessionKey = getReminderEditSessionKey(user.telegramUserId);
  const editSession = reminderEditSessions.get(editSessionKey);
  const currentReminder = editSession ? await getReminderForUser(user.id, editSession.reminderId) : null;

  if (editSession && !currentReminder) {
    reminderEditSessions.delete(editSessionKey);
    await sendTelegramMessage({
      chat_id: message.chat.id,
      text: "Invalid Reminder",
      reply_to_message_id: message.message_id,
      reply_markup: buildReplyKeyboard(),
    });
    return;
  }

  await withThinkingMessage(message.chat.id, message.message_id, async () => {
    const modelInput = editSession?.phase === "awaiting_final_reply"
      && editSession.originalText
      && editSession.clarificationQuestion
      ? [
          `Original request: ${editSession.originalText}`,
          `Clarification question: ${editSession.clarificationQuestion}`,
          `User answer: ${message.text!}`,
        ].join("\n")
      : message.text!;

    const parsed = await generateStructuredReminderAction(modelInput, {
      timezone: user.timezone,
      nowIso: new Date().toISOString(),
      reminderId: editSession?.reminderId,
      currentReminderJson: currentReminder ? JSON.stringify(currentReminder) : undefined,
      allowClarification: editSession?.phase !== "awaiting_final_reply",
    });

    if (!parsed) {
      throw new SyntaxError("Poolside returned an empty response.");
    }

    const reminder = await applyReminderWriteForUser(user.id, {
      reminderId: editSession?.reminderId,
      title: parsed.title,
      notes: parsed.notes ?? null,
      dueAt: parsed.dueAt ?? null,
      source: ReminderSource.telegram_text,
    });

    if (!reminder) {
      if (editSession) {
        reminderEditSessions.delete(editSessionKey);
        await sendTelegramMessage({
          chat_id: message.chat.id,
          text: "Invalid Reminder",
          reply_to_message_id: message.message_id,
          reply_markup: buildReplyKeyboard(),
        });
        return;
      }
      throw new Error("Failed to apply reminder update.");
    }

    if (parsed.clarification && editSession?.phase !== "awaiting_final_reply") {
      reminderEditSessions.set(editSessionKey, {
        reminderId: reminder.id,
        origin: editSession?.origin ?? "clarification",
        phase: "awaiting_final_reply",
        originalText: editSession?.originalText ?? message.text!,
        clarificationQuestion: parsed.clarification,
      });

      await sendTelegramMessage({
        chat_id: message.chat.id,
        text: escapeHtml(parsed.clarification),
        parse_mode: "HTML",
        reply_to_message_id: message.message_id,
        reply_markup: buildReplyKeyboard(),
      });
      return;
    }

    if (editSession) {
      reminderEditSessions.delete(editSessionKey);
    }

    await sendTelegramMessage({
      chat_id: message.chat.id,
      text: formatReminderCard(reminder, user.timezone),
      parse_mode: "HTML",
      reply_to_message_id: message.message_id,
      reply_markup: buildReminderInlineKeyboardForReminder(reminder),
    });
  });
}
