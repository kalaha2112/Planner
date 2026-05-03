const itemStyle = {
  display: "flex", gap: "1rem", alignItems: "flex-start",
  padding: "0.75rem", borderLeft: "3px solid #1a73e8",
  marginBottom: "0.5rem", background: "#fff",
};

export default function ItineraryItem({ item }) {
  return (
    <div style={itemStyle}>
      <div style={{ minWidth: "80px", color: "#6c757d", fontSize: "0.875rem" }}>
        Day {item.day}{item.time && ` · ${item.time}`}
      </div>
      <div>
        <strong>{item.title}</strong>
        {item.notes && <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>{item.notes}</p>}
      </div>
    </div>
  );
}
