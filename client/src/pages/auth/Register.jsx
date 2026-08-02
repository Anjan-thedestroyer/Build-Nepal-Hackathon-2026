import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../../api/auth.api";
import { useAuthStore } from "../../store/useAuthStore";

export const Register = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    citizenshipNo: "",
    issueDistrict: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (errorMessage) setErrorMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // Client-side validations
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Passwords do not match. Please check and try again.");
      return;
    }

    if (formData.password.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      // Matches the backend controller expectations:
      // { fullName, email, password, citizenshipNo, issueDistrict }
      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        citizenshipNo: formData.citizenshipNo,
        issueDistrict: formData.issueDistrict,
        password: formData.password,
      };

      const response = await registerUser(payload);
      const { user, token } = response.data;

      setSuccessMessage("Account registered successfully!");

      // If backend returns token, log in directly; otherwise redirect to login
      if (token && user) {
        setAuth(user, token);
        setTimeout(() => {
          navigate("/citizen/dashboard");
        }, 1000);
      } else {
        setTimeout(() => {
          navigate("/login");
        }, 1500);
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="card login-card" style={{ maxWidth: "480px" }}>
        {/* Brand Header */}
        <div className="login-card__header">
          <div className="navbar__brand" style={{ justifyContent: "center" }}>
            <span>DMalpot</span>
            <span className="navbar__badge">Citizen Registration</span>
          </div>
          <p className="login-card__subtitle">
            Create an account to access digital land certificates, verify records, and view portal services.
          </p>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="login-alert login-alert--danger">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            className="login-alert"
            style={{
              backgroundColor: "var(--success-bg)",
              color: "var(--success)",
              border: "1px solid #86efac",
            }}
          >
            {successMessage}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fullName">Full Name (According to Citizenship)</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              placeholder="e.g. Abinash Paudel"
              value={formData.fullName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid-2col" style={{ gap: "0.5rem" }}>
            <div className="form-group">
              <label htmlFor="citizenshipNo">Citizenship Number</label>
              <input
                type="text"
                id="citizenshipNo"
                name="citizenshipNo"
                placeholder="27-01-78-04912"
                value={formData.citizenshipNo}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="issueDistrict">Issue District</label>
              <input
                type="text"
                id="issueDistrict"
                name="issueDistrict"
                placeholder="e.g. Kathmandu"
                value={formData.issueDistrict}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="name@domain.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid-2col" style={{ gap: "0.5rem" }}>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
            style={{ marginTop: "0.75rem" }}
          >
            {loading ? "Creating Account..." : "Register Citizen Account"}
          </button>
        </form>

        {/* Footer */}
        <div className="login-card__footer">
          <p>
            Already registered?{" "}
            <Link to="/login" className="login-card__link">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;