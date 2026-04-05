import { TextPacket } from "growtopia.js";
import { Server } from "../core/Server";
import { Peer } from "../core/Peer";
import logger from "@growserver/logger";

export class ConnectListener {
  constructor(public server: Server) {
    logger.info('Listening ENet "connect" event');
  }

  public run(netID: number): void {
    const peer = new Peer(this.server, netID);

    // peer.native gives us the NativePeer snapshot with ip/port/rtt
    const native = peer.native;
    logger.info(`Peer ${netID} [${native.ip}:${native.port}] connected to port ${this.server.port}`);

    // Seed an empty entry in the cache (will be populated on login)
    this.server.data.setPeer(netID, peer.data);

    // Send ENet handshake
    peer.send(TextPacket.from(0x1));
  }
}
