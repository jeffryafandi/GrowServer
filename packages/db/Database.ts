import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { setupSeeds } from "./scripts/seeds";
import { authConfig } from "./auth";
import { type Db, MongoClient } from "mongodb";
import mongoose from "mongoose";
import { 
  PlayerModel, 
  WorldModel, 
  UserModel, 
  SessionModel, 
  AccountModel, 
  VerificationModel 
} from "./shared/schemas/schema";
import { PlayerHandler } from "./handlers/PlayerHandler";
import { WorldHandler } from "./handlers/WorldHandler";
import { RedisHandler } from "./handlers/RedisHandler";

export class Database {
  public connection: MongoClient;
  public db: Db;
  public auth;
  public models = {
    Player:       PlayerModel,
    World:        WorldModel,
    User:         UserModel,
    Session:      SessionModel,
    Account:      AccountModel,
    Verification: VerificationModel
  };

  public player: PlayerHandler;
  public world: WorldHandler;
  public redis: RedisHandler;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL environment variable is not set. " +
        "Make sure the root .env file is loaded (e.g. via --env-file or --dotenv flag)."
      );
    }
    this.connection = new MongoClient(process.env.DATABASE_URL);

    this.db = this.connection.db();
    this.auth = betterAuth(Object.assign({
      database: mongodbAdapter(this.db, {
        client: this.connection, 
      }),
    }, authConfig));

    this.player = new PlayerHandler(this.connection, this.db);
    this.world = new WorldHandler(this.connection, this.db);
    this.redis = new RedisHandler();
  }

  public async setup() {
    // Connect Mongoose (used by PlayerModel, WorldModel, etc.)
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.DATABASE_URL as string);
    }
    await this.redis.connect();
    // await setupSeeds();
  }

  public async close() {
    await this.redis.disconnect();
    await this.connection.close();
  }
}
