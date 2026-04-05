import { Schema, model, type Document, type HydratedDocument } from "mongoose";

// ─── TypeScript Interfaces ───────────────────────────────────────────────────

export interface IClothing {
  hair:     number;
  shirt:    number;
  pants:    number;
  feet:     number;
  face:     number;
  hand:     number;
  back:     number;
  mask:     number;
  necklace: number;
  ances:    number;
}

export interface IInventoryItem {
  id:     number;
  amount: number;
}

export interface IInventory {
  max:   number;
  items: IInventoryItem[];
}

export interface IPlayer {
  name:               string;
  displayName:        string;
  password:           string;
  role:               string;
  userId?:            Schema.Types.ObjectId | null;
  clothing:           IClothing;
  inventory:          IInventory;
  // ─── Game progression fields ───────────────────────────────────────────────
  gems:               number;
  level:              number;
  exp:                number;
  lastVisitedWorlds:  string[];
}

export type PlayerDocument = HydratedDocument<IPlayer>;

export interface IWorld {
  name:              string;
  width:             number;
  height:            number;
  tilesData:         Buffer;
  extras:            Array<{ id: number; x: number; y: number; data?: unknown }>;
  droppedItems:      Array<{ uid: number; id: number; amount: number; x: number; y: number; createdAt: Date }>;
  droppedUidCounter: number;
  weather:           { id: number; heatWave: { r: number; g: number; b: number } };
  owner?:            { userId?: Schema.Types.ObjectId | null; worldLock?: { x?: number; y?: number } };
}

export type WorldDocument = HydratedDocument<IWorld>;

// ─── Better-Auth Interfaces ──────────────────────────────────────────────────

export interface IUser {
  name:          string;
  email:         string;
  emailVerified: boolean;
  image?:        string;
  username?:     string;
  role?:         "admin" | "user";
  banned?:       boolean;
  banReason?:    string;
  banExpires?:   Date;
  playerId?:     Schema.Types.ObjectId;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const userSchema = new Schema<IUser>({
  name:          { type: String, required: true },
  email:         { type: String, required: true, unique: true },
  emailVerified: { type: Boolean, required: true, default: false },
  image:         { type: String },
  username:      { type: String, unique: true, sparse: true },
  role:          { type: String, enum: ["admin", "user"] },
  banned:        { type: Boolean },
  banReason:     { type: String },
  banExpires:    { type: Date },
  playerId:      { type: Schema.Types.ObjectId, ref: "Player" },
}, { timestamps: true });

const sessionSchema = new Schema({
  userId:    { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  token:     { type: String, required: true, unique: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, required: true, default: Date.now },
  updatedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

const accountSchema = new Schema({
  userId:                { type: String, required: true, index: true },
  accountId:             { type: String, required: true },
  providerId:            { type: String, required: true },
  accessToken:           { type: String },
  refreshToken:          { type: String },
  idToken:               { type: String },
  accessTokenExpiresAt:  { type: Date },
  refreshTokenExpiresAt: { type: Date },
  scope:                 { type: String },
  password:              { type: String },
  createdAt:             { type: Date, required: true, default: Date.now },
  updatedAt:             { type: Date, required: true, default: Date.now },
}, { timestamps: true });

accountSchema.index({ providerId: 1, accountId: 1 }, { unique: true });

const verificationSchema = new Schema({
  identifier: { type: String, required: true, index: true },
  value:      { type: String, required: true },
  expiresAt:  { type: Date, required: true, index: true },
  createdAt:  { type: Date, required: true, default: Date.now },
  updatedAt:  { type: Date, required: true, default: Date.now },
}, { timestamps: true });

// ─── Player Schema ────────────────────────────────────────────────────────────

const playerSchema = new Schema<IPlayer>({
  name: {
    type:      String,
    required:  true,
    unique:    true,
    lowercase: true,
    index:     true,
  },
  displayName: { type: String, required: true },
  password:    { type: String, required: true },
  role:        { type: String, required: true, default: "user" },
  userId:      { type: Schema.Types.ObjectId, ref: "User", default: null },

  // ─── Clothing ─────────────────────────────────────────────────────────────
  clothing: {
    hair:     { type: Number, required: true, default: 0 },
    shirt:    { type: Number, required: true, default: 0 },
    pants:    { type: Number, required: true, default: 0 },
    feet:     { type: Number, required: true, default: 0 },
    face:     { type: Number, required: true, default: 0 },
    hand:     { type: Number, required: true, default: 0 },
    back:     { type: Number, required: true, default: 0 },
    mask:     { type: Number, required: true, default: 0 },
    necklace: { type: Number, required: true, default: 0 },
    ances:    { type: Number, required: true, default: 0 },
  },

  // ─── Inventory ────────────────────────────────────────────────────────────
  inventory: {
    max:   { type: Number, required: true, default: 32 },
    items: [{
      _id:    false,
      id:     { type: Number, required: true },
      amount: { type: Number, required: true, default: 1 },
    }],
  },

  // ─── Game Progression ─────────────────────────────────────────────────────
  gems:              { type: Number, required: true, default: 0 },
  level:             { type: Number, required: true, default: 0 },
  exp:               { type: Number, required: true, default: 0 },
  lastVisitedWorlds: { type: [String], required: true, default: [] },
}, {
  timestamps: true,
});

// ─── World Schema ─────────────────────────────────────────────────────────────

const worldSchema = new Schema<IWorld>({
  name: {
    type:      String,
    required:  true,
    uppercase: true,
    unique:    true,
    index:     true,
  },
  width:  { type: Number, required: true, default: 100 },
  height: { type: Number, required: true, default: 60 },
  owner: {
    userId:    { type: Schema.Types.ObjectId, ref: "Player" },
    worldLock: {
      x: { type: Number },
      y: { type: Number },
    },
  },
  tilesData: {
    type:     Buffer,
    required: true,
    default:  Buffer.alloc(0),
  },
  extras: [{
    _id:  false,
    id:   { type: Number, required: true },
    x:    { type: Number, required: true },
    y:    { type: Number, required: true },
    data: { type: Schema.Types.Mixed },
  }],
  droppedItems: [{
    _id:       false,
    uid:       { type: Number, required: true },
    id:        { type: Number, required: true },
    amount:    { type: Number, default: 1 },
    x:         { type: Number, required: true },
    y:         { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  }],
  droppedUidCounter: { type: Number, default: 1 },
  weather: {
    id:       { type: Number, default: 41 },
    heatWave: {
      r: { type: Number, required: true, default: 0, min: 0, max: 255 },
      g: { type: Number, required: true, default: 0, min: 0, max: 255 },
      b: { type: Number, required: true, default: 0, min: 0, max: 255 },
    },
  },
}, {
  timestamps: true,
});

// ─── Models ───────────────────────────────────────────────────────────────────

// GrowServer models
export const PlayerModel = model<IPlayer>("Player", playerSchema);
export const WorldModel  = model<IWorld>("World", worldSchema);

// better-auth models
export const UserModel         = model<IUser>("User", userSchema);
export const SessionModel      = model("Session", sessionSchema);
export const AccountModel      = model("Account", accountSchema);
export const VerificationModel = model("Verification", verificationSchema);
