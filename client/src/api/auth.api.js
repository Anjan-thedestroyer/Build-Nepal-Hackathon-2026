import API from "./axios";

// Register user
export const registerUser = (userData) => {
  return API.post("/user/register", userData);
};

// Login user
export const loginUser = (credentials) => {
  return API.post("/user/login", credentials);
};

// Logout user
export const logoutUser = () => {
  return API.post("/user/logout");
};

// Get current user profile (Auth required)
export const getUserProfile = () => {
  return API.get("/user/user-data");
};

// Get all users (Officer/Admin only)
export const getAllUsers = () => {
  return API.get("/user/all-users");
};