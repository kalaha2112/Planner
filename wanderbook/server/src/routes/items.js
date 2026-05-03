import { Router } from "express";
import { getItems, addItem } from "../data/store.js";

// mergeParams: true is required to inherit :id from the parent mount point
const router = Router({ mergeParams: true });

router.get("/", (req, res) => {
  const items = getItems(req.params.id);
  if (items === null) return res.status(404).json({ error: "Trip not found" });
  res.json(items);
});

router.post("/", (req, res) => {
  const { day, time, title, notes } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const item = addItem(req.params.id, { day, time, title, notes });
  if (!item) return res.status(404).json({ error: "Trip not found" });
  res.status(201).json(item);
});

export default router;
