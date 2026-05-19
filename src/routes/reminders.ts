import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { resolveAuthenticatedUser } from "../lib/auth.js";
import {
  createReminderForUser,
  createReminderInputSchema,
  deleteReminderForUser,
  getReminderForUser,
  listReminderQuerySchema,
  listRemindersForUser,
  updateReminderForUser,
  updateReminderInputSchema,
  updateReminderStatusForUser,
  updateReminderStatusInputSchema,
} from "../services/reminder-service.js";

export const reminderRoutes: FastifyPluginAsync = async (app) => {
  app.get("/me/reminders", async (request) => {
    const user = await resolveAuthenticatedUser(request);
    const query = listReminderQuerySchema.parse(request.query);

    return listRemindersForUser(user.id, query);
  });

  app.post("/me/reminders", async (request, reply) => {
    const user = await resolveAuthenticatedUser(request);
    const body = createReminderInputSchema.parse(request.body);
    const reminder = await createReminderForUser(user.id, body);

    reply.code(201);
    return { item: reminder };
  });

  app.get("/me/reminders/:id", async (request) => {
    const user = await resolveAuthenticatedUser(request);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const reminder = await getReminderForUser(user.id, params.id);
    if (!reminder) {
      throw app.httpErrors.notFound("Reminder not found.");
    }

    return { item: reminder };
  });

  app.patch("/me/reminders/:id", async (request) => {
    const user = await resolveAuthenticatedUser(request);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = updateReminderInputSchema.parse(request.body);

    const reminder = await updateReminderForUser(user.id, params.id, body);
    if (!reminder) {
      throw app.httpErrors.notFound("Reminder not found.");
    }

    return { item: reminder };
  });

  app.patch("/me/reminders/:id/status", async (request) => {
    const user = await resolveAuthenticatedUser(request);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = updateReminderStatusInputSchema.parse(request.body);

    const reminder = await updateReminderStatusForUser(user.id, params.id, body);
    if (!reminder) {
      throw app.httpErrors.notFound("Reminder not found.");
    }

    return { item: reminder };
  });

  app.delete("/me/reminders/:id", async (request) => {
    const user = await resolveAuthenticatedUser(request);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const result = await deleteReminderForUser(user.id, params.id);
    if (!result) {
      throw app.httpErrors.notFound("Reminder not found.");
    }

    return result;
  });
};
