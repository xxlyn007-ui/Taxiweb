# Workspace — TAXI IMPULSE

## Project

Russian taxi service app for Krasnoyarsk region with 3 roles: Пассажир, Водитель, Администратор.
Dark violet UI. All text in Russian.

### Admin account
- Admin: `89237720974` / `TaxiImpuls26` → login at `/login?admin=1`
- Demo driver/passenger accounts removed; real users register via `/register` and `/register-driver`

### Key features implemented
- **Auth**: Passenger register (name+phone+password), Driver multi-step registration → pending admin review, Admin hidden login at `/login?admin=1`
- **Passenger**: Order taxi with city persistence (localStorage), estimate price, cancel pending order, ⭐ rating modal after ride completes (1-5 stars), ⋮ 3-dots menu with "Become a driver" link
- **Driver**: Online/offline toggle, workCity selection, auto-assign toggle (priority orders in 2km radius), view all pending orders in city, accept/cancel order
- **Admin**: City stats, driver review (approve/reject), block/unblock, tariff CRUD with tier pricing (3 distance bands) + tariff options CRUD, tech support page (view all user conversations + reply)
- **Orders**: City-based routing, tiered distance pricing, Haversine formula intercity distance (×1.25 road factor), city-tariff-override pricing, options extra price added server-side, passenger history auto-cleanup (keeps last 15 completed/cancelled), driver rating on completion
- **Chat**: Driver-passenger order chat, support chat (passenger/driver ↔ admin), admin support page at `/admin/support`
- **DB**: `tariffs` (tier pricing), `tariff_options` (with `city` column for per-city options), `city_tariff_overrides` (city-specific basePrice/pricePerKm/minPrice), `orders` (with `optionIds` JSON field)
- **Maps**: Yandex Maps 3.0 (key: `0cb34d82-1882-4add-9645-fedb77532f0c`); `use-yandex-script.ts` hook; `TwoGisMap` + `MapPickerModal` exports unchanged; dark theme; custom pin markers (A=violet, B=green, driver=amber); route polyline via `YMapFeature`; Yandex Geocoder REST API for forward/reverse geocoding; all 20 Krasnoyarsk region cities in CITY_CENTERS; driver marker live tracking
- **Pricing**: Per-city tariff overrides; passenger can select options (filtered by city) that add to order price; tiered distance pricing
- **Delivery**: orderType field ('taxi'|'delivery') on orders; passenger toggles Такси/Доставка in dashboard; packageDescription field for delivery; delivery tariffs filtered by category field on tariffsTable; delivery badge shown to drivers; admin can set category (taxi/delivery) on any tariff
- **Orders**: passenger comment field (optional); km calculation improved (street-based logic, realistic 2.5–5km city range instead of hash-based randomness)
- **Security**: helmet (security headers), express-rate-limit (120 req/min general, 20/15min for auth), 1MB request size limit, input sanitization (sanitizeText), CORS config, global error handlers
- **Performance**: SQL-level filtering on all list endpoints (no JS in-memory filtering), batch N+1 elimination via `inArray` on `GET /orders` and `GET /drivers`, SQL aggregates (COUNT FILTER / SUM FILTER / AVG FILTER) on `GET /stats` and `GET /stats/by-city`, SQL-filtered push subscriptions by city+role, batch delete in `cleanupPassengerHistory` via `inArray`
- **DB Indexes**: `orders` (status, passenger_id, driver_id, city, created_at, completed_at), `drivers` (status, city, work_city, user_id, is_approved), `users` (role), `push_subscriptions` (user_id, role+work_city)
- **Push notifications**: VAPID-based Web Push via web-push library; drivers get new order alerts, passengers get accepted/started/completed alerts; push_subscriptions table; sw.js handler
- **Driver subscriptions**: Monthly subscription via YooKassa (YOOKASSA_SHOP_ID + YOOKASSA_SECRET_KEY env vars); trial_days=30 for new drivers; driver blocked from accepting orders when expired; push reminders at 3 days before expiry; admin can configure price and trial period at /admin/settings; driver dashboard shows status banner with payment button
- **DB tables**: driver_subscriptions (status: trial/active/expired/pending, endDate, paymentId, reminderSentAt), settings (key/value for subscription_price, subscription_trial_days)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
