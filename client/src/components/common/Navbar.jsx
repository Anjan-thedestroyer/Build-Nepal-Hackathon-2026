import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { logoutUser } from "../../api/auth.api";
import "./Navbar.css";

export const Navbar = () => {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [taxInfo, setTaxInfo] = useState(null);

  useEffect(() => {
    // Get tax information based on user's land category
    if (user?.landCategory) {
      const taxRates = {
        'Agricultural': { rate: 10, label: 'Agricultural Land Tax' },
        'Residential': { rate: 5, label: 'Residential Land Tax' },
        'Commercial': { rate: 15, label: 'Commercial Land Tax' },
        'Industrial': { rate: 12, label: 'Industrial Land Tax' },
        'Forest/Conservation': { rate: 2, label: 'Conservation Land Tax' },
        'Public/Government': { rate: 0, label: 'Government Land (Exempt)' },
      };
      setTaxInfo(taxRates[user.landCategory] || taxRates['Residential']);
    }
  }, [user]);

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
        <img 
          src="/gemini-svg.svg" 
          alt="DMalpot Logo" 
          className="navbar__logo"
        />
        <span className="navbar__badge">
          {isOfficer ? "Officer Portal" : "Digital Cadastral"}
        </span>
      </Link>

      {/* Navigation Links */}
      <nav className="navbar__links">

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
          <div className="navbar__user-container">
            {/* Tax Information */}
            {taxInfo && user.landCategory && (
              <div className="navbar__tax-info">
                <span className="navbar__tax-label">{taxInfo.label}:</span>
                <span className={`navbar__tax-rate ${taxInfo.rate > 0 ? 'tax-rate--active' : 'tax-rate--exempt'}`}>
                  {taxInfo.rate}%
                </span>
              </div>
            )}
            
            <div className="navbar__user">
              <div className="navbar__user-avatar">
                {user.fullName?.charAt(0) || user.email?.charAt(0) || 'U'}
              </div>
              <div className="navbar__user-info">
                <div className="navbar__user-name">
                  {user.fullName || user.email}
                </div>
                <div className="navbar__user-role">
                  {user.role} {user.landCategory && `• ${user.landCategory}`}
                </div>
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