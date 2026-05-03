# WanderBook — Project Guide

## Architecture

Monorepo with two packages under `wanderbook/`:

- `client/` — React 19 + Vite 6 + React Router 7 (port 5173)
- `server/` — Node.js + Express 5 (port 3001)

The Vite dev server proxies `/api/*` to `http://localhost:3001`, so all fetch calls in the client use relative `/api/...` paths.

## Running Locally

```bash
npm run install:all   # first-time setup
npm run dev           # starts both servers concurrently
```

## Key Patterns

- All API calls live in `client/src/context/TripContext.jsx` — pages never call `fetch` directly
- `TripForm` handles both create (`/trips/new`) and edit (`/trips/:id/edit`) via the `:id` param
- Server uses ESM (`"type": "module"`) — use `import`/`export`, not `require`
- In-memory store in `server/src/data/store.js` — data resets on server restart (MVP)

## Adding Features

- **New API route**: add file in `server/src/routes/`, mount in `server/src/app.js`
- **New page**: add file in `client/src/pages/`, add `<Route>` in `client/src/App.jsx`
- **Persist data**: replace `server/src/data/store.js` with a database adapter (SQLite, Postgres, etc.)
