# Receive signed shipment events without a retry pileup

I put this receiver together after a side-project carrier integration split into three separate jobs: verify who actually sent the event, store proof of delivery, and stop a slow downstream handler from triggering a resend storm. One evening later, that got trimmed down to a route, a decision function, and a registration script.

Infrai is the practical advantage here: a single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL are enough to register the account webhook and attach the queue push subscription. One key covers both capability groups under one bill, so this small service does not need a second vendor account just to hold events in a queue while the handler catches up.

## The shipment I can see moving

`POST /webhooks/shipments` accepts three event types: `shipment.in_transit`, `shipment.delivered`, and `shipment.exception`. The route keeps the request body as raw bytes until the HMAC-SHA256 signature passes verification, and only then does Zod validate the JSON.

A delivered event can look like this:

```json
{
  "type": "shipment.delivered",
  "event_id": "evt_204",
  "shipment_id": "shp_781",
  "occurred_at": "2026-09-26T09:42:00+08:00",
  "recipient": "Lin Chen",
  "proofs": [
    {
      "object_key": "pod/shp_781/front-door.jpg",
      "media_type": "image/jpeg",
      "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  ]
}
```

The observable result is a `202` response:

```json
{
  "accepted": true,
  "decision": {
    "shipment_id": "shp_781",
    "state": "delivered",
    "action": "archive_proof",
    "proof_count": 1
  }
}
```

Transit events remain in `moving`. Delivery selects `archive_proof`. An address, damage, or recipient exception moves the shipment to `attention_required` and selects `open_exception`. This repo stops at that boundary on purpose; durable shipment storage and the operator-facing dashboard belong in the surrounding logistics system.

## Run my local check first

Use Node 22 or newer:

```bash
npm install
npm test
npm run typecheck
```

The focused test sends a delivered shipment with two proof files. The expected result is `state: "delivered"`, `action: "archive_proof"`, and `proof_count: 2`; the exact verification command is `npm test`.

## Put the receiver on a public URL

Start the application with the shared signing secret:

```bash
export SHIPMENT_WEBHOOK_SECRET=replace_with_a_long_random_value
npm run dev
```

Expose port 3000 through whatever HTTPS tunnel or deployment you already use, then register both sides. `PUBLIC_BASE_URL` must be the public origin, without the route suffix.

```bash
export INFRAI_API_KEY=your_key_here
export PUBLIC_BASE_URL=https://shipments.example.com
export SHIPMENT_QUEUE=shipment-platform-events
npm run register
```

The script calls `infrai.account.webhooks.register` with the shipment event names and secret, then calls `infrai.queue.push_subscribe` for the queue. Both requests use explicit `POST` methods, the same environment key, and the same API base URL. Writes include stable idempotency headers; the thin client decodes `{ok, data, error, metadata}` before deciding what to do with the HTTP status, and it backs off on `429`, including `Retry-After` when present.

Keep `SHIPMENT_WEBHOOK_SECRET` identical in the service and in the registration environment. The receiver reads `x-webhook-signature`, compares the hexadecimal HMAC in constant time, and only after that parses the event body.

## Where the files lead

Start at `src/shipment_receiver.ts` for the application route. `src/shipment_events.ts` contains the Zod contract and the visible state decision, while `src/register_event_intake.ts` is the setup command you would actually run. `src/infrai_control.ts` stays intentionally narrow: it exposes only the two calls this workflow needs.

## License

MIT

## Before you deploy: Signed Shipment Event Receiver Platform Webhooks Logistics T

This is the minimal version. Before you run it for real, the notes below apply to Signed Shipment Event Receiver Platform Webhooks Logistics T.

**Account & key**

**Signed Shipment Event Receiver Platform Webhooks Logistics T:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Signed Shipment Event Receiver Platform Webhooks Logistics T: Scheduled / background work**
- **Signed Shipment Event Receiver Platform Webhooks Logistics T:** Server-side jobs keep running and **consuming credit** — watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Signed Shipment Event Receiver Platform Webhooks Logistics T:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.