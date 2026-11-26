import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Shared axios instance – always send cookies for Emergent Auth
export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach admin token when calling admin endpoints
api.interceptors.request.use((config) => {
  const adminToken = localStorage.getItem("clann_admin_token");
  if (adminToken && config.url && config.url.startsWith("/")) {
    config.headers = config.headers || {};
    // Only attach for admin-scoped routes to avoid leaking: reads of /events
    // carry the token only on admin pages, writes always do.
    const onAdminPage = window.location.pathname.startsWith("/admin");
    if (config.url.startsWith("/admin") ||
        (config.url.startsWith("/events") &&
         (onAdminPage || ["post", "put", "delete"].includes((config.method || "").toLowerCase())))) {
      config.headers["X-Admin-Token"] = adminToken;
    }
  }
  return config;
});

// Search events by query - supports event names, categories, locations, and CLANN Event IDs
export const searchEvents = (query) => {
  return api.get("/events", { params: { q: query } });
};
