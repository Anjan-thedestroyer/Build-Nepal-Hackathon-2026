import { create } from "zustand";

// Safe JSON parser helper to prevent crashes on invalid/undefined storage values
const getInitialUser = () => {
  try {
    const item = localStorage.getItem("dmalpot_user");
    if (!item || item === "undefined") return null;
    return JSON.parse(item);
  } catch (error) {
    console.error("Error parsing user from localStorage:", error);
    localStorage.removeItem("dmalpot_user");
    return null;
  }
};

export const useAuthStore = create((set, get) => ({
  // Safely initialize state
  user: getInitialUser(),
  token: localStorage.getItem("dmalpot_token") || null,

  /**
   * Set user session after successful login or registration
   * @param {Object} user - User object containing _id, name, email, citizenshipNo, role, etc.
   * @param {string} token - JWT token string
   */
  setAuth: (user, token) => {
    localStorage.setItem("dmalpot_user", JSON.stringify(user));
    localStorage.setItem("dmalpot_token", token);
    set({ user, token });
  },

  /**
   * Update user details in state & localStorage (e.g., after profile edits)
   * @param {Object} updatedUserData 
   */
  updateUser: (updatedUserData) => {
    const currentUser = get().user;
    const newUserData = { ...currentUser, ...updatedUserData };
    localStorage.setItem("dmalpot_user", JSON.stringify(newUserData));
    set({ user: newUserData });
  },

  /**
   * Clear session data and log out
   */
  logout: () => {
    localStorage.removeItem("dmalpot_user");
    localStorage.removeItem("dmalpot_token");
    set({ user: null, token: null });
  },

  // Helper Selectors / Computeds
  isAuthenticated: () => !!get().token,
  isOfficer: () => get().user?.role === "officer" || get().user?.role === "admin",
  isCitizen: () => get().user?.role === "citizen",
}));