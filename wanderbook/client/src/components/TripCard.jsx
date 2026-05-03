import { Link } from "react-router-dom";
import { useTrips } from "../context/TripContext.jsx";

const cardStyle = {
  border: "1px solid #dee2e6", borderRadius: "8px",
  padding: "1rem", background: "#fff",
  display: "flex", flexDirection: "column", gap: "0.5rem",
};

export default function TripCard({ trip }) {
  const { deleteTrip } = useTrips();

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${trip.name}"?`)) return;
    await deleteTrip(trip.id);
  };

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: 0 }}>{trip.name}</h3>
      <p style={{ margin: 0, color: "#6c757d" }}>{trip.destination}</p>
      <p style={{ margin: 0, fontSize: "0.875rem" }}>
        {trip.startDate} → {trip.endDate}
      </p>
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
        <Link to={`/trips/${trip.id}`}>View</Link>
        <Link to={`/trips/${trip.id}/edit`}>Edit</Link>
        <button onClick={handleDelete} style={{ color: "#dc3545", background: "none", border: "none", padding: 0 }}>
          Delete
        </button>
      </div>
    </div>
  );
}
