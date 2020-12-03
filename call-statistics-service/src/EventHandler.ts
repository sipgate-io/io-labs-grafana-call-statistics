import {
  AnswerEvent,
  HangUpEvent,
  NewCallEvent,
  sipgateIO,
  createNumbersModule,
  SipgateIOClient,
} from "sipgateio";
import Database from "./Database";
import { isTokenExpired, splitFullUserId } from "./utils";
import { NumberResponseItem } from "sipgateio/dist/numbers";
import AuthServer from "./AuthServer";
import { baseUrl } from "./server";

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

    if (this.isVoicemailCall(newCallEvent)) {
      await this.handleVoicemail(newCallEvent, new Date());
      return;
    }

    await this.handleRegularNewCall(newCallEvent, new Date());

    await this.insertCallIntoGroups(newCallEvent);
  };

  public async handleOnAnswer(answerEvent: AnswerEvent) {
    console.log(`answer from ${answerEvent.from} to ${answerEvent.to}`);
    await this.updateAnswerDateAndNumber(answerEvent, new Date());
  }

  public async handleOnHangUp(hangUpEvent: HangUpEvent) {
    console.log(`hangup from ${hangUpEvent.from} to ${hangUpEvent.to}`);
    await this.updateEndDateOnCall(hangUpEvent, new Date());
  }

  private async handleRegularNewCall(newCallEvent: NewCallEvent, date: Date) {
    const fullUserId =
      newCallEvent.fullUserIds?.length == 1
        ? newCallEvent.fullUserIds[0]
        : null;
    const webUserInformation = fullUserId ? splitFullUserId(fullUserId) : null;

    await this.database.addCall(newCallEvent.callId, {
      start: date,
      direction: newCallEvent.direction,
      callerNumber: newCallEvent.from,
      calleeNumber: newCallEvent.to,
      calleeMasterSipId: webUserInformation?.masterSipId || null,
      calleeExtension: webUserInformation?.userExtension || null,
    });
  }

  private isVoicemailCall(newCallEvent: NewCallEvent) {
    return (
      newCallEvent.users?.length == 1 && newCallEvent.users[0] == "voicemail"
    );
  }

  private async handleVoicemail(newCallEvent: NewCallEvent, date: Date) {
    const origCallEvent = await this.database.getCall(
      newCallEvent.originalCallId
    );
    if (origCallEvent.length == 0) {
      await this.database.addCall(newCallEvent.callId, {
        start: date,
        direction: newCallEvent.direction,
        callerNumber: newCallEvent.from,
        calleeNumber: newCallEvent.to,
        voicemail: true,
      });
    } else {
      await this.database.updateCall(newCallEvent.originalCallId, {
        callId: newCallEvent.callId,
        voicemail: true,
      });
    }
  }

  private async insertCallIntoGroups(newCallEvent: NewCallEvent) {
    const queryNumber =
      newCallEvent.direction == "in" ? newCallEvent.to : newCallEvent.from;
    const groupEndpoint = await this.getGroupInformation(queryNumber);
    if (groupEndpoint) {
      await this.database.insertGroup(
        groupEndpoint.endpointId,
        groupEndpoint.endpointAlias
      );

      await this.database.updateCall(newCallEvent.callId, {
        groupExtension: groupEndpoint.endpointId,
      });
    }
  }

  private async updateAnswerDateAndNumber(
    answerEvent: AnswerEvent,
    date: Date
  ) {
    let callData = {
      answeredAt: date,
      answeringNumber: answerEvent.answeringNumber,
      crashed: false,
    };

    if (answerEvent.fullUserId) {
      const splitUserIdResult = splitFullUserId(answerEvent.fullUserId);
      callData["calleeMasterSipId"] = splitUserIdResult.masterSipId;
      callData["calleeExtension"] = splitUserIdResult.userExtension;
    }

    await this.database.updateCall(answerEvent.callId, callData);
  }

  private async updateEndDateOnCall(hangupEvent: HangUpEvent, date: Date) {
    await this.database.updateCall(hangupEvent.callId, {
      end: date,
      hangupCause: hangupEvent.cause,
      crashed: false,
    });
  }
}
