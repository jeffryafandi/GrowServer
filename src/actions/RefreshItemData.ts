import { TankPacket, Variant } from "growtopia.js";
import { Peer } from "../structures/Peer";
import { Action } from "../abstracts/Action";
import { BaseServer } from "../structures/BaseServer";
import { TankTypes } from "../utils/enums/TankTypes";
import { ActionType } from "../types";

export default class extends Action {
  constructor(base: BaseServer) {
    super(base);
    this.config = {
      eventName: "refresh_item_data"
    };
  }

  public handle(peer: Peer, action: ActionType<{ action: string }>): void {
    peer.send(Variant.from("OnConsoleMessage", "One moment. Updating item data..."), TankPacket.from({ type: TankTypes.SEND_ITEM_DATABASE_DATA, data: () => this.base.items.content }));
  }
}
