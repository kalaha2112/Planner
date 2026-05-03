import { Router } from "express";
import { getTripById, updateTrip, deleteTrip } from "../data/store.js";

const router = Router({ mergeParams: true });

router.get("/", (req, res) => {
  const trip = getTripById(req.params.id);
  if (!trip) return res.status(404).json({ error: "Trip not found" });
  res.json(trip);
});

router.put("/", (req, res) => {
  const updated = updateTrip(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Trip not found" });
  res.json(updated);
});

router.delete("/", (req, res) => {
  const ok = deleteTrip(req.params.id);
  if (!ok) return res.status(404).json({ error: "Trip not found" });
  res.status(204).send();
});

export default router;
