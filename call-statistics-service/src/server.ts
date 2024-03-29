import { createWebhookModule } from "sipgateio";
import EventHandler from "./EventHandler";
import AuthServer, { AUTHENTICATION_CODE_ENDPOINT } from "./AuthServer";
import Database, { TeamObject } from "./Database";
import { readFile } from "./utils";

// as specified in the docker-compose.yml
const db_host = process.env.MYSQL_HOST || "db";
const db_user = process.env.MYSQL_USER || "user";
const db_password = process.env.MYSQL_PASSWORD || "supersecret";
const db_database = process.env.MYSQL_DATABASE || "call_statistics";

export const webhookServerPort = process.env.SIPGATE_WEBHOOK_PORT || 8080;
const webhookServerAddress =
  process.env.SIPGATE_WEBHOOK_URL || "http://localhost";
const internalPort = process.env.INTERNAL_PORT || 8080;

const clientId = process.env.SIPGATE_CLIENT_ID;
const clientSecret = process.env.SIPGATE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Please provide a client ID and client secret");
  process.exit(1);
}

(async () => {
  let teams: TeamObject[];
  try {
    const teamsRaw = await readFile(`${process.env.HOME}/teams.json`);
    teams = JSON.parse(teamsRaw);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const database = new Database(db_host, db_user, db_password, db_database);
  await database.updateTeams(teams);
  await database.crashCheck();

  const tokens = await database.readTokensFromDatabase();

  if (!tokens) {
    console.error(
      "Service not authenticated yet. Please visit http://localhost:" +
        webhookServerPort +
        "/auth and follow the link."
    );
  }

  const webhookModule = createWebhookModule();

  webhookModule
    .createServer({
      port: internalPort,
      serverAddress: webhookServerAddress,
    })
    .then((webhookServer) => {
      const authServer = new AuthServer(
        database,
        webhookServer.getHttpServer(),
        {
          clientId,
          clientSecret,
          redirectUri: `http://localhost:${webhookServerPort}${AUTHENTICATION_CODE_ENDPOINT}`,
        }
      );

      const eventHandler = new EventHandler(database, authServer);

      console.log(`Webhook server running\n` + "Ready for calls 📞");

      webhookServer.onNewCall((newCallEvent) => {
        eventHandler.handleOnNewCall(newCallEvent).catch(console.error);
      });

      webhookServer.onAnswer((answerEvent) => {
        eventHandler.handleOnAnswer(answerEvent).catch(console.error);
      });

      webhookServer.onHangUp((hangUpEvent) => {
        eventHandler.handleOnHangUp(hangUpEvent).catch(console.error);
      });
    });
})();
