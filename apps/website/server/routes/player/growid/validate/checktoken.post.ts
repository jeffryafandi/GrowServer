import { defineEventHandler, readBody, setResponseHeader } from "h3";
import jwt from "jsonwebtoken";
import logger from "@growserver/logger";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Content-Type", "text/html");

  try {
    // The body is application/x-www-form-urlencoded with refreshToken + clientData
    const body = await readBody(event);
    const refreshToken = body?.refreshToken as string;

    if (!refreshToken) {
      return { status: "error", message: "Invalid or expired token." };
    }

    // Verify the existing token
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_SECRET as string
    ) as { growId: string };

    logger.info(`[LOGIN] Token refresh for: ${decoded.growId}`);

    // Issue a fresh token
    const token = jwt.sign(
      { growId: decoded.growId },
      process.env.JWT_SECRET as string
    );

    return {
      status: "success",
      message: "Account Validated.",
      token,
      url: "",
      accountType: "growtopia",
      accountAge: 0
    };
  } catch (e: any) {
    logger.error(`[LOGIN] Token validation failed: ${e}`);
    return { status: "error", message: "Invalid or expired token." };
  }
});
