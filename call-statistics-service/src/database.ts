import { Connection, createConnection } from "mysql";
import { AuthCredentials, TokenType } from "./AuthServer";

export interface CallObject {
  callId?: string;
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
  voicemail?: boolean;
  fake?: boolean;
  crashed?: boolean;
}

export interface TeamObject {
  name: string;
  numbers: string[];
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

  public async readTokensFromDatabase(): Promise<AuthCredentials | null> {
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

  public async getCall(callId: string) {
    return this.query("SELECT * FROM calls WHERE call_id=?", [callId]);
  }

  public async addCall(callId: string, callObject: CallObject) {
    await this.query(
      "INSERT INTO calls VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        callId,
        callObject.start || null,
        callObject.end || null,
        callObject.answeredAt || null,
        callObject.direction || null,
        callObject.calleeMasterSipId || null,
        callObject.calleeExtension || null,
        callObject.callerNumber || null,
        callObject.calleeNumber || null,
        callObject.answeringNumber || null,
        callObject.hangupCause || null,
        callObject.groupExtension || null,
        callObject.voicemail || false,
        callObject.fake || false,
      ]
    );
  }

  public async insertGroup(extension: string, alias: string): Promise<void> {
    await this.query(
      "INSERT INTO groups VALUES(?, ?) ON DUPLICATE KEY UPDATE alias=values(alias)",
      [extension, alias]
    );
  }

  private callObjectDictionary = {
    callId: "call_id",
    start: "start",
    direction: "direction",
    caller_number: "caller_number",
    callee_number: "callee_number",
    calleeMasterSipId: "callee_mastersip_id",
    calleeExtension: "callee_extension",
    end: "end",
    answeredAt: "answered_at",
    answeringNumber: "answering_number",
    hangupCause: "hangup_cause",
    groupExtension: "group_extension",
    voicemail: "voicemail",
    fake: "fake",
    crashed: "crashed",
  };

  public async updateCall(
    callId: string,
    callObject: CallObject
  ): Promise<void> {
    if (!callObject) {
      throw new Error("callObject undefined or null");
    }

    let queryString: string = "UPDATE calls SET ";
    let params = [];
    Object.keys(callObject).forEach((key) => {
      queryString += `${this.callObjectDictionary[key]}=?, `;
      params.push(callObject[key]);
    });

    queryString = queryString.slice(0, -2);

    queryString += " WHERE call_id=?";
    params.push(callId);

    await this.query(queryString, params);
  }

  public async updateTeams(teams: TeamObject[]): Promise<void> {
    await this.query("TRUNCATE TABLE teams_numbers");

    await this.query("DELETE FROM teams WHERE 1");

    await Promise.all(
      teams.map(async (team, index) => {
        await this.query("INSERT INTO teams VALUES(?, ?)", [index, team.name]);

        if (team.numbers.length < 2) {
          console.warn(`Team "${team.name}" has less than two members. Skip.`);
          return;
        }

        return Promise.all(
          team.numbers.map(
            async (number) =>
              await this.query("INSERT INTO teams_numbers VALUES(?, ?)", [
                index,
                number,
              ])
          )
        );
      })
    );
  }
  public async crashCheck() {
    let queryString: string = "UPDATE calls SET crashed=1 WHERE end IS NULL;";
    await this.query(queryString);
  }
}
