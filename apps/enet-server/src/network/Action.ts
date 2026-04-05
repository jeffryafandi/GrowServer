import { Peer } from "../core/Peer";
import { Server } from "../core/Server";
import { parseAction } from "@growserver/utils";
import logger from "@growserver/logger";

export interface IAction {
  execute(obj: Record<string, string>): Promise<void>;
}

// Action registry — add action classes here as they are implemented
export const ActionMap: Record<string, new (server: Server, peer: Peer) => IAction> = {
  // e.g. join_request: JoinRequestAction,
};

export class IActionPacket {
  public obj: Record<string, string>;

  constructor(
    public server: Server,
    public peer: Peer,
    public chunk: Buffer,
  ) {
    this.obj = parseAction(chunk) as Record<string, string>;
  }

  public async execute() {
    if (!this.obj.action) return;
    logger.debug(`Receive action packet: ${JSON.stringify(this.obj)}`);

    const actionType = this.obj.action;

    try {
      const Class = ActionMap[actionType];

      if (!Class) {
        logger.debug(`No Action handler found for action "${actionType}"`);
        return;
      }

      const action = new Class(this.server, this.peer);
      await action.execute(this.obj);
    } catch (e) {
      logger.warn(`Action "${actionType}" error: ${e}`);
    }
  }
}
