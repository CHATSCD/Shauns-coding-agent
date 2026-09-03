# Beacon

> Privacy-first family safety & location sharing — smarter safety, longer battery, absolute privacy.

Beacon replaces battery-heavy, privacy-invasive family tracking apps. This repository is the **backend foundation**:

- **Option 2 — Data layer**: PostgreSQL + PostGIS schema with spatial GIST indexes, Row-Level Security (RLS), and automated retention (free = 2 days, premium = 30 days of history).
- **Option 3 — API ingress**: `POST /v1/telemetry/ingest` telemetry endpoint + WebSocket `ws://…/v1/circles/{circle_id}` real-time event router.
- **Client**: modular Flutter app scaffold (structure + placeholders) in [`client/`](client/).

## Repository layout

```
.
├── backend/                 # Go API gateway / WebSocket server
│   ├── cmd/server/          # entrypoint
│   ├── internal/
│   │   ├── auth/            # Supabase HS256 JWT middleware
│   │   ├── config/          # env config
│   │   ├── db/              # pgx pool + migrations
│   │   ├── handlers/        # ingest + websocket handlers
│   │   ├── hub/             # per-circle publish/subscribe hub
│   │   └── models/          # request/event types
│   └── migrations/          # SQL schema (mirror of provisioned DB)
├── client/                  # modular Flutter application (scaffold)
├── docs/
│   ├── api.md               # API contracts
│   └── data-model.md        # data layer reference
└── docker-compose.yml       # local PostGIS for offline dev
```

## Status

- [x] Data layer provisioned (Supabase: PostGIS, GIST indexes, RLS, retention trigger)
- [x] Repository scaffold (Go backend + Flutter client directories)
- [x] `POST /v1/telemetry/ingest` (Go handler)
- [x] WebSocket `v1/circles/{circle_id}` (Go handler + in-process hub)
- [ ] Wire real Redis pub/sub for multi-instance broadcast
- [ ] Kafka telemetry pipeline + PostGIS analytics
- [ ] Emergency dispatch bridge (24/7, premium)

## Quickstart (backend)

See [`backend/README.md`](backend/README.md).

## Docs

- [API contracts](docs/api.md)
- [Data model](docs/data-model.md)
