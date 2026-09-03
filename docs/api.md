# Beacon — API Contracts (v1)

Base URL (prod): `https://api.beacon.app/v1`
Auth: `Authorization: Bearer <Supabase JWT>` (user `authenticated` or `service_role`).

---

## POST /v1/telemetry/ingest

Ingest one or more location telemetry samples from a client device (or a BLE mesh **Leader Device** pushing for the group). Returns `202 Accepted`.

### Request body

```jsonc
{
  "circle_id": "…circle uuid…",
  "user_id": "…profile uuid…",      // subject being located
  "device_id": "…device uuid…",     // optional; default = authenticated device
  "recorded_at": "2025-01-01T12:00:00Z",
  "lat": 37.7749,
  "lng": -122.4194,
  "accuracy_m": 8.0,
  "altitude_m": 21.0,
  "speed_mps": 0.2,
  "heading_deg": 182.0,
  "motion": "walking",              // stationary|walking|cycling|driving|unknown
  "source": "gps",                  // gps|wifi|cell|ble
  "is_leader": true,                // BLE mesh leader flag
  "is_passive": false,
  "group_id": null,                 // uuid when pushing for a mesh group
  "battery_pct": 87,
  "payload": { }                    // E2EE payload, opaque to the server
}
```

Batch form is also accepted: `{ "samples": [ … ] }`.

### Responses

| Status | Meaning |
|---|---|
| `202` | Accepted for ingestion + broadcast |
| `400` | Malformed body / invalid lat-lng / unknown motion |
| `401` | Missing/invalid token |
| `403` | Caller is not a member of `circle_id` |

---

## GET /ws/v1/circles/{circle_id}

Upgrade to WebSocket for real-time events scoped to a circle (live map updates, place alerts, SOS, member presence).

Auth via `Authorization` header or `?token=` query param (mobile-friendly).

### Server → client event envelope

```jsonc
{
  "type": "telemetry",            // telemetry|place_alert|sos|member_presence
  "circle_id": "…",
  "ts": "2025-01-01T12:00:01Z",
  "data": { }
}
```

### Notes

- The backend enforces circle membership before upgrading.
- In-process hub currently broadcasts to connections on the same instance; a Redis pub/sub fan-out is the planned multi-instance path (see `hub/`).
- Client sends periodic WS pings; server closes idle sockets after 90s of silence.

---

## Bootstrap RPCs (Supabase PostgREST)

Used by the app before it has a backend service-role token.

- `rpc/create_circle_with_owner` — `{ "p_name": "My Family" }` → creates circle + subscription + owner membership.
- `rpc/add_circle_member` — `{ "p_circle_id": "…", "p_user_id": "…", "p_role": "member" }` (owner/admin only).

## Service-role-only writes (currently no public RLS grant)

`subscriptions`, `place_alerts`, and bulk `telemetry` ingestion are written via the backend using the service role key so RLS stays strict for direct clients.
