import {
  AnswerEvent,
  HangUpEvent,
  NewCallEvent,
  sipgateIO,
  createNumbersModule,
  SipgateIOClient,
} from "sipgateio";
import { DatabaseConnection, openDatabaseConnection } from "./database";
import { splitFullUserId } from "./utils";

export default class EventHandler {
  private database: DatabaseConnection;

  private sipgateIoClient: SipgateIOClient;

  public constructor() {
    this.database = openDatabaseConnection();
    this.sipgateIoClient = sipgateIO({
      username: process.env.SIPGATE_USERNAME,
      password: process.env.SIPGATE_PASSWORD,
    });
  }

  private getGroupInformation = async (queryNumber: string) => {
    const numberModule = createNumbersModule(this.sipgateIoClient);

    return await numberModule
      .getAllNumbers()
      .then(
        (res) =>
          res.items
            .filter((endpoint: any) => endpoint.number == queryNumber)
            .filter((endpoint: any) => endpoint.endpointId.startsWith("g"))[0]
      );
  };

  public handleOnNewCall = (newCallEvent: NewCallEvent) => {
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
      (groupEndpoint) => {
        if (groupEndpoint) {
          this.database
            .query(
              "INSERT INTO groups VALUES(?, ?) ON DUPLICATE KEY UPDATE alias=?",
              [
                groupEndpoint.endpointId,
                groupEndpoint.endpointAlias,
                groupEndpoint.endpointAlias,
              ]
            )
            .catch(console.error);
          this.database
            .query("UPDATE calls SET group_extension=? WHERE call_id=?", [
              groupEndpoint.endpointId,
              newCallEvent.callId,
            ])
            .catch(console.error);
        }
      }
    );
  };

  public handleOnAnswer(answerEvent: AnswerEvent) {
    if (answerEvent.fullUserId) {
      const splitUserIdResult = splitFullUserId(answerEvent.fullUserId);

      this.database
        .query(
          "UPDATE calls SET answered_at=?, callee_mastersip_id=?, callee_extension=?, answering_number=? WHERE call_id=?",
          [
            new Date(),
            splitUserIdResult?.masterSipId || null,
            splitUserIdResult?.userExtension || null,
            answerEvent.answeringNumber,
            answerEvent.callId,
          ]
        )
        .catch(console.error);
    } else {
      this.database
        .query(
          "UPDATE calls SET answered_at=?, answering_number=? WHERE call_id=?",
          [new Date(), answerEvent.answeringNumber, answerEvent.callId]
        )
        .catch(console.error);
    }
  }

  public handleOnHangUp(hangUpEvent: HangUpEvent) {
    this.database
      .query("UPDATE calls SET end=?, hangup_cause=? WHERE call_id=?", [
        new Date(),
        hangUpEvent.cause,
        hangUpEvent.callId,
      ])
      .catch(console.error);
  }
}
