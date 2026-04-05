import { defineEventHandler, readBody, setResponseHeader } from "h3";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import logger from "@growserver/logger";

export default defineEventHandler(async (event) => {
  // Response Content-Type per protocol spec
  setResponseHeader(event, "Content-Type", "text/html");

  try {
    // h3 readBody auto-parses application/x-www-form-urlencoded into an object
    const body = await readBody(event);

    const growId = body?.growId as string;
    const password = body?.password as string;
    const isRegister = body?.reg === "1" || !!body?.password_confirmation;

    if (!growId || !password) {
      return { status: "error", message: "Missing credentials." };
    }

    const db = useDatabase();

    // ── Registration flow ──
    if (isRegister) {
      const passwordConfirmation = body.password_confirmation as string;

      if (password !== passwordConfirmation) {
        return { status: "error", message: "Passwords do not match." };
      }

      const existing = await db.player.get(growId.toLowerCase());
      if (existing) {
        return { status: "error", message: "Account already exists." };
      }

      await db.player.register({
        username: growId,
        displayName: growId,
        password: password,
        role: "user"
      });

      logger.info(`[LOGIN] New account registered: ${growId}`);

      const token = jwt.sign(
        { growId: growId.toLowerCase() },
        process.env.JWT_SECRET as string
      );

      return {
        status: "success",
        message: "Account Validated.",
        token,
        url: "",
        accountType: "growtopia"
      };
    }

    // ── Login flow ──
    const user = await db.player.get(growId.toLowerCase());
    if (!user) {
      return { status: "error", message: "Invalid credentials." };
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return { status: "error", message: "Invalid credentials." };
    }

    logger.info(`[LOGIN] Successful login: ${growId}`);

    const token = jwt.sign(
      { growId: growId.toLowerCase() },
      process.env.JWT_SECRET as string
    );

    return {
      status: "success",
      message: "Account Validated.",
      token,
      url: "",
      accountType: "growtopia"
    };
  } catch (e: any) {
    logger.error(`[LOGIN] Error in validate: ${e}`);
    return { status: "error", message: "An error occurred." };
  }
});
