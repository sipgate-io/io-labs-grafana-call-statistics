import {
  AnswerEvent,
  HangUpEvent,
  NewCallEvent,
  sipgateIO,
  createNumbersModule,
} from "sipgateio";
import { openDatabaseConnection } from "./database";
import { splitFullUserId } from "./utils";

export default class EventHandler {
  private database;

  public constructor() {
    this.database = openDatabaseConnection();
  }

  handleOnNewCall = (newCallEvent: NewCallEvent) => {
    const fullUserId =
      newCallEvent.fullUserIds.length == 1 ? newCallEvent.fullUserIds[0] : null;
    const webUserInformation = fullUserId ? splitFullUserId(fullUserId) : null;
    this.database
      .query(
        "INSERT INTO calls VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false)",
        [
          newCallEvent.callId,
          new Date(),
          null,
          null,
          newCallEvent.direction,
          webUserInformation?.masterSipId || null,
          webUserInformation?.userExtension || null,
          newCallEvent.from,
          newCallEvent.to,
          null,
          null,
          null,
        ]
      )
      .catch(console.error);

    const queryNumber =
      newCallEvent.direction == "in" ? newCallEvent.to : newCallEvent.from;

    this.getGroupInformation(queryNumber, newCallEvent.callId).then(
      console.log
    );
  };

  public handleOnAnswer(answerEvent: AnswerEvent) {}

  public handleOnHangUp(hangUpEvent: HangUpEvent) {}

  private async getGroupInformation(queryNumber: string, callId: string) {
    const client = sipgateIO({ token: process.env.SIPGATE_API_TOKEN });
    const numberModule = createNumbersModule(client);
    return await numberModule
      .getAllNumbers()
      .then((res) =>
        res.items
          .filter((endpoint: any) => endpoint.number == queryNumber)
          .filter((endpoint: any) => endpoint.endpointId.startsWith("g"))
      );
  }
}
