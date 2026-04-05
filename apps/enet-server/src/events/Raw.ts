import { PacketTypes } from "@growserver/const";
import { Server } from "../core/Server";
import { Peer } from "../core/Peer";
import { IActionPacket } from "../network/Action";
import { ITextPacket } from "../network/Text";
import { ITankPacket } from "../network/Tank";
import { Variant } from "growtopia.js";
import logger from "@growserver/logger";

export class RawListener {
  constructor(public server: Server) {
    logger.info('Listening ENet "raw" event');
  }

  public run(netID: number, _channelID: number, chunk: Buffer): void {
    const peer = new Peer(this.server, netID);
    const type = chunk.readInt32LE();

    switch (type) {
      case PacketTypes.STR:
      case PacketTypes.ACTION: {
        new ITextPacket(this.server, peer, chunk).execute();
        new IActionPacket(this.server, peer, chunk).execute();
        break;
      }

      case PacketTypes.TANK: {
        if (chunk.length < 60) {
          peer.send(
            Variant.from("OnConsoleMessage", "Received invalid tank packet."),
          );
          return peer.disconnect();
        }

        new ITankPacket(this.server, peer, chunk).execute();
        break;
      }

      default: {
        logger.debug(`Unknown PacketType of ${type}: ${chunk.toString("hex")}`);
        break;
      }
    }
  }
}
