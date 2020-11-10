import { createWebhookModule } from "sipgateio";
import EventHandler from "./EventHandler";

const webhookServerPort = process.env.SIPGATE_WEBHOOK_SERVER_PORT || 8080;
const webhookServerAddress =
  process.env.SIPGATE_WEBHOOK_SERVER_ADDRESS || "https://localhost";

const sipgateUsername = process.env.SIPGATE_USERNAME;
const sipgatePassword = process.env.SIPGATE_PASSWORD;

if (!sipgateUsername && !sipgatePassword) {
    console.error("Please provide credentials using the environment variables SIPGATE_USERNAME and SIPGATE_PASSWORD");
    process.exit(1)
}

const webhookModule = createWebhookModule();
const eventHandler = new EventHandler({username: sipgateUsername,password:sipgatePassword});

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
