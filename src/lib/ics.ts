import { createEvent, type EventAttributes } from "ics";

type ReminderForIcs = {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
};

function slugifyFilenamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "reminder";
}

function toIcsUtcDateArray(date: Date): EventAttributes["start"] {
  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
  ];
}

export function buildReminderIcs(reminder: ReminderForIcs) {
  if (!reminder.dueAt) {
    return null;
  }

  const { error, value } = createEvent({
    uid: `${reminder.id}@remembrall`,
    start: toIcsUtcDateArray(new Date(reminder.dueAt)),
    startInputType: "utc",
    duration: { minutes: 30 },
    title: reminder.title,
    description: reminder.notes?.trim() || "Reminder from Remembrall",
    productId: "Remembrall/Reminder Calendar",
  });

  if (error || !value) {
    return null;
  }

  return {
    filename: `${slugifyFilenamePart(reminder.title)}.ics`,
    content: value,
  };
}
