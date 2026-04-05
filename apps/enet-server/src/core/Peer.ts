import type { PeerData } from "@growserver/types";
import {
  Peer as OldPeer,
  TankPacket,
  TextPacket,
  Variant,
  VariantOptions,
} from "growtopia.js";
import { Name } from "@/network/player/Name";
import { Server } from "./Server";
import {
  CharacterState,
  CLOTH_MAP,
  ClothTypes,
  NameStyles,
  PacketTypes,
  ROLE,
  TankTypes,
} from "@growserver/const";
import { getCurrentTimeInSeconds, manageArray } from "@growserver/utils";

export class Peer extends OldPeer<PeerData> {
  constructor(public server: Server, public netID: number, channelID = 0) {
    super(server.server, netID, channelID);

    const data = this.server.data.getPeer(netID);
    if (data) {
      this.data = {
        ...data,
        channelID,
        netID,
      };
    }
  }

  // ─── Country / Name ────────────────────────────────────────────────────────

  public get country(): string {
    switch (this.data.role) {
      default:
        return this.data.country;
      case ROLE.DEVELOPER:
        return "rt";
    }
  }

  public get name(): Name {
    return new Name(this.data);
  }

  public countryState() {
    const country = (pe: Peer) => pe.name.getCountryState();

    this.send(
      Variant.from({ netID: this.data.netID }, "OnCountryState", country(this)),
    );

    const world = this.currentWorld();
    if (world) {
      world.every((p) => {
        if (p.data.netID !== this.data.netID) {
          p.send(
            Variant.from(
              { netID: this.data.netID },
              "OnCountryState",
              country(this),
            ),
          );
          this.send(
            Variant.from(
              { netID: p.data.netID },
              "OnCountryState",
              country(p),
            ),
          );
        }
      });
    }
  }

  // ─── World helpers ──────────────────────────────────────────────────────────

  public currentWorld(): { every: (cb: (p: Peer) => void) => void } | undefined {
    if (!this.data.world || this.data.world === "EXIT") return undefined;

    const worldData = this.server.data.getWorld(this.data.world);
    if (!worldData) return undefined;

    const worldName = this.data.world;
    const server = this.server;

    return {
      every: (cb: (p: Peer) => void) => {
        server.data.getAllPeers().forEach((p) => {
          if (p.world === worldName) {
            cb(new Peer(server, p.netID));
          }
        });
      },
    };
  }

  public leaveWorld() {
    if (!this.data.world || this.data.world === "EXIT") return;

    // Send leave sfx
    this.send(
      TextPacket.from(
        PacketTypes.ACTION,
        "action|play_sfx",
        "file|audio/door_shut.wav",
        "delayMS|0",
      ),
    );

    const world = this.currentWorld();
    if (world) {
      world.every((p) => {
        if (p.data.netID !== this.data.netID) {
          p.send(
            Variant.from(
              "OnRemove",
              `netID|${this.data.netID}`,
              `pId|${this.data.userID}`,
            ),
          );
        }
      });
    }

    // Update world player count
    const worldData = this.server.data.getWorld(this.data.world);
    if (worldData) {
      worldData.playerCount = Math.max(0, (worldData.playerCount ?? 1) - 1);
      this.server.data.setWorld(this.data.world, worldData);
    }

    this.data.world = "EXIT";
    this.server.data.setPeer(this.data.netID, this.data);
  }

  public every(callbackfn: (peer: Peer, netID: number) => void): void {
    this.server.data.getAllPeers().forEach((p, k) => {
      callbackfn(new Peer(this.server, p.netID), k);
    });
  }

  // ─── Inventory ─────────────────────────────────────────────────────────────

  public inventory() {
    const inventory = this.data.inventory;

    this.send(
      TankPacket.from({
        type: TankTypes.SEND_INVENTORY_STATE,
        data: () => {
          const buffer = Buffer.alloc(7 + inventory.items.length * 4);

          buffer.writeUInt8(0x1, 0);
          buffer.writeUInt32LE(inventory.max, 1);
          buffer.writeUInt16LE(inventory.items.length, 5);

          let offset = 7;
          inventory.items.forEach((item) => {
            buffer.writeUInt16LE(item.id, offset);

            const isEquipped = Object.values(this.data.clothing).includes(item.id);
            const amount = isEquipped ? item.amount | (1 << 8) : item.amount;
            buffer.writeUInt16LE(amount, offset + 2);

            offset += 4;
          });

          return buffer;
        },
      }),
    );
  }

  public modifyInventory(id: number, amount: number = 1) {
    if (amount > 200 || id <= 0 || id === 112) return;

    if (this.data.inventory?.items.find((i) => i.id === id)?.amount !== 0) {
      const tank = TankPacket.from({
        packetType: 4,
        type:       TankTypes.MODIFY_ITEM_INVENTORY,
        info:       id,
        buildRange: amount < 0 ? amount * -1 : undefined,
        punchRange: amount < 0 ? undefined : amount,
      }).parse() as Buffer;

      this.send(tank);
    }

    this.server.data.setPeer(this.data.netID, this.data);
    return 0;
  }

  public addItemInven(id: number, amount = 1, drop: boolean = false) {
    const item = this.data.inventory.items.find((i) => i.id === id);

    if (!item) {
      this.data.inventory.items.push({ id, amount });
      if (!drop) this.modifyInventory(id, amount);
    } else if (item.amount < 200) {
      if (item.amount + amount > 200) item.amount = 200;
      else item.amount += amount;
      if (!drop) this.modifyInventory(id, amount);
    }

    this.server.data.setPeer(this.data.netID, this.data);
  }

  public removeItemInven(id: number, amount = 1) {
    if (id === 0 || id === -1 || id === 32 || id === 18) return;

    const item = this.data.inventory.items.find((i) => i.id === id);
    if (item) {
      item.amount -= amount;
      if (item.amount < 1) {
        this.data.inventory.items = this.data.inventory.items.filter(
          (i) => i.id !== id,
        );
      }
    }

    this.modifyInventory(id, -amount);
    this.server.data.setPeer(this.data.netID, this.data);
  }

  public searchItem(id: number) {
    return this.data.inventory?.items.find((i) => i.id === id);
  }

  // ─── Clothing ──────────────────────────────────────────────────────────────

  public sendClothes() {
    const world = this.currentWorld();
    if (world) {
      world.every((p) => {
        p.send(
          Variant.from(
            { netID: this.data.netID },
            "OnSetClothing",
            [this.data.clothing.hair, this.data.clothing.shirt, this.data.clothing.pants],
            [this.data.clothing.feet, this.data.clothing.face, this.data.clothing.hand],
            [this.data.clothing.back, this.data.clothing.mask, this.data.clothing.necklace],
            0x8295c3ff,
            [this.data.clothing.ances, 0.0, 0.0],
          ),
        );
      });
    }
  }

  // ─── State / Character ─────────────────────────────────────────────────────

  public sendState(punchID?: number, everyPeer = true) {
    const punch = punchID !== undefined ? punchID : 0;
    const tank = TankPacket.from({
      type:   TankTypes.SET_CHARACTER_STATE,
      netID:  this.data.netID,
      info:   this.data.state?.mod ?? 0,
      xPos:   1200,
      yPos:   200,
      xSpeed: 300,
      ySpeed: 600,
      xPunch: 0,
      yPunch: 0,
      state:  0,
    }).parse() as Buffer;

    tank.writeUint8(punch, 5);
    tank.writeUint8(0x80, 6);
    tank.writeUint8(0x80, 7);
    tank.writeFloatLE(125.0, 20);

    this.send(tank);

    if (everyPeer) {
      const world = this.currentWorld();
      if (world) {
        world.every((p) => {
          if (p.data.netID !== this.data.netID) {
            p.send(tank);
          }
        });
      }
    }
  }

  // ─── Sound / Particles ─────────────────────────────────────────────────────

  public sound(file: string, delay = 100) {
    this.send(
      TextPacket.from(
        PacketTypes.ACTION,
        "action|play_sfx",
        `file|${file}`,
        `delayMS|${delay}`,
      ),
    );
  }

  public sendSFX(file: string, delayMs: number) {
    this.send(
      TextPacket.from(
        PacketTypes.ACTION,
        "action|play_sfx",
        `file|${file}`,
        `delayMS|${delayMs}`,
      ),
    );
  }

  public sendOnPlayPositioned(file: string, opts?: VariantOptions) {
    this.send(Variant.from(opts, "OnPlayPositioned", file));
  }

  public sendEffect(eff: number, ...args: Variant[]) {
    const world = this.currentWorld();
    if (world) {
      world.every((p) => {
        p.send(
          Variant.from("OnParticleEffect", eff, [
            (this.data.x as number) + 10,
            (this.data.y as number) + 16,
          ]),
          ...args,
        );
      });
    }
  }

  // ─── Messaging ─────────────────────────────────────────────────────────────

  public sendConsoleMessage(message: string, opts?: VariantOptions) {
    this.send(Variant.from(opts, "OnConsoleMessage", message));
  }

  public sendTextBubble(message: string, stacked: boolean, netID?: number) {
    this.send(
      Variant.from(
        "OnTalkBubble",
        netID ?? this.data.netID,
        message,
        0,
        stacked ? 1 : 0,
      ),
    );
  }

  // ─── Gems ──────────────────────────────────────────────────────────────────

  /**
   * Updates the current peer's gem (bux) amount.
   *
   * @param amount - The new gem amount.
   * @param skip_animation - Whether to skip the gem animation (0 = show, 1 = skip). Default 0.
   */
  public setGems(amount: number, skip_animation: number = 0) {
    this.send(
      Variant.from("OnSetBux", amount, skip_animation, 0, [
        getCurrentTimeInSeconds(),
        0.0,
        0.0,
      ]),
    );
  }

  // ─── Utility ───────────────────────────────────────────────────────────────

  public isValid(): boolean {
    return this.data && this.data.netID !== undefined;
  }

  public canAddItemToInv(itemID: number, amount: number = 1): boolean {
    const inventoryItem = this.data.inventory.items.find(
      (invItem) => invItem.id == itemID,
    );

    if (
      (inventoryItem && inventoryItem.amount >= 200) ||
      (!inventoryItem && this.data.inventory.items.length >= this.data.inventory.max)
    ) {
      return false;
    }

    return true;
  }

  public async saveToDatabase() {
    if (this.data.name) {
      await this.server.database.player.update(this.data.name, {
        displayName: this.data.displayName,
        clothing:    this.data.clothing,
        inventory:   this.data.inventory,
        role:        this.data.role,
      });
    }
  }
}