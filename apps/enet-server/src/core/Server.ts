import dayjs from "dayjs";
import { ServerState } from "@growserver/const";
import { Collection } from "@growserver/utils";
import { Client } from "growtopia.js";
import { CooldownOptions, PeerData, WorldData } from "@growserver/types";
import { Debug, ThrowError } from "@/decorators";
import { Database } from "@growserver/db";
import logger from "@growserver/logger";
import { ConnectListener } from "@/events/Connect";
import { DisconnectListener } from "@/events/Disconnect";
import { RawListener } from "@/events/Raw";

interface CacheEntry<T> {
  data: T;
  lastAccessed: number;
  createdAt: number;
}


export class Server {
  public server: Client;
  public stats: ServerStats;
  public data: ServerData;

  constructor(public database: Database, public ip: string, public port: number, public usingNewServerPacket = true) {
    this.server = new Client({
      enet: {
        ip:                 this.ip,
        port:               this.port,
        useNewServerPacket: this.usingNewServerPacket,
      },
    });
    this.data = new ServerData(this.database);
    this.stats = new ServerStats();
  }

  /**
   * Wire up ENet event listeners (connect / disconnect / raw).
   * Must be called after server.listen().
   */
  public loadEvents(): void {
    const connect    = new ConnectListener(this);
    const disconnect = new DisconnectListener(this);
    const raw        = new RawListener(this);

    this.server.on("connect",    (netID)                   => connect.run(netID));
    this.server.on("disconnect", (netID)                   => disconnect.run(netID));
    this.server.on("raw",        (netID, channelID, data)  => raw.run(netID, channelID, data));
  }

  /**
   * Number of online peers, optionally excluding certain netIDs.
   */
  public getPlayersOnline(ignoredNetIDs: number[] = [0]): number {
    let count = 0;
    this.data.getAllPeers().forEach((_, netID) => {
      if (!ignoredNetIDs.includes(netID)) count++;
    });
    return count;
  }

  /**
   * Save all peers to database and optionally disconnect them.
   */
  public async saveAll(disconnectAll = false): Promise<boolean> {
    logger.info(`[Port ${this.port}] Saving ${this.getPlayersOnline()} peers`);
    let ok = true;

    for (const [netID, peerData] of this.data.getAllPeers()) {
      try {
        if (peerData.name) {
          await this.database.player.update(peerData.name, {
            displayName:       peerData.displayName,
            role:              peerData.role,
            clothing:          peerData.clothing,
            inventory:         peerData.inventory,
            gems:              peerData.gems,
            level:             peerData.level,
            exp:               peerData.exp,
            lastVisitedWorlds: peerData.lastVisitedWorlds ?? [],
          });
        }
        if (disconnectAll) {
          // Lazy-import Peer to avoid circular dependency
          const { Peer } = await import("@/core/Peer");
          const p = new Peer(this, netID);
          p.disconnect("now");
        }
      } catch (e) {
        logger.error(`Failed to save peer ${netID}: ${e}`);
        ok = false;
      }
    }

    return ok;
  }

  @Debug()
  @ThrowError("Failed to shutdown server")
  public async shutdown() {
    this.stats.setState(ServerState.STOPPING);
    await this.saveAll(true);
    this.server.host.flush();
    this.stats.updateShutdownNow();
    this.stats.setState(ServerState.STOPPED);
  }
}


export class ServerStats {
  public uptime: number;
  public state: ServerState;
  public lastShutdown?: number;

  constructor() {
    this.uptime = this.getCurrentUnix();
    this.state = ServerState.STOPPED;
  }

  public setState(s: ServerState) {
    this.state = s;
  }

  @Debug()
  public updateShutdownNow() {
    this.lastShutdown = this.getCurrentUnix();
  }

  private getCurrentUnix() {
    return dayjs(new Date()).unix();
  }
}

export class ServerData { 
  public peers: Collection<number, CacheEntry<PeerData>>;
  public worlds: Collection<string, CacheEntry<WorldData>>;
  public cooldown: Collection<string, CooldownOptions>;

  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds
  private readonly MAX_CACHE_SIZE = 1000;

  // We put this database on constructor since we want only 1 connection established
  constructor(public database: Database) {
    this.peers = new Collection();
    this.worlds = new Collection();
    this.cooldown = new Collection();
  }

  /**
   * Get a peer from cache by netID
   */
  @Debug()
  public getPeer(netID: number): PeerData | undefined {
    const entry = this.peers.get(netID);
    
    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.peers.delete(netID);
      return undefined;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  /**
   * Get a peer from cache by name.
   * NOTE: In enet-server, PeerData is runtime state seeded at login —
   * the DB document does not carry fields like netID, world, state, etc.
   * So this method only searches the in-memory cache.
   */
  @Debug()
  public getPeerByName(name: string): PeerData | undefined {
    for (const [, entry] of this.peers) {
      if (entry.data.name === name && !this.isExpired(entry)) {
        entry.lastAccessed = Date.now();
        logger.debug(`Peer ${name} found in cache`);
        return entry.data;
      }
    }
    return undefined;
  }

  /**
   * Set a peer in cache
   */
  @Debug()
  public setPeer(netID: number, data: PeerData): void {
    // Enforce max size by evicting least recently used
    if (this.peers.size >= this.MAX_CACHE_SIZE && !this.peers.has(netID)) {
      this.evictLRUPeer();
    }

    const entry: CacheEntry<PeerData> = {
      data,
      lastAccessed: Date.now(),
      createdAt:    Date.now(),
    };

    this.peers.set(netID, entry);
  }

  /**
   * Delete a peer from cache
   */
  @Debug()
  public deletePeer(netID: number): boolean {
    return this.peers.delete(netID);
  }

  /**
   * Get a world from cache by name
   */
  @Debug()
  public getWorld(worldName: string): WorldData | undefined {
    const entry = this.worlds.get(worldName);
    
    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.worlds.delete(worldName);
      return undefined;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  /**
   * Get a world from cache, or load and map from database if not found.
   */
  @Debug()
  @ThrowError("Failed to get or load world")
  public async getOrLoadWorld(worldName: string): Promise<WorldData | undefined> {
    const entry = this.worlds.get(worldName);

    // Return cached if fresh
    if (entry && !this.isExpired(entry)) {
      entry.lastAccessed = Date.now();
      logger.debug(`World ${worldName} found in cache`);
      return entry.data;
    }

    // Not in cache or expired — load from database and map to WorldData
    logger.debug(`World ${worldName} not in cache, loading from database`);
    const doc = await this.database.world.get(worldName);
    if (!doc) return undefined;

    const { ExtendBuffer } = await import("@growserver/utils");
    const tileMap = new ExtendBuffer(0);
    tileMap.data = doc.tilesData as Buffer;

    const worldData: WorldData = {
      name:       doc.name,
      width:      doc.width,
      height:     doc.height,
      tileMap,
      tileExtras: (doc.extras ?? []).map((e: { id: number; x: number; y: number; data?: unknown }) => ({
        id:   e.id,
        x:    e.x,
        y:    e.y,
        data: e.data ?? undefined,
      })),
      dropped: {
        uidCount: (doc as { droppedUidCounter?: number }).droppedUidCounter ?? 0,
        items:    (doc as { droppedItems?: unknown[] }).droppedItems as WorldData["dropped"]["items"] ?? [],
      },
      weather: {
        id:       doc.weather?.id ?? 41,
        heatWave: doc.weather?.heatWave ?? { r: 0, g: 0, b: 0 },
      },
    };

    this.setWorld(worldName, worldData);
    logger.debug(`World ${worldName} loaded from database and cached`);
    return worldData;
  }

  /**
   * Set a world in cache
   */
  @Debug()
  public setWorld(worldName: string, data: WorldData): void {
    // Enforce max size by evicting least recently used
    if (this.worlds.size >= this.MAX_CACHE_SIZE && !this.worlds.has(worldName)) {
      this.evictLRUWorld();
    }

    const entry: CacheEntry<WorldData> = {
      data,
      lastAccessed: Date.now(),
      createdAt:    Date.now(),
    };

    this.worlds.set(worldName, entry);
  }

  /**
   * Delete a world from cache
   */
  @Debug()
  public deleteWorld(worldName: string): boolean {
    return this.worlds.delete(worldName);
  }

  /**
   * Get all peers from cache (non-expired)
   */
  @Debug()
  public getAllPeers(): Collection<number, PeerData> {
    const peers = new Collection<number, PeerData>();
    this.peers.forEach((entry, netID) => {
      if (!this.isExpired(entry)) {
        peers.set(netID, entry.data);
      }
    });
    return peers;
  }

  /**
   * Get all worlds from cache (non-expired)
   */
  @Debug()
  public getAllWorlds(): Collection<string, WorldData> {
    const worlds = new Collection<string, WorldData>();
    this.worlds.forEach((entry, worldName) => {
      if (!this.isExpired(entry)) {
        worlds.set(worldName, entry.data);
      }
    });
    return worlds;
  }

  /**
   * Clear all caches
   */
  @Debug()
  public clearAll(): void {
    this.peers.clear();
    this.worlds.clear();
    this.cooldown.clear();
    logger.info("All server data caches cleared");
  }

  /**
   * Check if a cache entry has expired
   */
  private isExpired<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.createdAt > this.CACHE_TTL;
  }

  /**
   * Evict the least recently used peer from cache
   */
  @Debug()
  private evictLRUPeer(): void {
    let oldestKey: number | undefined;
    let oldestTime = Infinity;

    this.peers.forEach((entry, netID) => {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = netID;
      }
    });

    if (oldestKey !== undefined) {
      this.peers.delete(oldestKey);
      logger.debug(`Evicted peer ${oldestKey} from cache (LRU)`);
    }
  }

  /**
   * Evict the least recently used world from cache
   */
  @Debug()
  private evictLRUWorld(): void {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;

    this.worlds.forEach((entry, worldName) => {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = worldName;
      }
    });

    if (oldestKey !== undefined) {
      this.worlds.delete(oldestKey);
      logger.debug(`Evicted world ${oldestKey} from cache (LRU)`);
    }
  }

  /**
   * Clean up expired entries from caches
   */
  @Debug()
  public cleanup(): void {
    let peerExpired = 0;
    let worldExpired = 0;

    // Cleanup peers
    this.peers.forEach((entry, netID) => {
      if (this.isExpired(entry)) {
        this.peers.delete(netID);
        peerExpired++;
      }
    });

    // Cleanup worlds
    this.worlds.forEach((entry, worldName) => {
      if (this.isExpired(entry)) {
        this.worlds.delete(worldName);
        worldExpired++;
      }
    });

    if (peerExpired > 0 || worldExpired > 0) {
      logger.info(`Cache cleanup: ${peerExpired} peers, ${worldExpired} worlds expired`);
    }
  }

  /**
   * Get cache statistics
   */
  @Debug()
  public getCacheStats() {
    return {
      peers: {
        size:    this.peers.size,
        maxSize: this.MAX_CACHE_SIZE,
      },
      worlds: {
        size:    this.worlds.size,
        maxSize: this.MAX_CACHE_SIZE,
      },
      cooldowns: {
        size: this.cooldown.size,
      },
    };
  }
}