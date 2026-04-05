import { Peer } from "../core/Peer";
import { Server } from "../core/Server";
import { TankPacket } from "growtopia.js";
import { TankTypes } from "@growserver/const";
import logger from "@growserver/logger";

export interface ITank {
  execute(): Promise<void>;
}

// Tank type registry — add tank handler classes here as they are implemented
export const TankMap: Record<number, new (server: Server, peer: Peer, tank: TankPacket, worldName: string) => ITank> = {
  // e.g. [TankTypes.TILE_CHANGE_REQ]: TileChangeReqTank,
};

export class ITankPacket {
  public tank: TankPacket;

  constructor(
    public server: Server,
    public peer: Peer,
    public chunk: Buffer,
  ) {
    this.tank = TankPacket.fromBuffer(chunk);
  }

  public async execute() {
    const tankType = this.tank.data?.type as number;
    const worldName = this.peer.data.world ?? "EXIT";

    logger.debug(
      `[DEBUG] Receive tank packet of ${TankTypes[tankType]} (${tankType}): ${this.tank.parse()?.toString("hex")}`,
    );

    try {
      const Class = TankMap[tankType];

      if (!Class) {
        logger.debug(`No TankPacket handler found for type ${TankTypes[tankType]} (${tankType})`);
        return;
      }

      const tnk = new Class(this.server, this.peer, this.tank, worldName);
      await tnk.execute();
    } catch (e) {
      logger.warn(`TankPacket type ${TankTypes[tankType]} error: ${e}`);
    }
  }
}
