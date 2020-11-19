import {
  AnswerEvent,
  HangUpEvent,
  NewCallEvent,
  sipgateIO,
  createNumbersModule,
  SipgateIOClient,
} from "sipgateio";
import Database from "./database";
import { isTokenExpired, splitFullUserId } from "./utils";
import { NumberResponseItem } from "sipgateio/dist/numbers";
import AuthServer from "./AuthServer";

const baseUrl = process.env.SERVICE_BASE_URL;

export default class EventHandler {
  private database: Database;

  private authServer: AuthServer;

  private sipgateIoClient: SipgateIOClient;

  public constructor(database: Database, authServer: AuthServer) {
    this.database = database;
    this.authServer = authServer;
  }

  private createAuthenticatedSipgateioClient = async () => {
    let authCredentials = this.authServer.getAuthCredentials();

    if (!authCredentials || !authCredentials.accessToken) {
      console.error(
        "Service not authenticated yet. Please visit " +
        baseUrl +
        "/auth and follow the link."
      );
      return;
    }

    let { accessToken } = authCredentials;

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

    if (!this.sipgateIoClient) {
      return null;
    }

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

    if (
      newCallEvent.users?.length == 1 &&
      newCallEvent.users[0] == "voicemail"
    ) {
      this.database.updateCall(newCallEvent.originalCallId, {
        callId: newCallEvent.callId,
        voicemail: true,
      });
      return;
    }

    const fullUserId =
      newCallEvent.fullUserIds?.length == 1
        ? newCallEvent.fullUserIds[0]
        : null;
    const webUserInformation = fullUserId ? splitFullUserId(fullUserId) : null;

    this.database.addCall(
      newCallEvent.callId,
      new Date(),
      newCallEvent.direction,
      newCallEvent.from,
      newCallEvent.to,
      webUserInformation?.masterSipId || null,
      webUserInformation?.userExtension || null
    );

    const queryNumber =
      newCallEvent.direction == "in" ? newCallEvent.to : newCallEvent.from;

    const groupEndpoint = await this.getGroupInformation(queryNumber);
    if (groupEndpoint) {
      this.database.insertGroup(
        groupEndpoint.endpointId,
        groupEndpoint.endpointAlias
      );

      this.database.updateCall(newCallEvent.callId, {
        groupExtension: groupEndpoint.endpointId,
      });
    }
  };

  public async handleOnAnswer(answerEvent: AnswerEvent) {
    console.log(`answer from ${answerEvent.from} to ${answerEvent.to}`);

    if (answerEvent.fullUserId) {
      const splitUserIdResult = splitFullUserId(answerEvent.fullUserId);

      this.database.updateCall(answerEvent.callId, {
        answeredAt: new Date(),
        calleeMasterSipId: splitUserIdResult.masterSipId,
        calleeExtension: splitUserIdResult.userExtension,
        answeringNumber: answerEvent.answeringNumber,
      });
    } else {
      this.database.updateCall(answerEvent.callId, {
        answeredAt: new Date(),
        answeringNumber: answerEvent.answeringNumber,
      });
    }
  }

  public async handleOnHangUp(hangUpEvent: HangUpEvent) {
    console.log(`hangup from ${hangUpEvent.from} to ${hangUpEvent.to}`);

    this.database.updateCall(hangUpEvent.callId, {
      end: new Date(),
      hangupCause: hangUpEvent.cause,
    });
  }
}
