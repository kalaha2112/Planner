import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TripProvider } from "./context/TripContext.jsx";
import Navbar from "./components/Navbar.jsx";
import Home from "./pages/Home.jsx";
import TripList from "./pages/TripList.jsx";
import TripDetail from "./pages/TripDetail.jsx";
import TripForm from "./pages/TripForm.jsx";

export default function App() {
  return (
    <TripProvider>
      <BrowserRouter>
        <Navbar />
        <main style={{ padding: "1.5rem", maxWidth: "900px", margin: "0 auto" }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/trips" element={<TripList />} />
            <Route path="/trips/new" element={<TripForm />} />
            <Route path="/trips/:id" element={<TripDetail />} />
            <Route path="/trips/:id/edit" element={<TripForm />} />
          </Routes>
        </main>
      </BrowserRouter>
    </TripProvider>
  );
}
