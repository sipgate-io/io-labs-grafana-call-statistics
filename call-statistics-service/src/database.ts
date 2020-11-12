import { Connection, createConnection } from "mysql";
import { AuthCredentials, TokenType } from "./AuthServer";

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
}
