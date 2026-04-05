import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { config, logon } from "@growserver/config";
import logger from "@growserver/logger";

async function init() {
  const app = new Hono();
  const buns = process.versions.bun ? await import("hono/bun") : undefined;

  app.use("*", async (ctx, next) => {
    const method = ctx.req.method;
    const path = ctx.req.path;
    logger.info(`[${method}] ${path}`);
    await next();
  });

  app.all("/growtopia/server_data.php", (ctx) => {
    const randPort =
      config.web.ports[Math.floor(Math.random() * config.web.ports.length)];

    const maintKey = config.web.maintenance.enable ? "maint" : "#maint";

    const str = [
      `server|${config.web.address}`,
      `port|${randPort}`,
      `loginurl|${config.web.loginUrl}`,
      `type|1`,
      `${maintKey}|${config.web.maintenance.message}`,
      `type2|1`,
      `meta|ignoremeta`,
      `RTENDMARKERBS1001`,
    ].join("\n");

    return ctx.body(str);
  });

  const ssl = logon();

  if (process.env.RUNTIME_ENV === "node") {
    serve(
      {
        fetch: app.fetch,
        port:  config.web.port,
      },
      (info) => {
        logger.info(`Node Logon Server is running on port ${info.port}`);
      },
    );
  } else if (process.env.RUNTIME_ENV === "bun") {
    logger.info(`Bun Logon Server is running on port ${config.web.port}`);
    Bun.serve({
      fetch: app.fetch,
      port:  config.web.port,
    });
  }
}

init();
