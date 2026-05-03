import express from "express";
import cors from "cors";
import tripsRouter from "./routes/trips.js";
import tripRouter from "./routes/trip.js";
import itemsRouter from "./routes/items.js";

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/trips", tripsRouter);
app.use("/api/trips/:id", tripRouter);
app.use("/api/trips/:id/items", itemsRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

export default app;
