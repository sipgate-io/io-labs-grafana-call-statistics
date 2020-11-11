import axios from "axios";
import * as querystring from "querystring";
import * as fs from "fs";
import { Server, IncomingMessage, ServerResponse } from "http";
import { schedule } from "node-cron";

export type ParsedUrl = {
  slug: string;
  queryParams: Map<string, string>;
};

const AUTHENTICATION_ENDPOINT = "/auth";
export const AUTHENTICATION_CODE_ENDPOINT = "/auth-code";
const AUTH_HTML_FILE = "./web/index.html";
const SIPGATE_AUTH_URL =
  "https://login.sipgate.com/auth/realms/third-party/protocol/openid-connect/auth";
const SIPGATE_TOKEN_URL =
  "https://login.sipgate.com/auth/realms/third-party/protocol/openid-connect/token";

type Config = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

interface AuthCredentials {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
}

interface RefreshTokenOptions {
  grant_type: string;
  refresh_token: string;
}

interface AccessTokenOptions {
  grant_type: string;
  code: string;
  redirect_uri: string;
}

type TokenRequestOptions = AccessTokenOptions | RefreshTokenOptions;

export default class AuthServer {
  private httpServer: Server;
  private originalHandlers: Function[];
  private config: Config;

  private authCredentials: AuthCredentials;

  constructor(httpServer: Server, config: Config) {
    this.httpServer = httpServer;
    this.config = config;
    this.originalHandlers = this.httpServer.listeners("request");
    this.httpServer.removeAllListeners("request");
    httpServer.addListener("request", this.handleRequest);
    schedule("1 * * * *", () => {<
      this.refreshTokens().then(console.log);
    });
  }

  private async handleAuthCodeRequest(response: ServerResponse, code: string) {
    const tokenResponse = this.sendTokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
    });

    this.setAuthCredentials(tokenResponse);

    response.writeHead(301, { Location: "http://localhost:3009" });
    response.end();>
  }

  private setAuthCredentials = (tokenResponse: any) => {
    const { data } = tokenResponse;

    this.authCredentials = {
      accessToken: data.access_token,
      accessTokenExpiresIn: data.expires_in,
      refreshToken: data.refresh_token,
      refreshTokenExpiresIn: data.refresh_expires_in,
    };
  };

  private generateAuthLink(): string {
    return `${SIPGATE_AUTH_URL}?${querystring.stringify({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: "all",
    })}`;
  }

  private async readHtmlFile(): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(AUTH_HTML_FILE, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data.toString());
        }
      });
    });
  }

  private async handleAuthRequest(response: ServerResponse) {
    const htmlContents = await this.readHtmlFile();
    const templatedContent = htmlContents
      .toString()
      .replace("{OAUTH_LINK}", this.generateAuthLink());

    response.setHeader("Content-type", "text/html");
    response.write(templatedContent);
    response.end();
  }

  private sendBadRequestResponse(response: ServerResponse, message: string) {
    response.statusCode = 400;
    response.write(message);
    response.end();
  }

  private handleRequest = async (
    request: IncomingMessage,
    response: ServerResponse
  ) => {
    const { slug, queryParams } = this.parseUrl(request.url);
    const method = request.method;

    if (method === "GET" && slug === AUTHENTICATION_ENDPOINT) {
      return this.handleAuthRequest(response);
    }

    if (method === "GET" && slug === AUTHENTICATION_CODE_ENDPOINT) {
      if (!queryParams.has("code")) {
        return this.sendBadRequestResponse(
          response,
          "Missing 'code' query param"
        );
      }

      return this.handleAuthCodeRequest(response, queryParams.get("code"));
    }

    // invoke original (stored) handlers
    for (const handler of this.originalHandlers) {
      handler(request, response);
    }
  };

  private parseUrl(url: string): ParsedUrl {
    const urlParts = url.split("?");

    const slug = urlParts[0];
    const paramsString: string | undefined = urlParts[1];

    const queryParams: Map<string, string> = new Map();
    if (paramsString) {
      const splitParamsString = paramsString.split("&");

      for (const param of splitParamsString) {
        const splitParam = param.split("=");
        queryParams.set(splitParam[0], splitParam[1]);
      }
    }

    return {
      slug,
      queryParams,
    };
  }

  private sendTokenRequest = async (options: TokenRequestOptions) => {
    const requestBody = {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      ...options,
    };

    const tokenResponse = await axios.post(
      SIPGATE_TOKEN_URL,
      querystring.stringify(requestBody),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return tokenResponse;
  };

  public async refreshTokens(): Promise<string> {
    const tokenResponse = await this.sendTokenRequest({
      grant_type: "refresh_token",
      refresh_token: this.authCredentials.refreshToken,
    });

    this.setAuthCredentials(tokenResponse);

    return tokenResponse.data.access_token;
  }

  public getAuthCredentials(): AuthCredentials {
    return this.authCredentials;
  }
}
