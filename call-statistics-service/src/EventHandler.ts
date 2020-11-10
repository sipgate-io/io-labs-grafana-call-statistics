import {
    AnswerEvent,
    HangUpEvent,
    NewCallEvent,
    sipgateIO,
    createNumbersModule,
    SipgateIOClient, AuthCredentials,
} from "sipgateio";
import { DatabaseConnection, openDatabaseConnection } from "./database";
import { splitFullUserId } from "./utils";
import {NumberResponseItem} from "sipgateio/dist/numbers";

// as specified in the docker-compose.yml
const DB_HOSTNAME = "db";

export default class EventHandler {
  private database: DatabaseConnection;

  private sipgateIoClient: SipgateIOClient;

  public constructor(credentials: AuthCredentials) {
    this.database = openDatabaseConnection(DB_HOSTNAME);
    this.sipgateIoClient = sipgateIO(credentials);
  }

  private getGroupInformation = async (queryNumber: string): Promise <NumberResponseItem | undefined> => {
    const numberModule = createNumbersModule(this.sipgateIoClient);

    const allNumbers =  await numberModule.getAllNumbers()

    return allNumbers.items
        .filter((endpoint: NumberResponseItem) => endpoint.number == queryNumber)
        .filter((endpoint: NumberResponseItem) => endpoint.endpointId.startsWith("g"))[0]
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

    this.getGroupInformation(queryNumber).then(
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
