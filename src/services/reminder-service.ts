import { ReminderSource, ReminderStatus, type Reminder } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";

export const createReminderInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).optional().nullable(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
  source: z.nativeEnum(ReminderSource).optional(),
});

export const updateReminderInputSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  dueAt: z.string().datetime({ offset: true }).optional().nullable(),
});

export const updateReminderStatusInputSchema = z.object({
  status: z.enum(["pending", "done", "cancelled"]),
});

export const listReminderQuerySchema = z.object({
  status: z.enum(["pending", "done", "cancelled"]).optional(),
  dueBefore: z.string().datetime({ offset: true }).optional(),
  dueAfter: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

export type CreateReminderInput = z.infer<typeof createReminderInputSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderInputSchema>;
export type UpdateReminderStatusInput = z.infer<typeof updateReminderStatusInputSchema>;
export type ListReminderQuery = z.infer<typeof listReminderQuerySchema>;
export type ReminderWriteInput = {
  reminderId?: string;
  title: string;
  notes?: string | null;
  dueAt?: string | null;
  source?: ReminderSource;
};

export function serializeReminder(reminder: Reminder) {
  return {
    id: reminder.id,
    title: reminder.title,
    notes: reminder.notes,
    dueAt: reminder.dueAt?.toISOString() ?? null,
    status: reminder.status,
    source: reminder.source,
    completedAt: reminder.completedAt?.toISOString() ?? null,
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
  };
}

async function findOwnedReminderId(userId: string, reminderId: string) {
  const owned = await prisma.reminder.findFirst({
    where: { id: reminderId, userId },
    select: { id: true },
  });
  return owned?.id ?? null;
}

export async function listRemindersForUser(userId: string, query: ListReminderQuery) {
  const reminders = await prisma.reminder.findMany({
    where: {
      userId,
      status: query.status as ReminderStatus | undefined,
      dueAt: query.dueBefore || query.dueAfter
        ? {
            lte: query.dueBefore ? new Date(query.dueBefore) : undefined,
            gte: query.dueAfter ? new Date(query.dueAfter) : undefined,
          }
        : undefined,
    },
    orderBy: [
      { dueAt: "asc" },
      { createdAt: "desc" },
    ],
    take: query.limit,
    ...(query.cursor
      ? {
          skip: 1,
          cursor: { id: query.cursor },
        }
      : {}),
  });

  return {
    items: reminders.map(serializeReminder),
    nextCursor: reminders.length === query.limit ? reminders[reminders.length - 1]?.id ?? null : null,
  };
}

export async function createReminderForUser(userId: string, input: CreateReminderInput) {
  const reminder = await prisma.reminder.create({
    data: {
      userId,
      title: input.title,
      notes: input.notes ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      source: input.source ?? ReminderSource.api,
    },
  });

  return serializeReminder(reminder);
}

export async function getReminderForUser(userId: string, reminderId: string) {
  const reminder = await prisma.reminder.findFirst({
    where: {
      id: reminderId,
      userId,
    },
  });

  return reminder ? serializeReminder(reminder) : null;
}

export async function updateReminderForUser(userId: string, reminderId: string, input: UpdateReminderInput) {
  const ownedId = await findOwnedReminderId(userId, reminderId);
  if (!ownedId) {
    return null;
  }

  const reminder = await prisma.reminder.update({
    where: { id: ownedId },
    data: {
      title: input.title,
      notes: input.notes,
      dueAt: input.dueAt === undefined ? undefined : input.dueAt ? new Date(input.dueAt) : null,
    },
  });

  return serializeReminder(reminder);
}

export async function applyReminderWriteForUser(userId: string, input: ReminderWriteInput) {
  if (input.reminderId) {
    return updateReminderForUser(userId, input.reminderId, {
      title: input.title,
      notes: input.notes ?? null,
      dueAt: input.dueAt ?? null,
    });
  }

  return createReminderForUser(userId, {
    title: input.title,
    notes: input.notes ?? null,
    dueAt: input.dueAt ?? null,
    source: input.source,
  });
}

export async function updateReminderStatusForUser(
  userId: string,
  reminderId: string,
  input: UpdateReminderStatusInput,
) {
  const ownedId = await findOwnedReminderId(userId, reminderId);
  if (!ownedId) {
    return null;
  }

  const reminder = await prisma.reminder.update({
    where: { id: ownedId },
    data: {
      status: input.status,
      completedAt: input.status === "done" ? new Date() : null,
    },
  });

  return {
    id: reminder.id,
    status: reminder.status,
    completedAt: reminder.completedAt?.toISOString() ?? null,
    updatedAt: reminder.updatedAt.toISOString(),
  };
}

export async function deleteReminderForUser(userId: string, reminderId: string) {
  const ownedId = await findOwnedReminderId(userId, reminderId);
  if (!ownedId) {
    return null;
  }

  await prisma.reminder.delete({
    where: { id: ownedId },
  });

  return {
    deleted: true,
    id: ownedId,
  };
}

export async function resolveTelegramUser(input: {
  telegramUserId: string;
  telegramChatId: string;
  displayName?: string | null;
  timezone?: string | null;
}) {
  return prisma.user.upsert({
    where: { telegramUserId: input.telegramUserId },
    update: {
      telegramChatId: input.telegramChatId,
      displayName: input.displayName ?? undefined,
      timezone: input.timezone ?? undefined,
    },
    create: {
      telegramUserId: input.telegramUserId,
      telegramChatId: input.telegramChatId,
      displayName: input.displayName ?? undefined,
      timezone: input.timezone ?? "UTC",
    },
  });
}

export async function listPendingReminderPageForUser(userId: string, page: number, pageSize = 5) {
  const safePage = Math.max(1, page);
  const total = await prisma.reminder.count({
    where: {
      userId,
      status: ReminderStatus.pending,
    },
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(safePage, totalPages);
  const skip = (currentPage - 1) * pageSize;

  const reminders = await prisma.reminder.findMany({
    where: {
      userId,
      status: ReminderStatus.pending,
    },
    orderBy: [
      { dueAt: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    skip,
    take: pageSize,
  });

  return {
    items: reminders.map(serializeReminder),
    total,
    currentPage,
    totalPages,
    pageSize,
    showingFrom: total === 0 ? 0 : skip + 1,
    showingTo: total === 0 ? 0 : skip + reminders.length,
  };
}
