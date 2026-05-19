import type { TelegramUser } from "./schemas.js";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

export function formatDisplayName(messageFrom: TelegramUser) {
  const fullName = [messageFrom.first_name, messageFrom.last_name].filter(Boolean).join(" ").trim();
  return fullName || messageFrom.username || `telegram:${messageFrom.id}`;
}

export function formatDueDate(dueAt: string | null, timezone = "UTC") {
  if (!dueAt) {
    return "No due time";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(dueAt));
}

type ReminderCardInput = {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  status: string;
};

export function formatReminderCard(reminder: ReminderCardInput, timezone = "UTC") {
  const notesText = reminder.notes?.trim() ? reminder.notes.trim() : "-";
  const lines = [
    `<b>${escapeHtml(reminder.title)}</b>`,
    "",
    `Due: ${escapeHtml(formatDueDate(reminder.dueAt, timezone))}`,
    `Notes: ${escapeHtml(notesText)}`,
  ];

  return lines.join("\n");
}

export function buildReminderInlineKeyboardForReminder(reminder: {
  id: string;
  dueAt: string | null;
}) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [[
    { text: "Done ✅", callback_data: `rdone:${reminder.id}` },
    { text: "Delete 🗑️", callback_data: `rdelete:${reminder.id}` },
    { text: "Edit 📝", callback_data: `redit:${reminder.id}` },
  ]];

  if (reminder.dueAt) {
    rows.push([
      { text: "Generate ICS 📅", callback_data: `rics:${reminder.id}` },
    ]);
  }

  return {
    inline_keyboard: rows,
  };
}

export function buildReplyKeyboard() {
  return {
    keyboard: [[
      { text: "Show reminders" },
      { text: "Help" },
    ]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function buildReminderPageText(pagination: {
  showingFrom: number;
  showingTo: number;
  total: number;
}) {
  if (pagination.total === 0) {
    return "Showing reminders 0-0\nTotal pending reminders: 0";
  }

  return [
    `Showing reminders ${pagination.showingFrom}-${pagination.showingTo}`,
    `Total pending reminders: ${pagination.total}`,
  ].join("\n");
}

export function buildReminderPageInlineKeyboard(currentPage: number, totalPages: number) {
  const navRow: Array<{ text: string; callback_data: string }> = [];
  if (currentPage > 1) {
    navRow.push({ text: "View Previous ⬅️", callback_data: `lpage:${currentPage - 1}` });
  }
  if (currentPage < totalPages) {
    navRow.push({ text: "View Next ➡️", callback_data: `lpage:${currentPage + 1}` });
  }

  return {
    inline_keyboard: navRow.length > 0 ? [navRow] : [],
  };
}

export function buildHelpText() {
  return [
    "<b>Remembrall</b> helps you keep track of your reminders.",
    "",
    "<b>Examples</b>",
    "• remind me to bring my charger tomorrow at 8am",
    "• call mom next Tuesday at 6pm",
    "• dinner with Mary tomorrow",
    "",
    "Just send me a reminder and I'll track it for you.",
  ].join("\n");
}

export function extractCommand(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const [rawCommand, ...rest] = trimmed.split(/\s+/);
  const command = rawCommand.split("@")[0]?.toLowerCase() ?? rawCommand.toLowerCase();
  return {
    command,
    args: rest.join(" ").trim(),
  };
}
