import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Navbar } from "./components/common/Navbar";
import { ProtectedRoute } from "./components/common/ProtectedRoute";
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import CitizenDashboard from "./pages/citizen/CitizenDashboard";
// Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import AdminDashboard from "./pages/officer/AdminDashboard";

// Placeholder Dashboards (Replace with your actual imports when ready)


const OfficerDashboard = () => (
  <div className="page">
    <div className="card">
      <h2 className="card__title">Officer Portal</h2>
      <p>Register new Lalpurja, transfer land deeds, and freeze/unfreeze titles.</p>
    </div>
  </div>
);

const PublicLandSearch = () => (
  <div className="page">
    <div className="card">
      <h2 className="card__title">Public Cadastral Search</h2>
      <p>Search Kitta numbers and Ward boundaries public records.</p>
    </div>
  </div>
);

export default function App() {
  return (
    <>
      {/* Global Navigation Bar */}
      <Navbar />

      {/* Primary Route Table */}
      <main>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<PublicLandSearch />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Citizen Protected Routes */}
          <Route
            path="/citizen/dashboard"
            element={
              <ProtectedRoute allowedRoles={["CITIZEN"]}>
                <CitizenDashboard />
              </ProtectedRoute>
            }
          />

          {/* Officer & Admin Protected Routes */}
          <Route
            path="/officer/dashboard"
            element={
              <ProtectedRoute allowedRoles={["OFFICER", "ADMIN"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback Redirection */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}