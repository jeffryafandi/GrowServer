import { defineEventHandler, sendRedirect, getRequestURL } from "h3";
import logger from "@growserver/logger";

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const query = url.search || "";

  logger.info(`[LOGIN] Checktoken → 307 redirect to /player/growid/validate/checktoken${query}`);

  // Protocol requires a 307 Temporary Redirect (preserves POST method + body)
  return sendRedirect(event, `/player/growid/validate/checktoken${query}`, 307);
});
