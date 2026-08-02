import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  // 1. Unauthenticated users -> redirect to Login
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Role-restricted routes check
  if (allowedRoles && (!user?.role || !allowedRoles.includes(user.role))) {
    // Redirect citizens trying to access officer routes back to citizen dashboard
    if (user?.role === "CITIZEN") {
      return <Navigate to="/citizen/dashboard" replace />;
    }
    // Redirect officers trying to access citizen routes to officer dashboard
    if (user?.role === "OFFICER" || user?.role === "ADMIN") {
      return <Navigate to="/officer/dashboard" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
};