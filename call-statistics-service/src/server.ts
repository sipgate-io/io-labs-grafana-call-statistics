import { createWebhookModule } from "sipgateio";
import EventHandler from "./EventHandler";

const webhookServerPort = process.env.SIPGATE_WEBHOOK_SERVER_PORT || 8080;
const webhookServerAddress =
  process.env.SIPGATE_WEBHOOK_SERVER_ADDRESS || "https://localhost";

const webhookModule = createWebhookModule();
const eventHandler = new EventHandler();

webhookModule
  .createServer({
    port: webhookServerPort,
    serverAddress: webhookServerAddress,
  })
  .then((webhookServer) => {
    console.log(`Webhook server running\n` + "Ready for calls 📞");

    webhookServer.onNewCall(eventHandler.handleOnNewCall);

    webhookServer.onAnswer(eventHandler.handleOnAnswer);

    webhookServer.onHangUp(eventHandler.handleOnHangUp);
  });
