const axios = require("axios");
const env = require("./env");

let _token = null;

const axiosInstance = axios.create({
  baseURL: env.BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    if (_token) {
      config.headers["Authorization"] = `Bearer ${_token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;

    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { authenticate } = require("../services/authService");
        const newToken = await authenticate();
        originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      } catch (authErr) {
        return Promise.reject(authErr);
      }
    }

    const url = error.config?.url;
    const msg = error.response?.data?.message || error.message;
    const enriched = new Error(
      `HTTP ${status ?? "N/A"} on [${url ?? "unknown"}]: ${msg}`
    );
    enriched.status = status;
    enriched.originalError = error;
    return Promise.reject(enriched);
  }
);

function setAuthToken(token) {
  _token = token;
}

function getAuthToken() {
  return _token;
}

module.exports = { axiosInstance, setAuthToken, getAuthToken };
