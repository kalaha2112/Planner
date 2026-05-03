import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTrips } from "../context/TripContext.jsx";

const emptyForm = { name: "", destination: "", startDate: "", endDate: "", description: "" };

export default function TripForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { createTrip, updateTrip } = useTrips();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(id);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/trips/${id}`)
      .then((r) => r.json())
      .then(({ name, destination, startDate, endDate, description }) =>
        setForm({ name, destination, startDate: startDate || "", endDate: endDate || "", description: description || "" })
      );
  }, [id]);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const trip = isEdit ? await updateTrip(id, form) : await createTrip(form);
      navigate(`/trips/${trip.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>{isEdit ? "Edit Trip" : "New Trip"}</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "480px" }}>
        <input name="name" placeholder="Trip name *" value={form.name} onChange={handleChange} required />
        <input name="destination" placeholder="Destination *" value={form.destination} onChange={handleChange} required />
        <label>Start date <input type="date" name="startDate" value={form.startDate} onChange={handleChange} /></label>
        <label>End date   <input type="date" name="endDate"   value={form.endDate}   onChange={handleChange} /></label>
        <textarea name="description" placeholder="Description" value={form.description} onChange={handleChange} rows={3} />
        <button type="submit" disabled={saving}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create Trip"}</button>
      </form>
    </div>
  );
}
