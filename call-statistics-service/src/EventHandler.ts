import { AnswerEvent, HangUpEvent, NewCallEvent } from "sipgateio";
import { openDatabaseConnection } from "./database";
import { splitFullUserId } from "./utils";

export default class EventHandler {
  private database;

  public constructor() {
    this.database = openDatabaseConnection();
  }

  public handleOnNewCall(newCallEvent: NewCallEvent) {
    const fullUserId =
      newCallEvent.fullUserIds.length == 1 ? newCallEvent.fullUserIds[0] : null;
    const webUserInformation = fullUserId ? splitFullUserId(fullUserId) : null;

    this.database.query(
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
    );
  }

  public handleOnAnswer(answerEvent: AnswerEvent) {}

  public handleOnHangUp(hangUpEvent: HangUpEvent) {}
}
