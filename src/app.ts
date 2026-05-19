import Fastify from "fastify";
import sensible from "@fastify/sensible";

import { prisma } from "./lib/prisma.js";
import { healthRoutes } from "./routes/health.js";
import { reminderRoutes } from "./routes/reminders.js";
import { telegramRoutes } from "./routes/telegram.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      transport: process.env.NODE_ENV === "production"
        ? undefined
        : {
            target: "pino-pretty",
          },
    },
  });

  app.register(sensible);
  app.register(healthRoutes);
  app.register(reminderRoutes);
  app.register(telegramRoutes);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  return app;
}
