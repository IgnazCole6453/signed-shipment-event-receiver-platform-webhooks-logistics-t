import express from "express";
import { ZodError } from "zod";
import { decideShipment, shipmentEventSchema } from "./shipment_events";
import { verifySignature } from "./webhook_signature";

const secret = process.env.SHIPMENT_WEBHOOK_SECRET;
if (!secret) throw new Error("SHIPMENT_WEBHOOK_SECRET is required");

const app = express();
app.post("/webhooks/shipments", express.raw({ type: "application/json", limit: "256kb" }), (request, response) => {
  const rawBody = request.body as Buffer;
  const supplied = request.header("x-webhook-signature");
  if (!verifySignature(rawBody, supplied, secret)) {
    response.status(401).json({ accepted: false, reason: "invalid_signature" });
    return;
  }

  try {
    const event = shipmentEventSchema.parse(JSON.parse(rawBody.toString("utf8")));
    response.status(202).json({ accepted: true, decision: decideShipment(event) });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.status(400).json({ accepted: false, reason: "invalid_event" });
      return;
    }
    throw error;
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Shipment receiver listening on http://localhost:${port}`));
