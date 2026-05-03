import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ItineraryItem from "../components/ItineraryItem.jsx";

const emptyItem = { day: 1, time: "", title: "", notes: "" };

export default function TripDetail() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState(emptyItem);

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then((r) => r.json())
      .then(setTrip)
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/trips/${id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
    });
    const item = await res.json();
    setTrip((prev) => ({ ...prev, items: [...prev.items, item] }));
    setNewItem(emptyItem);
  };

  if (loading) return <p>Loading...</p>;
  if (!trip) return <p>Trip not found.</p>;

  const sortedItems = [...(trip.items || [])].sort(
    (a, b) => a.day - b.day || (a.time || "").localeCompare(b.time || "")
  );

  return (
    <div>
      <Link to="/trips">← Back</Link>
      <h2>
        {trip.name}{" "}
        <Link to={`/trips/${id}/edit`} style={{ fontSize: "1rem", fontWeight: "normal" }}>Edit</Link>
      </h2>
      <p>{trip.destination} · {trip.startDate} → {trip.endDate}</p>
      {trip.description && <p>{trip.description}</p>}

      <h3>Itinerary</h3>
      {sortedItems.length === 0 && <p>No items yet.</p>}
      {sortedItems.map((item) => <ItineraryItem key={item.id} item={item} />)}

      <h4>Add Item</h4>
      <form onSubmit={handleAddItem} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "400px" }}>
        <input
          type="number" min="1" placeholder="Day"
          value={newItem.day}
          onChange={(e) => setNewItem((p) => ({ ...p, day: Number(e.target.value) }))}
          required
        />
        <input
          type="time"
          value={newItem.time}
          onChange={(e) => setNewItem((p) => ({ ...p, time: e.target.value }))}
        />
        <input
          placeholder="Title *"
          value={newItem.title}
          onChange={(e) => setNewItem((p) => ({ ...p, title: e.target.value }))}
          required
        />
        <textarea
          placeholder="Notes"
          value={newItem.notes}
          onChange={(e) => setNewItem((p) => ({ ...p, notes: e.target.value }))}
        />
        <button type="submit">Add to Itinerary</button>
      </form>
    </div>
  );
}
