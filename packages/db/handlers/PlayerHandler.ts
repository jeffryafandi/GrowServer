import bcrypt from "bcryptjs";
import { PlayerModel, type IPlayer, type PlayerDocument } from "../shared/schemas/schema";
import { type Db, type MongoClient } from "mongodb";

export class PlayerHandler {
  constructor(public connection: MongoClient, public db: Db) {}

  // ─── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a new player with both better-auth and GrowServer player data
   */
  public async register(options: {
    username:      string;
    displayName:   string;
    email?:        string;
    password:      string;
    role?:         "admin" | "user";
    inventoryMax?: number;
  }) {
    const {
      username,
      displayName,
      password,
      role         = "user",
      inventoryMax = 32,
    } = options;

    // Hash password
    const salt           = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if player already exists
    const existingPlayer = await PlayerModel.findOne({ name: username.toLowerCase() });
    if (existingPlayer) {
      throw new Error(`Player with username "${username}" already exists`);
    }

    const player = await PlayerModel.create({
      name:        username.toLowerCase(),
      displayName: displayName,
      password:    hashedPassword,
      role:        role,
      clothing: {
        hair: 0, shirt: 0, pants: 0,
        feet: 0, face:  0, hand:  0,
        back: 0, mask:  0, necklace: 0, ances: 0,
      },
      inventory: {
        max:   inventoryMax,
        items: [
          { id: 18, amount: 1 }, // Fist
          { id: 32, amount: 1 }, // Wrench
        ],
      },
      gems:              0,
      level:             0,
      exp:               0,
      lastVisitedWorlds: [],
    });

    return player;
  }

  // ─── Authentication ────────────────────────────────────────────────────────

  /**
   * Authenticate a player by username/password.
   * @returns The PlayerDocument if credentials are valid.
   * @throws If credentials are invalid.
   */
  public async login(username: string, password: string): Promise<PlayerDocument> {
    const player = await PlayerModel.findOne({ name: username.toLowerCase() });
    if (!player) throw new Error("Invalid username or password");

    const isPasswordValid = await bcrypt.compare(password, player.password);
    if (!isPasswordValid) throw new Error("Invalid username or password");

    return player;
  }

  /**
   * Verify a plain-text password against the stored hash.
   */
  public async verifyPassword(username: string, password: string): Promise<boolean> {
    const player = await PlayerModel.findOne({ name: username.toLowerCase() });
    if (!player) return false;
    return bcrypt.compare(password, player.password);
  }

  // ─── Reads ─────────────────────────────────────────────────────────────────

  /**
   * Get a player by username. Returns null if not found.
   */
  public async get(username: string): Promise<PlayerDocument | null> {
    return PlayerModel.findOne({ name: username.toLowerCase() });
  }

  /**
   * Get a player by Mongoose ObjectId string.
   */
  public async getById(playerId: string): Promise<PlayerDocument | null> {
    return PlayerModel.findById(playerId);
  }

  /**
   * Check if a player exists.
   */
  public async exists(username: string): Promise<boolean> {
    const player = await PlayerModel.findOne({ name: username.toLowerCase() });
    return !!player;
  }

  /**
   * Get all players (paginated).
   */
  public async getAll(limit?: number, skip?: number): Promise<PlayerDocument[]> {
    let query = PlayerModel.find();
    if (skip)  query = query.skip(skip);
    if (limit) query = query.limit(limit);
    return query.exec();
  }

  /**
   * Count total players.
   */
  public async count(): Promise<number> {
    return PlayerModel.countDocuments();
  }

  // ─── Writes ────────────────────────────────────────────────────────────────

  /**
   * Update player persistent game data.
   * All fields are optional — only provided fields will be saved.
   */
  public async update(username: string, data: {
    displayName?:       string;
    password?:          string;
    role?:              string;
    clothing?: {
      hair?:     number;
      shirt?:    number;
      pants?:    number;
      feet?:     number;
      face?:     number;
      hand?:     number;
      back?:     number;
      mask?:     number;
      necklace?: number;
      ances?:    number;
    };
    inventory?: {
      max?:   number;
      items?: Array<{ id: number; amount: number }>;
    };
    gems?:              number;
    level?:             number;
    exp?:               number;
    lastVisitedWorlds?: string[];
  }): Promise<PlayerDocument> {
    const updateData: Partial<IPlayer> = {};

    if (data.displayName !== undefined)       updateData.displayName       = data.displayName;
    if (data.role !== undefined)              updateData.role              = data.role;
    if (data.gems !== undefined)              updateData.gems              = data.gems;
    if (data.level !== undefined)             updateData.level             = data.level;
    if (data.exp !== undefined)               updateData.exp               = data.exp;
    if (data.lastVisitedWorlds !== undefined) updateData.lastVisitedWorlds = data.lastVisitedWorlds;

    if (data.password) {
      const salt         = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(data.password, salt);
    }

    if (data.clothing) {
      updateData.clothing = data.clothing as IPlayer["clothing"];
    }

    if (data.inventory) {
      updateData.inventory = data.inventory as IPlayer["inventory"];
    }

    const player = await PlayerModel.findOneAndUpdate(
      { name: username.toLowerCase() },
      { $set: updateData },
      { new: true },
    );

    if (!player) {
      throw new Error(`Player with username "${username}" not found`);
    }

    return player;
  }

  /**
   * Delete a player.
   */
  public async delete(username: string): Promise<boolean> {
    const player = await PlayerModel.findOne({ name: username.toLowerCase() });
    if (!player) throw new Error(`Player with username "${username}" not found`);

    await PlayerModel.findByIdAndDelete(player._id);
    return true;
  }

  // ─── Inventory Helpers ─────────────────────────────────────────────────────

  /**
   * Add an item to player inventory.
   */
  public async addItem(username: string, itemId: number, amount: number): Promise<PlayerDocument> {
    const player = await PlayerModel.findOne({ name: username.toLowerCase() });
    if (!player) throw new Error(`Player with username "${username}" not found`);

    const existingItem = player.inventory.items.find((item) => item.id === itemId);
    if (existingItem) {
      existingItem.amount += amount;
    } else {
      player.inventory.items.push({ id: itemId, amount });
    }

    await player.save();
    return player;
  }

  /**
   * Remove an item from player inventory.
   */
  public async removeItem(username: string, itemId: number, amount: number): Promise<PlayerDocument> {
    const player = await PlayerModel.findOne({ name: username.toLowerCase() });
    if (!player) throw new Error(`Player with username "${username}" not found`);

    const existingItem = player.inventory.items.find((item) => item.id === itemId);
    if (!existingItem) throw new Error(`Item with id ${itemId} not found in inventory`);

    existingItem.amount -= amount;
    if (existingItem.amount <= 0) {
      const idx = player.inventory.items.findIndex((item) => item.id === itemId);
      if (idx !== -1) player.inventory.items.splice(idx, 1);
    }

    await player.save();
    return player;
  }

  /**
   * Update player clothing.
   */
  public async updateClothing(username: string, clothing: Partial<IPlayer["clothing"]>): Promise<PlayerDocument> {
    const player = await PlayerModel.findOneAndUpdate(
      { name: username.toLowerCase() },
      { $set: { clothing } },
      { new: true },
    );

    if (!player) throw new Error(`Player with username "${username}" not found`);
    return player;
  }

  /**
   * Add gems to player.
   */
  public async addGems(username: string, amount: number): Promise<PlayerDocument> {
    const player = await PlayerModel.findOneAndUpdate(
      { name: username.toLowerCase() },
      { $inc: { gems: amount } },
      { new: true },
    );
    if (!player) throw new Error(`Player with username "${username}" not found`);
    return player;
  }

  /**
   * Add XP to player (handles level-up automatically).
   */
  public async addExp(username: string, amount: number): Promise<PlayerDocument> {
    const player = await PlayerModel.findOne({ name: username.toLowerCase() });
    if (!player) throw new Error(`Player with username "${username}" not found`);

    const MAX_LEVEL = 125;
    if (player.level >= MAX_LEVEL) {
      player.exp = 0;
      await player.save();
      return player;
    }

    player.exp += amount;

    // Check for level-up (formula: 50 * (lvl² + 2))
    const required = 50 * (player.level * player.level + 2);
    if (player.exp >= required && player.level < MAX_LEVEL) {
      player.level++;
      player.exp = 0;
    }

    await player.save();
    return player;
  }
}
