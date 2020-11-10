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
import { NumberResponseItem } from "sipgateio/dist/numbers";

// as specified in the docker-compose.yml
const DB_HOSTNAME = "db";

export default class EventHandler {
  private database: DatabaseConnection;

  private sipgateIoClient: SipgateIOClient;

  public constructor(credentials: AuthCredentials) {
    this.database = openDatabaseConnection(DB_HOSTNAME);
    this.sipgateIoClient = sipgateIO(credentials);
  }

  private getGroupInformation = async (
    queryNumber: string
  ): Promise<NumberResponseItem | undefined> => {
    const numberModule = createNumbersModule(this.sipgateIoClient);

    const allNumbers = await numberModule.getAllNumbers();

    return allNumbers.items
      .filter((endpoint: NumberResponseItem) => endpoint.number == queryNumber)
      .filter((endpoint: NumberResponseItem) =>
        endpoint.endpointId.startsWith("g")
      )[0];
  };

  public handleOnNewCall = async (
    newCallEvent: NewCallEvent
  ): Promise<void> => {
    const fullUserId =
      newCallEvent.fullUserIds.length == 1 ? newCallEvent.fullUserIds[0] : null;
    const webUserInformation = fullUserId ? splitFullUserId(fullUserId) : null;

    await this.database.query(
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

    const queryNumber =
      newCallEvent.direction == "in" ? newCallEvent.to : newCallEvent.from;

    const groupEndpoint = await this.getGroupInformation(queryNumber);
    if (groupEndpoint) {
      await this.database.query(
        "INSERT INTO groups VALUES(?, ?) ON DUPLICATE KEY UPDATE alias=?",
        [
          groupEndpoint.endpointId,
          groupEndpoint.endpointAlias,
          groupEndpoint.endpointAlias,
        ]
      );
      await this.database.query(
        "UPDATE calls SET group_extension=? WHERE call_id=?",
        [groupEndpoint.endpointId, newCallEvent.callId]
      );
    }
  };

  public async handleOnAnswer(answerEvent: AnswerEvent) {
    if (answerEvent.fullUserId) {
      const splitUserIdResult = splitFullUserId(answerEvent.fullUserId);

      await this.database.query(
        "UPDATE calls SET answered_at=?, callee_mastersip_id=?, callee_extension=?, answering_number=? WHERE call_id=?",
        [
          new Date(),
          splitUserIdResult?.masterSipId || null,
          splitUserIdResult?.userExtension || null,
          answerEvent.answeringNumber,
          answerEvent.callId,
        ]
      );
    } else {
      await this.database.query(
        "UPDATE calls SET answered_at=?, answering_number=? WHERE call_id=?",
        [new Date(), answerEvent.answeringNumber, answerEvent.callId]
      );
    }
  }

  public async handleOnHangUp(hangUpEvent: HangUpEvent) {
    await this.database.query(
      "UPDATE calls SET end=?, hangup_cause=? WHERE call_id=?",
      [new Date(), hangUpEvent.cause, hangUpEvent.callId]
    );
  }
}
