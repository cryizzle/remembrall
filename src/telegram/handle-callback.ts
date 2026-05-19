import { buildReminderIcs } from "../lib/ics.js";
import {
  findReminderListSessionByCardMessageId,
  getReminderEditSessionKey,
  reminderEditSessions,
} from "../lib/sessions.js";
import {
  deleteReminderForUser,
  getReminderForUser,
  resolveTelegramUser,
  updateReminderStatusForUser,
} from "../services/reminder-service.js";
import {
  answerTelegramCallbackQuery,
  editTelegramMessageText,
  sendTelegramDocument,
  sendTelegramMessage,
} from "./api.js";
import {
  buildReplyKeyboard,
  formatDisplayName,
  formatReminderCard,
} from "./format.js";
import { editReminderListMessage } from "./reminder-list.js";
import type { TelegramCallbackQuery } from "./schemas.js";

type ReminderUser = Awaited<ReturnType<typeof resolveTelegramUser>>;
type CallbackMessage = NonNullable<TelegramCallbackQuery["message"]>;

type CallbackContext = {
  user: ReminderUser;
  message: CallbackMessage;
  callbackQuery: TelegramCallbackQuery;
  reminderId?: string;
  rawData: string;
};

type CallbackHandler = (ctx: CallbackContext) => Promise<void>;

async function handleReminderDone({ user, message, callbackQuery, reminderId }: CallbackContext) {
  if (!reminderId) return;

  const updated = await updateReminderStatusForUser(user.id, reminderId, { status: "done" });
  if (!updated) {
    await answerTelegramCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: "Invalid Reminder",
    });
    return;
  }

  const reminder = await getReminderForUser(user.id, reminderId);
  if (reminder) {
    await editTelegramMessageText({
      chat_id: message.chat.id,
      message_id: message.message_id,
      text: formatReminderCard({
        id: reminder.id,
        title: reminder.title,
        notes: reminder.notes,
        dueAt: reminder.dueAt,
        status: "done",
      }, user.timezone),
      parse_mode: "HTML",
    });
  }

  const listSession = findReminderListSessionByCardMessageId(message.chat.id, message.message_id);
  if (listSession) {
    await editReminderListMessage(user, listSession.chatId, listSession.summaryMessageId, listSession.currentPage);
  }

  await answerTelegramCallbackQuery({
    callback_query_id: callbackQuery.id,
    text: "Marked done.",
  });
}

async function handleReminderDelete({ user, message, callbackQuery, reminderId }: CallbackContext) {
  if (!reminderId) return;

  const deleted = await deleteReminderForUser(user.id, reminderId);
  if (!deleted) {
    await answerTelegramCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: "Invalid Reminder",
    });
    return;
  }

  await editTelegramMessageText({
    chat_id: message.chat.id,
    message_id: message.message_id,
    text: "Reminder deleted.",
  });

  const listSession = findReminderListSessionByCardMessageId(message.chat.id, message.message_id);
  if (listSession) {
    await editReminderListMessage(user, listSession.chatId, listSession.summaryMessageId, listSession.currentPage);
  }

  await answerTelegramCallbackQuery({
    callback_query_id: callbackQuery.id,
    text: "Deleted.",
  });
}

async function handleReminderEdit({ user, message, callbackQuery, reminderId }: CallbackContext) {
  if (!reminderId) return;

  const reminder = await getReminderForUser(user.id, reminderId);
  if (!reminder) {
    await answerTelegramCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: "Invalid Reminder",
    });
    return;
  }

  reminderEditSessions.set(getReminderEditSessionKey(user.telegramUserId), {
    reminderId,
    origin: "edit",
    phase: "initial",
  });

  await sendTelegramMessage({
    chat_id: message.chat.id,
    text: `What would you like to change for "${reminder.title}"?`,
    reply_to_message_id: message.message_id,
    reply_markup: buildReplyKeyboard(),
  });

  await answerTelegramCallbackQuery({
    callback_query_id: callbackQuery.id,
    text: "Send me the change in plain English.",
  });
}

async function handleReminderIcs({ user, message, callbackQuery, reminderId }: CallbackContext) {
  if (!reminderId) return;

  const reminder = await getReminderForUser(user.id, reminderId);
  if (!reminder) {
    await answerTelegramCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: "Invalid Reminder",
    });
    return;
  }

  const ics = buildReminderIcs(reminder);
  if (!ics) {
    await answerTelegramCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: "Reminder needs a due date first.",
    });
    return;
  }

  await sendTelegramDocument({
    chat_id: message.chat.id,
    filename: ics.filename,
    content: ics.content,
    parse_mode: "HTML",
    reply_to_message_id: message.message_id,
  });

  await answerTelegramCallbackQuery({
    callback_query_id: callbackQuery.id,
    text: "ICS file sent.",
  });
}

async function handleListPage({ user, message, callbackQuery, reminderId }: CallbackContext) {
  const pageNumber = Number(reminderId);
  if (!Number.isFinite(pageNumber)) {
    await answerTelegramCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: "Invalid page.",
    });
    return;
  }

  await editReminderListMessage(user, message.chat.id, message.message_id, pageNumber);
  await answerTelegramCallbackQuery({
    callback_query_id: callbackQuery.id,
    text: `Page ${pageNumber}`,
  });
}

function parseListActionData(rawData: string) {
  const parts = rawData.split(":");
  const reminderId = parts[1];
  const pageNumber = Number(parts[2] ?? "1");
  return { reminderId, pageNumber: Number.isFinite(pageNumber) ? pageNumber : 1 };
}

async function handleListDone({ user, message, callbackQuery, rawData }: CallbackContext) {
  const { reminderId, pageNumber } = parseListActionData(rawData);
  if (!reminderId) return;

  await updateReminderStatusForUser(user.id, reminderId, { status: "done" });
  await editReminderListMessage(user, message.chat.id, message.message_id, pageNumber);
  await answerTelegramCallbackQuery({
    callback_query_id: callbackQuery.id,
    text: "Marked done.",
  });
}

async function handleListDelete({ user, message, callbackQuery, rawData }: CallbackContext) {
  const { reminderId, pageNumber } = parseListActionData(rawData);
  if (!reminderId) return;

  await deleteReminderForUser(user.id, reminderId);
  await editReminderListMessage(user, message.chat.id, message.message_id, pageNumber);
  await answerTelegramCallbackQuery({
    callback_query_id: callbackQuery.id,
    text: "Deleted.",
  });
}

const callbackHandlers: Record<string, CallbackHandler> = {
  rdone: handleReminderDone,
  rdelete: handleReminderDelete,
  redit: handleReminderEdit,
  rics: handleReminderIcs,
  lpage: handleListPage,
  ldone: handleListDone,
  ldelete: handleListDelete,
};

export async function handleTelegramCallbackQuery(callbackQuery: TelegramCallbackQuery) {
  const message = callbackQuery.message;
  if (!message) {
    await answerTelegramCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: "That action is no longer available.",
      show_alert: false,
    });
    return;
  }

  if (message.chat.type !== "private") {
    await answerTelegramCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: "Private chats only.",
    });
    return;
  }

  const user = await resolveTelegramUser({
    telegramUserId: callbackQuery.from.id,
    telegramChatId: message.chat.id,
    displayName: formatDisplayName(callbackQuery.from),
  });

  const [action, reminderId] = callbackQuery.data.split(":");
  const handler = action ? callbackHandlers[action] : undefined;

  if (!handler) {
    await answerTelegramCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: "Unknown action.",
    });
    return;
  }

  await handler({
    user,
    message,
    callbackQuery,
    reminderId,
    rawData: callbackQuery.data,
  });
}
