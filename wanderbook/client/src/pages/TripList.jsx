import { useEffect } from "react";
import { useTrips } from "../context/TripContext.jsx";
import TripCard from "../components/TripCard.jsx";

export default function TripList() {
  const { trips, loading, error, fetchTrips } = useTrips();

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  if (loading) return <p>Loading trips...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div>
      <h2>My Trips</h2>
      {trips.length === 0 && <p>No trips yet. <a href="/trips/new">Create one!</a></p>}
      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {trips.map((t) => <TripCard key={t.id} trip={t} />)}
      </div>
    </div>
  );
}
