import { infrai } from "./infrai_control";

async function main(): Promise<void> {
  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  const secret = process.env.SHIPMENT_WEBHOOK_SECRET;
  const queue = process.env.SHIPMENT_QUEUE ?? "shipment-platform-events";
  if (!publicBaseUrl || !secret) {
    throw new Error("PUBLIC_BASE_URL and SHIPMENT_WEBHOOK_SECRET are required");
  }

  const webhookUrl = `${publicBaseUrl.replace(/\/$/, "")}/webhooks/shipments`;
  const webhook = await infrai.account.webhooks.register({
    url: webhookUrl,
    events: ["account.updated"],
    description: "Signed logistics shipment events",
    secret,
  });
  const subscription = await infrai.queue.push_subscribe(queue, { url: webhookUrl });
  console.log(JSON.stringify({ webhook_id: webhook.webhook_id, queue: subscription.queue, url: webhookUrl }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
