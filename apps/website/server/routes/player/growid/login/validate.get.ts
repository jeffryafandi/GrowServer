import { defineEventHandler, getQuery } from "h3";
import logger from "@growserver/logger";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const token = query.token;
    if (!token) throw new Error("No token provided");

    return {
      status: "success",
      message: "Account Validated.",
      token,
      url: "",
      accountType: "growtopia"
    };
  } catch (e: any) {
    logger.warn(`Token validation failed: ${e.message}`);
    return { status: "error", message: `Unauthorized: ${e.message}` };
  }
});
