import { Router } from "express";
import { getAllTrips, createTrip } from "../data/store.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json(getAllTrips());
});

router.post("/", (req, res) => {
  const { name, destination, startDate, endDate, description } = req.body;
  if (!name || !destination) {
    return res.status(400).json({ error: "name and destination are required" });
  }
  const trip = createTrip({ name, destination, startDate, endDate, description });
  res.status(201).json(trip);
});

export default router;
