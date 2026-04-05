import { defineEventHandler, readBody } from "h3";
import jwt from "jsonwebtoken";
import logger from "@growserver/logger";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const growId = body.data?.growId;
    const password = body.data?.password;
    const confirmPassword = body.data?.confirmPassword;

    if (!growId || !password || !confirmPassword) {
       return { status: "error", message: "Missing credentials" };
    }

    if (password !== confirmPassword) {
      return { status: "error", message: "Passwords do not match" };
    }

    const db = useDatabase();

    // Check if user exists
    const existing = await db.player.get(growId.toLowerCase());
    if (existing) {
      return { status: "error", message: "User already exists" };
    }

    // Register user
    await db.player.register({
      username: growId,
      displayName: growId,
      password: password,
      role: "user"
    });

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
    logger.error(`Error signing up: ${e}`);
    return { status: "error", message: "Unauthorized" };
  }
});
