import { Link, NavLink } from "react-router-dom";

const navStyle = {
  display: "flex", alignItems: "center", gap: "1.5rem",
  padding: "0.75rem 1.5rem", background: "#1a73e8", color: "#fff",
};
const activeStyle = { fontWeight: "bold", textDecoration: "underline" };

export default function Navbar() {
  return (
    <nav style={navStyle}>
      <Link to="/" style={{ fontSize: "1.25rem", fontWeight: "700" }}>WanderBook</Link>
      <NavLink to="/trips" style={({ isActive }) => isActive ? activeStyle : {}}>My Trips</NavLink>
      <NavLink to="/trips/new" style={({ isActive }) => isActive ? activeStyle : {}}>+ New Trip</NavLink>
    </nav>
  );
}
