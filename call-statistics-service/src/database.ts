import { Connection, createConnection } from "mysql";
import { AuthCredentials, TokenType } from "./AuthServer";

export interface CallObject {
  callId: string;
  start?: Date;
  direction?: string;
  callerNumber?: string;
  calleeNumber?: string;
  calleeMasterSipId?: string;
  calleeExtension?: string;
  end?: Date;
  answeredAt?: Date;
  answeringNumber?: string;
  hangupCause?: string;
  groupExtension?: string;
  fake?: boolean;
}

export default class Database {
  private host: string;
  private user: string;
  private password: string;
  private database: string;

  private connection: Connection;

  constructor(host: string, user: string, password: string, database: string) {
    this.host = host;
    this.user = user;
    this.password = password;
    this.database = database;

    this.connection = createConnection({
      host,
      user,
      password,
      database,
    });
  }

  public async end(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connection.end((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  public async query(query: string, args: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.connection.query(query, args, (error, results) => {
        if (error) reject(error);
        else resolve(results);
      });
    });
  }

  public async readTokensFromDatabase(): Promise<AuthCredentials> {
    const authenticationParams: [] = await this.query(
      "SELECT token_type, token_value FROM authentication_params",
      []
    );

    if (authenticationParams.length == 0) {
      return null;
    }

    const tokens: AuthCredentials = {
      accessToken: authenticationParams.find(
        (row) => row["token_type"] == "access"
      )["token_value"],
      refreshToken: authenticationParams.find(
        (row) => row["token_type"] == "refresh"
      )["token_value"],
    };

    return tokens;
  }

  public async writeToken(type: TokenType, token: string): Promise<void> {
    await this.query(
      "INSERT INTO authentication_params VALUES(?, ?) ON DUPLICATE KEY UPDATE token_value=values(token_value)",
      [type, token]
    );
  }

  public async addCall(
    callId: string,
    start: Date,
    direction: string,
    callerNumber: string,
    calleeNumber: string,
    calleeMasterSipId?: string,
    calleeExtension?: string,
    end?: Date,
    answeredAt?: Date,
    answeringNumber?: string,
    hangupCause?: string,
    groupExtension?: string,
    fake?: boolean
  ) {
    await this.query(
      "INSERT INTO calls VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        callId,
        start,
        end || null,
        answeredAt,
        direction,
        calleeMasterSipId || null,
        calleeExtension || null,
        callerNumber,
        calleeNumber,
        answeringNumber || null,
        hangupCause || null,
        groupExtension || null,
        fake || false,
      ]
    );
  }

  public async insertGroup(extension: string, alias: string): Promise<void> {
    await this.query(
      "INSERT INTO groups VALUES(?, ?) ON DUPLICATE KEY UPDATE alias=values(alias)",
      [extension, alias]
    );
  }

  public async updateCall(callObject: CallObject): Promise<void> {
    if (!callObject) {
      throw new Error("callObject undefined or null");
    }

    let queryString: string = "UPDATE calls SET ";
    let params = [];

    if (callObject.start) {
      queryString += "start=?, ";
      params.push(callObject.start);
    }

    if (callObject.direction) {
      queryString += "direction=?, ";
      params.push(callObject.direction);
    }

    if (callObject.callerNumber) {
      queryString += "caller_number=?, ";
      params.push(callObject.callerNumber);
    }

    if (callObject.calleeNumber) {
      queryString += "callee_number=?, ";
      params.push(callObject.calleeNumber);
    }

    if (callObject.calleeMasterSipId) {
      queryString += "callee_mastersip_id=?, ";
      params.push(callObject.calleeMasterSipId);
    }

    if (callObject.calleeExtension) {
      queryString += "callee_extension=?, ";
      params.push(callObject.calleeExtension);
    }

    if (callObject.end) {
      queryString += "end=?, ";
      params.push(callObject.end);
    }

    if (callObject.answeredAt) {
      queryString += "answered_at=?, ";
      params.push(callObject.answeredAt);
    }

    if (callObject.answeringNumber) {
      queryString += "answering_number=?, ";
      params.push(callObject.answeringNumber);
    }

    if (callObject.hangupCause) {
      queryString += "hangup_cause=?, ";
      params.push(callObject.hangupCause);
    }

    if (callObject.groupExtension) {
      queryString += "group_extension=?, ";
      params.push(callObject.groupExtension);
    }

    if (callObject.fake) {
      queryString += "fake=?, ";
      params.push(callObject.fake);
    }

    queryString = queryString.slice(0, -2);

    queryString += " WHERE call_id=?";
    params.push(callObject.callId);

    await this.query(queryString, params);
  }
}
