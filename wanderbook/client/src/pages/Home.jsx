import { Link } from "react-router-dom";

const btnPrimary = {
  marginRight: "1rem", padding: "0.6rem 1.2rem",
  background: "#1a73e8", color: "#fff", borderRadius: "6px", border: "none",
};
const btnOutline = {
  padding: "0.6rem 1.2rem",
  border: "1px solid #1a73e8", borderRadius: "6px",
};

export default function Home() {
  return (
    <div style={{ textAlign: "center", paddingTop: "4rem" }}>
      <h1>Welcome to WanderBook</h1>
      <p style={{ color: "#6c757d", fontSize: "1.125rem" }}>
        Plan your trips, build your itineraries.
      </p>
      <Link to="/trips" style={btnPrimary}>View Trips</Link>
      <Link to="/trips/new" style={btnOutline}>Plan a Trip</Link>
    </div>
  );
}
