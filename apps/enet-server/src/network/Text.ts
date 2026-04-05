import { TextPacket, Variant } from "growtopia.js";
import { Server } from "../core/Server";
import { Peer } from "../core/Peer";
import { parseAction } from "@growserver/utils";
import { PacketTypes } from "@growserver/const";
import logger from "@growserver/logger";
import bcrypt from "bcryptjs";

export class ITextPacket {
  public obj: Record<string, string | number>;

  constructor(
    public server: Server,
    public peer: Peer,
    public chunk: Buffer,
  ) {
    this.obj = parseAction(chunk);
  }

  public async execute() {
    if (this.obj.action) return;

    logger.debug(`[ITextPacket] Received: ${JSON.stringify(this.obj)}`);

    if (this.obj.tankIDName && this.obj.tankIDPass) {
      await this.validateLogin();
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async invalidInfoResponse() {
    this.peer.send(
      Variant.from(
        "OnConsoleMessage",
        "`4Failed`` logging in to that account. Please make sure you've provided the correct info.",
      ),
      TextPacket.from(
        PacketTypes.ACTION,
        "action|set_url",
        "url||http://127.0.0.1/recover",
        "label|`$Recover your Password``",
      ),
    );
    this.peer.disconnect();
  }

  /**
   * Validate player login credentials (tankIDName / tankIDPass).
   *
   * This is the main auth gate on the enet game ports.
   * Player data is loaded from MongoDB and seeded into the runtime peer cache.
   */
  private async validateLogin() {
    try {
      const growId   = String(this.obj.tankIDName).toLowerCase();
      const password = String(this.obj.tankIDPass);

      // Load player document (fully typed via IPlayer)
      const player = await this.server.database.player.get(growId);
      if (!player) throw new Error(`Player "${growId}" not found`);

      const isValid = await bcrypt.compare(password, player.password);
      if (!isValid) throw new Error("Invalid password");

      // ── Kick duplicate session if already online ─────────────────────────
      const existing = this.server.data.getPeerByName(growId);
      if (existing) {
        logger.warn(`Duplicate login for "${growId}" — kicking previous session`);
        this.peer.send(
          Variant.from(
            "OnConsoleMessage",
            "`4Already Logged In?`` This account is already connected. Kicking previous session.",
          ),
        );
        const dupPeer = new Peer(this.server, existing.netID);
        dupPeer.leaveWorld();
        dupPeer.disconnect();
      }

      // ── Build runtime peer data from the DB document ─────────────────────
      this.peer.data.name              = player.name;
      this.peer.data.displayName       = player.displayName;
      this.peer.data.rotatedLeft       = false;
      this.peer.data.country           = String(this.obj.country    ?? "us");
      this.peer.data.platformID        = String(this.obj.platformID ?? "0");
      // Mongoose exposes _id.toString() as .id
      this.peer.data.userID            = player._id as unknown as number;
      this.peer.data.role              = player.role;
      this.peer.data.gems              = player.gems;
      this.peer.data.level             = player.level;
      this.peer.data.exp               = player.exp;
      this.peer.data.world             = "EXIT";
      this.peer.data.inventory         = {
        max:   player.inventory.max,
        items: player.inventory.items.map((i) => ({ id: i.id, amount: i.amount })),
      };
      this.peer.data.clothing          = {
        hair:     player.clothing.hair,
        shirt:    player.clothing.shirt,
        pants:    player.clothing.pants,
        feet:     player.clothing.feet,
        face:     player.clothing.face,
        hand:     player.clothing.hand,
        back:     player.clothing.back,
        mask:     player.clothing.mask,
        necklace: player.clothing.necklace,
        ances:    player.clothing.ances,
      };
      this.peer.data.lastVisitedWorlds = [...player.lastVisitedWorlds];
      this.peer.data.state             = {
        mod:             0,
        canWalkInBlocks: false,
        modsEffect:      0,
        isGhost:         false,
        lava:            { damage: 0, resetStateAt: 0 },
      };

      // ── Persist populated data into the server cache ─────────────────────
      this.server.data.setPeer(this.peer.data.netID, this.peer.data);

      // ── Sync gems display ─────────────────────────────────────────────────
      this.peer.setGems(this.peer.data.gems);

      logger.info(`[Port ${this.server.port}] Player "${player.name}" authenticated (netID: ${this.peer.data.netID})`);
    } catch (e) {
      logger.error(`Login error: ${e}`);
      return this.invalidInfoResponse();
    }
  }
}
