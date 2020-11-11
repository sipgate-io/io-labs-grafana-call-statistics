import { createWebhookModule } from "sipgateio";
import EventHandler from "./EventHandler";
import AuthServer, { AUTHENTICATION_CODE_ENDPOINT } from "./AuthServer";

const webhookServerPort = process.env.SIPGATE_WEBHOOK_SERVER_PORT || 8080;
const webhookServerAddress =
  process.env.SIPGATE_WEBHOOK_SERVER_ADDRESS || "https://localhost";

const sipgateUsername = process.env.SIPGATE_USERNAME;
const sipgatePassword = process.env.SIPGATE_PASSWORD;
const clientId = process.env.SIPGATE_CLIENT_ID;
const clientSecret = process.env.SIPGATE_CLIENT_SECRET;
const baseUrl = process.env.SIPGATE_BASE_URL;

if (!sipgateUsername && !sipgatePassword) {
  console.error(
    "Please provide credentials using the environment variables SIPGATE_USERNAME and SIPGATE_PASSWORD"
  );
  process.exit(1);
}

if (!clientId || !clientSecret) {
  console.error("Please provice a client ID and client secret");
  process.exit(1);
}

if (!baseUrl) {
  console.error("Please provice a base URL");
  process.exit(1);
}

const webhookModule = createWebhookModule();

webhookModule
  .createServer({
    port: webhookServerPort,
    serverAddress: webhookServerAddress,
  })
  .then((webhookServer) => {
    const authServer = new AuthServer(webhookServer.getHttpServer(), {
      clientId,
      clientSecret,
      redirectUri: `${baseUrl}${AUTHENTICATION_CODE_ENDPOINT}`,
    });

    const eventHandler = new EventHandler(authServer);

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
