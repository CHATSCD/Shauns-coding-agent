# Beacon — Data Model

## Entities

| Table | Purpose | Notes |
|---|---|---|
| `circles` | Family group (pricing unit) | `plan` = `free` \| `premium` |
| `profiles` | Users | `id` aligns to Supabase `auth.users.id` |
| `circle_members` | Membership + role | `owner`/`admin`/`member` |
| `devices` | Client hardware | phone, watch, OBD-II, BLE tracker |
| `subscriptions` | Billing state per circle | `trialing`/`active`/`canceled`/`past_due` |
| `telemetry` | Location samples | PostGIS `geography(Point,4326)`, E2EE `payload` |
| `places` | Saved places / geofences | point + radius |
| `place_alerts` | Arrival/departure events | written by matcher |
| `sos_events` | SOS / crash / check-in | premium flag `dispatch_external` |
| `privacy_settings` | Per-member controls | exact / ghost / pause / scheduled |

## Spatial & query indexes

- `telemetry(location)` — **GIST**
- `places(location)` — **GIST**
- `sos_events(location)` partial — **GIST**
- B-tree time indexes: `telemetry(circle_id, recorded_at desc)`, `telemetry(user_id, recorded_at desc)`

A composite `(circle_id, location)` GIST index requires the `btree_gist` extension and is a follow-up when query profiling shows it is needed.

## Retention (automated)

- **Free:** 2 days of location history
- **Premium:** 30 days of location history

Implemented as an `AFTER INSERT` trigger (`enforce_telemetry_retention`) on `telemetry` that deletes expired rows for the same circle using the circle's current plan. A `pg_cron` daily sweep is included (commented) for large circles.

## Row-Level Security (RLS)

All tables have RLS enabled. Access is driven by `is_circle_member()` / `is_circle_owner()` security-definer helpers backed by `auth.uid()`.

| Table | Reads | Writes |
|---|---|---|
| `circles` | members | owners (update) |
| `profiles` | self | self |
| `circle_members` | self + own circles | via RPC / service role |
| `devices` | self | self |
| `subscriptions` | owners | service role |
| `telemetry` | circle members | own row / service role |
| `places` | circle members | owners |
| `place_alerts` | circle members | service role |
| `sos_events` | circle members | own row |
| `privacy_settings` | owners (all) + self | self / owners |

**Bootstrap RPCs** (`security definer`): `create_circle_with_owner(text)`, `add_circle_member(uuid, uuid, circle_role)`.

## Helpers

- `public.circle_last_positions` — latest position per member per circle (used for live map tiles).
