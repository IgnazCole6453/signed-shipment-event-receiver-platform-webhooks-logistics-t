import { z } from "zod";

const proofSchema = z.object({
  object_key: z.string().min(1),
  media_type: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

const shipmentBase = z.object({
  event_id: z.string().min(1),
  shipment_id: z.string().min(1),
  occurred_at: z.string().datetime({ offset: true }),
});

export const shipmentEventSchema = z.discriminatedUnion("type", [
  shipmentBase.extend({
    type: z.literal("shipment.in_transit"),
    location: z.string().min(1),
  }),
  shipmentBase.extend({
    type: z.literal("shipment.delivered"),
    recipient: z.string().min(1),
    proofs: z.array(proofSchema).min(1),
  }),
  shipmentBase.extend({
    type: z.literal("shipment.exception"),
    exception_code: z.enum(["address_issue", "damaged", "recipient_unavailable"]),
    note: z.string().min(1).max(500),
  }),
]);

export type ShipmentEvent = z.infer<typeof shipmentEventSchema>;

export type ShipmentDecision = {
  shipment_id: string;
  state: "moving" | "delivered" | "attention_required";
  action: "track" | "archive_proof" | "open_exception";
  proof_count: number;
  exception_code?: string;
};

export function decideShipment(event: ShipmentEvent): ShipmentDecision {
  if (event.type === "shipment.delivered") {
    return {
      shipment_id: event.shipment_id,
      state: "delivered",
      action: "archive_proof",
      proof_count: event.proofs.length,
    };
  }
  if (event.type === "shipment.exception") {
    return {
      shipment_id: event.shipment_id,
      state: "attention_required",
      action: "open_exception",
      proof_count: 0,
      exception_code: event.exception_code,
    };
  }
  return {
    shipment_id: event.shipment_id,
    state: "moving",
    action: "track",
    proof_count: 0,
  };
}
