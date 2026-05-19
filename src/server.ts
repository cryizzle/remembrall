import { env } from "./lib/env.js";
import { buildApp } from "./app.js";

const app = buildApp();

async function shutdown() {
  await app.close();
}

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

app.listen({ host: env.HOST, port: env.PORT }).catch(async (error) => {
  app.log.error(error);
  await app.close();
  process.exit(1);
});
