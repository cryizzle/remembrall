export type ReminderListSession = {
  chatId: string;
  summaryMessageId: number;
  cardMessageIds: number[];
  currentPage: number;
};

export type ReminderEditSession = {
  reminderId: string;
  origin: "edit" | "clarification";
  phase: "initial" | "awaiting_final_reply";
  originalText?: string;
  clarificationQuestion?: string;
};

export const reminderListSessions = new Map<string, ReminderListSession>();
export const reminderEditSessions = new Map<string, ReminderEditSession>();

export function getReminderListSessionKey(chatId: string, summaryMessageId: number) {
  return `${chatId}:${summaryMessageId}`;
}

export function getReminderEditSessionKey(telegramUserId: string) {
  return telegramUserId;
}

export function findReminderListSessionByCardMessageId(chatId: string, cardMessageId: number) {
  for (const session of reminderListSessions.values()) {
    if (session.chatId === chatId && session.cardMessageIds.includes(cardMessageId)) {
      return session;
    }
  }

  return null;
}
