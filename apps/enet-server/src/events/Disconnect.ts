import { Server } from "../core/Server";
import { Peer } from "../core/Peer";
import logger from "@growserver/logger";

export class DisconnectListener {
  constructor(public server: Server) {
    logger.info('Listening ENet "disconnect" event');
  }

  public async run(netID: number): Promise<void> {
    const peerData = this.server.data.getPeer(netID);

    if (peerData) {
      // Leave world gracefully (notifies other players)
      if (peerData.world && peerData.world !== "EXIT") {
        const peer = new Peer(this.server, netID);
        peer.leaveWorld();
      }

      // Persist all game data to database on disconnect
      if (peerData.name) {
        try {
          await this.server.database.player.update(peerData.name, {
            displayName:       peerData.displayName,
            role:              peerData.role,
            clothing:          peerData.clothing,
            inventory:         peerData.inventory,
            gems:              peerData.gems,
            level:             peerData.level,
            exp:               peerData.exp,
            lastVisitedWorlds: peerData.lastVisitedWorlds ?? [],
          });
          logger.debug(`[Disconnect] Saved "${peerData.name}" (netID: ${netID}) to DB`);
        } catch (e) {
          logger.error(`[Disconnect] Failed to save "${peerData.name}": ${e}`);
        }
      }
    }

    logger.info(`Peer ${netID} disconnected from port ${this.server.port}`);
    this.server.data.deletePeer(netID);
  }
}
