import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { logoutUser } from "../../api/auth.api";
import "./Navbar.css";

export const Navbar = () => {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Logout API failed, clearing session locally...", error);
    } finally {
      logout();
      navigate("/login");
    }
  };

  // Helper to append active class for exact route highlighting
  const activeClass = (path) => (location.pathname === path ? "active" : "");

  const isOfficer = user?.role === "OFFICER" || user?.role === "ADMIN";
  const isCitizen = user?.role === "CITIZEN";

  return (
    <header className="navbar">
      {/* Brand Logo & Portal Tag */}
      <Link to="/" className="navbar__brand">
        <i>🏛️</i>
        <span>DMalpot</span>
        <span className="navbar__badge">
          {isOfficer ? "Officer Portal" : "Digital Cadastral"}
        </span>
      </Link>

      {/* Navigation Links */}
      <nav className="navbar__links">
        <Link to="/" className={`navbar__link ${activeClass("/")}`}>
          Public GIS Search
        </Link>

        {token && isCitizen && (
          <Link
            to="/citizen/dashboard"
            className={`navbar__link ${activeClass("/citizen/dashboard")}`}
          >
            My Lalpurja Parcels
          </Link>
        )}

        {token && isOfficer && (
          <Link
            to="/officer/dashboard"
            className={`navbar__link ${activeClass("/officer/dashboard")}`}
          >
            Officer Control Panel
          </Link>
        )}
      </nav>

      {/* Auth Actions & User Badge */}
      <div className="navbar__actions">
        {token && user ? (
          <div className="row" style={{ gap: "var(--space-md)" }}>
            <div style={{ textAlign: "right", lineHeight: "1.2" }}>
              <div
                style={{
                  fontSize: "var(--fs-sm)",
                  fontWeight: "600",
                  color: "var(--color-text-primary)",
                }}
              >
                {user.fullName || user.email}
              </div>
              <div
                style={{
                  fontSize: "var(--fs-xs)",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {user.role}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn btn--ghost btn--sm"
              title="Sign Out"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="row" style={{ gap: "var(--space-sm)" }}>
            <Link to="/login" className="btn btn--ghost btn--sm">
              Sign In
            </Link>
            <Link to="/register" className="btn btn--primary btn--sm">
              Register Citizen ID
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;