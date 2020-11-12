import {
  AnswerEvent,
  HangUpEvent,
  NewCallEvent,
  sipgateIO,
  createNumbersModule,
  SipgateIOClient,
} from "sipgateio";
import { DatabaseConnection, openDatabaseConnection } from "./database";
import { isTokenExpired, splitFullUserId } from "./utils";
import { NumberResponseItem } from "sipgateio/dist/numbers";
import AuthServer from "./AuthServer";

export default class EventHandler {
  private database: DatabaseConnection;

  private authServer: AuthServer;

  private sipgateIoClient: SipgateIOClient;

  public constructor(database: DatabaseConnection, authServer: AuthServer) {
    this.database = database;
    this.authServer = authServer;
  }

  private createAuthenticatedSipgateioClient = async () => {
    let { accessToken } = this.authServer.getAuthCredentials();

    if (isTokenExpired(accessToken)) {
      accessToken = await this.authServer.refreshTokens();
      this.sipgateIoClient = sipgateIO({ token: accessToken });
    }

    if (!this.sipgateIoClient) {
      this.sipgateIoClient = sipgateIO({ token: accessToken });
    }
  };

  private getGroupInformation = async (
    queryNumber: string
  ): Promise<NumberResponseItem | undefined> => {
    await this.createAuthenticatedSipgateioClient();

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
    console.log(`newCall from ${newCallEvent.from} to ${newCallEvent.to}`);

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
    console.log(`answer from ${answerEvent.from} to ${answerEvent.to}`);

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
    console.log(`hangup from ${hangUpEvent.from} to ${hangUpEvent.to}`);

    await this.database.query(
      "UPDATE calls SET end=?, hangup_cause=? WHERE call_id=?",
      [new Date(), hangUpEvent.cause, hangUpEvent.callId]
    );
  }
}
