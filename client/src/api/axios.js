import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";

// Create base Axios instance
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

API.interceptors.request.use(
  (config) => {
    // Retrieve token from Zustand state or localStorage
    const token = useAuthStore.getState().token || localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Auto logout on unauthorized token expiration
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default API;