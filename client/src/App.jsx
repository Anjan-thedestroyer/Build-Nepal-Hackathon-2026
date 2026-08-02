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


export default function App() {
  return (
    <>
      {/* Global Navigation Bar */}
      <Navbar />

      {/* Primary Route Table */}
      <main>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={ <CitizenDashboard />} />
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