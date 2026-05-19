import {
  getReminderListSessionKey,
  reminderListSessions,
} from "../lib/sessions.js";
import type { resolveTelegramUser } from "../services/reminder-service.js";
import { listPendingReminderPageForUser } from "../services/reminder-service.js";
import {
  deleteTelegramMessage,
  editTelegramMessageText,
  extractTelegramMessageId,
  sendTelegramMessage,
} from "./api.js";
import {
  buildReminderInlineKeyboardForReminder,
  buildReminderPageInlineKeyboard,
  buildReminderPageText,
  formatReminderCard,
} from "./format.js";

const PAGE_SIZE = 5;

type ReminderUser = Awaited<ReturnType<typeof resolveTelegramUser>>;

type ReminderCardItem = {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  status: string;
};

async function renderReminderCards(
  chatId: string,
  items: ReminderCardItem[],
  timezone: string,
) {
  const cardMessageIds: number[] = [];
  for (const reminder of items) {
    const response = await sendTelegramMessage({
      chat_id: chatId,
      text: formatReminderCard(reminder, timezone),
      parse_mode: "HTML",
      reply_markup: buildReminderInlineKeyboardForReminder(reminder),
    });

    const id = extractTelegramMessageId(response);
    if (id) {
      cardMessageIds.push(id);
    }
  }
  return cardMessageIds;
}

export async function sendReminderList(
  user: ReminderUser,
  chatId: string,
  replyToMessageId?: number,
) {
  const page = await listPendingReminderPageForUser(user.id, 1, PAGE_SIZE);
  const summaryResponse = await sendTelegramMessage({
    chat_id: chatId,
    text: buildReminderPageText({
      showingFrom: page.showingFrom,
      showingTo: page.showingTo,
      total: page.total,
    }),
    parse_mode: "HTML",
    reply_to_message_id: replyToMessageId,
    reply_markup: page.total > 0
      ? buildReminderPageInlineKeyboard(page.currentPage, page.totalPages)
      : undefined,
  });

  const summaryMessageId = extractTelegramMessageId(summaryResponse);
  if (!summaryMessageId) {
    return;
  }

  const cardMessageIds = await renderReminderCards(chatId, page.items, user.timezone);

  reminderListSessions.set(getReminderListSessionKey(chatId, summaryMessageId), {
    chatId,
    summaryMessageId,
    cardMessageIds,
    currentPage: page.currentPage,
  });
}

export async function editReminderListMessage(
  user: ReminderUser,
  chatId: string,
  messageId: number,
  requestedPage: number,
) {
  const page = await listPendingReminderPageForUser(user.id, requestedPage, PAGE_SIZE);
  const sessionKey = getReminderListSessionKey(chatId, messageId);
  const existingSession = reminderListSessions.get(sessionKey);

  if (existingSession) {
    for (const cardMessageId of existingSession.cardMessageIds) {
      try {
        await deleteTelegramMessage({
          chat_id: chatId,
          message_id: cardMessageId,
        });
      } catch {
        // Best-effort cleanup only.
      }
    }
  }

  await editTelegramMessageText({
    chat_id: chatId,
    message_id: messageId,
    text: buildReminderPageText({
      showingFrom: page.showingFrom,
      showingTo: page.showingTo,
      total: page.total,
    }),
    parse_mode: "HTML",
    reply_markup: page.total > 0
      ? buildReminderPageInlineKeyboard(page.currentPage, page.totalPages)
      : undefined,
  });

  const cardMessageIds = await renderReminderCards(chatId, page.items, user.timezone);

  reminderListSessions.set(sessionKey, {
    chatId,
    summaryMessageId: messageId,
    cardMessageIds,
    currentPage: page.currentPage,
  });
}
