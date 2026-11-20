import { describe, expect, it } from "vitest";
import { decideShipment, shipmentEventSchema } from "../src/shipment_events";

describe("shipment event decision", () => {
  it("archives every proof when a delivered shipment has valid evidence", () => {
    const event = shipmentEventSchema.parse({
      type: "shipment.delivered",
      event_id: "evt_204",
      shipment_id: "shp_781",
      occurred_at: "2026-09-26T09:42:00+08:00",
      recipient: "Lin Chen",
      proofs: [
        { object_key: "pod/shp_781/front-door.jpg", media_type: "image/jpeg", sha256: "a".repeat(64) },
        { object_key: "pod/shp_781/signature.png", media_type: "image/png", sha256: "b".repeat(64) },
      ],
    });

    expect(decideShipment(event)).toEqual({
      shipment_id: "shp_781",
      state: "delivered",
      action: "archive_proof",
      proof_count: 2,
    });
  });
});
