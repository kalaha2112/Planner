// In-memory store — resets on server restart (MVP only)
let trips = [
  {
    id: "1",
    name: "Tokyo Adventure",
    destination: "Tokyo, Japan",
    startDate: "2026-07-01",
    endDate: "2026-07-14",
    description: "Cherry blossoms, ramen, temples.",
    items: [
      { id: "i1", day: 1, time: "09:00", title: "Arrive at Narita", notes: "Take Narita Express" },
      { id: "i2", day: 1, time: "15:00", title: "Check in to hotel", notes: "Shinjuku district" },
    ],
  },
];

let nextTripId = 2;
let nextItemId = 3;

export const getAllTrips = () => trips;

export const getTripById = (id) => trips.find((t) => t.id === id);

export const createTrip = (data) => {
  const trip = { id: String(nextTripId++), items: [], ...data };
  trips.push(trip);
  return trip;
};

export const updateTrip = (id, data) => {
  const idx = trips.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  trips[idx] = { ...trips[idx], ...data, id, items: trips[idx].items };
  return trips[idx];
};

export const deleteTrip = (id) => {
  const idx = trips.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  trips.splice(idx, 1);
  return true;
};

export const getItems = (tripId) => {
  const trip = getTripById(tripId);
  return trip ? trip.items : null;
};

export const addItem = (tripId, data) => {
  const trip = getTripById(tripId);
  if (!trip) return null;
  const item = { id: `i${nextItemId++}`, ...data };
  trip.items.push(item);
  return item;
};
