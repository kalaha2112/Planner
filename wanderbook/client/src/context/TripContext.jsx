import { createContext, useContext, useState, useCallback } from "react";

const TripContext = createContext(null);

export function TripProvider({ children }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trips");
      if (!res.ok) throw new Error("Failed to fetch trips");
      setTrips(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTrip = async (data) => {
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create trip");
    const trip = await res.json();
    setTrips((prev) => [...prev, trip]);
    return trip;
  };

  const updateTrip = async (id, data) => {
    const res = await fetch(`/api/trips/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update trip");
    const updated = await res.json();
    setTrips((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  };

  const deleteTrip = async (id) => {
    const res = await fetch(`/api/trips/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete trip");
    setTrips((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <TripContext.Provider value={{ trips, loading, error, fetchTrips, createTrip, updateTrip, deleteTrip }}>
      {children}
    </TripContext.Provider>
  );
}

export const useTrips = () => {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrips must be used within TripProvider");
  return ctx;
};
