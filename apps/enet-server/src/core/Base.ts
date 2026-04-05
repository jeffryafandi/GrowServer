import logger from "@growserver/logger";
import { Server } from "./Server";
import { Database } from "@growserver/db";

export class Base {
  public servers: Server[];
  public database: Database;

  constructor() {
    this.database = new Database();
    this.servers = [
      new Server(this.database, "0.0.0.0", 17091),
      new Server(this.database, "0.0.0.0", 17092),
    ];
  }

  public init() {
    // Graceful shutdown handlers
    process.on("SIGINT",  () => this.shutdown());
    process.on("SIGTERM", () => this.shutdown());

    // Start each server instance
    this.servers.forEach((s) => {
      s.server.listen();
      s.loadEvents();
      logger.info(`ENet Server listening on port ${s.port}`);
    });

    logger.info(`${this.servers.length} ENet server(s) started`);
  }

  /** Total number of players online across all server instances. */
  public getPlayersOnline(): number {
    return this.servers.reduce((total, s) => total + s.getPlayersOnline(), 0);
  }

  /** Save all players across all server instances. */
  public async saveAll(disconnectAll = false): Promise<void> {
    await Promise.all(this.servers.map((s) => s.saveAll(disconnectAll)));
  }

  /** Gracefully shut down all server instances and save data. */
  public async shutdown(): Promise<never> {
    logger.info("Shutting down ENet servers...");
    try {
      await this.saveAll(true);
      await this.database.close();
    } catch (e) {
      logger.error(`Error during shutdown: ${e}`);
    }
    process.exit(0);
  }
}