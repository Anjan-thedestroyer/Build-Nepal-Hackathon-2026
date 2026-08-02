import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "../../api/auth.api";
import { useAuthStore } from "../../store/useAuthStore";
import "./Login.css";
export const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const setAuth = useAuthStore((state) => state.setAuth);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Clear error message when user starts typing
    if (errorMessage) setErrorMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await loginUser(formData);
      const { user, token } = response.data;

      // Save user session into Zustand state & localStorage
      setAuth(user, token);
      console.log("Login successful:", user);
      // Redirect user based on their assigned role
      if (user.role === "officer" || user.role === "admin") {
        navigate("/officer/dashboard");
      } else {
        navigate("/citizen/dashboard");
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || "Invalid credentials. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="card login-card">
        {/* Brand Header */}
        <div className="login-card__header">
          <div className="navbar__brand" style={{ justifyContent: "center" }}>
            <span>DMalpot</span>
            <span className="navbar__badge">Portal</span>
          </div>
          <p className="login-card__subtitle">
            Sign in to access digital land records, cadastral maps, and title services.
          </p>
        </div>

        {/* Error Alert Message */}
        {errorMessage && (
          <div className="login-alert login-alert--danger">
            {errorMessage}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address </label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="e.g. citizen@dmalpot.gov.np"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

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

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading}
            style={{ marginTop: "1rem" }}
          >
            {loading ? "Authenticating..." : "Login"}
          </button>
        </form>

        {/* Footer Links */}
        <div className="login-card__footer">
          <p>
            Don't have an account?{" "}
            <Link to="/register" className="login-card__link">
              Register Citizen ID
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;