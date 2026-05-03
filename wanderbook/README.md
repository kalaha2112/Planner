# WanderBook

A trip planner web application.

## Stack

- **Frontend**: React 19 + Vite 6 + React Router 7
- **Backend**: Node.js + Express 5

## Quick Start

```bash
# 1. Install all dependencies (run once)
npm run install:all

# 2. Start both dev servers
npm run dev
```

- Client: http://localhost:5173
- API:    http://localhost:3001/api/trips

## API Reference

| Method | Endpoint                       | Action                 |
|--------|--------------------------------|------------------------|
| GET    | /api/trips                     | List all trips         |
| POST   | /api/trips                     | Create a trip          |
| GET    | /api/trips/:id                 | Get one trip           |
| PUT    | /api/trips/:id                 | Update a trip          |
| DELETE | /api/trips/:id                 | Delete a trip          |
| GET    | /api/trips/:id/items           | List itinerary items   |
| POST   | /api/trips/:id/items           | Add an itinerary item  |
