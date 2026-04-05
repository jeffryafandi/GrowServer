import { defineEventHandler, readBody, createError } from "h3";
import bcrypt from "bcryptjs";
import logger from "@growserver/logger";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { growId, password, valKey } = body;

    if (!growId || !password) {
      throw createError({
        statusCode: 400,
        message: "Missing credentials",
      });
    }

    logger.info(`[WEBSITE] [AUTH] Login attempt for GrowID: ${growId}`);

    const db = useDatabase();

    const player = await db.player.get(growId.toLowerCase());
    
    if (!player) {
      logger.warn(`[WEBSITE] [AUTH] Login failed: Player ${growId} not found`);
      throw createError({
        statusCode: 401,
        message: "Invalid GrowID or password.",
      });
    }

    const isValid = await bcrypt.compare(password, player.password);
    if (!isValid) {
      logger.warn(`[WEBSITE] [AUTH] Login failed: Wrong password for ${growId}`);
      throw createError({
        statusCode: 401,
        message: "Invalid GrowID or password.",
      });
    }

    logger.info(`[WEBSITE] [AUTH] Login successful for ${growId}`);

    // In Growtopia, successful dashboard login usually means the server should
    // now allow the connection with the given valKey to enter the game.
    // We should probably save this session in Redis or DB.
    
    // For now, return success
    return { 
      success: true, 
      message: "Login successful",
      user: {
        growId: player.name,
      }
    };
  } catch (error: any) {
    logger.error(`[WEBSITE] [AUTH] Login error: ${error.message}`);
    throw error;
  }
});
