const axios = require("axios");
const { setAuthToken } = require("../config/axiosInstance");
const { Log, setToken } = require("logging-middleware");
const env = require("../config/env");

async function authenticate() {
  await Log("backend", "info", "auth", "Authentication flow started — requesting bearer token");

  try {
    const response = await axios.post(
      `${env.BASE_URL}/auth`,
      {
        email: env.EMAIL,
        name: env.NAME,
        rollNo: env.ROLL_NO,
        accessCode: env.ACCESS_CODE,
        clientId: env.CLIENT_ID,
        clientSecret: env.CLIENT_SECRET,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      }
    );

    const token =
      response.data?.token ||
      response.data?.accessToken ||
      response.data?.access_token ||
      response.data?.data?.token;

    if (!token) {
      throw new Error("Auth response did not contain a recognizable token field");
    }

    setAuthToken(token);
    setToken(token);

    await Log("backend", "info", "auth", "Bearer token acquired and stored — logging middleware activated");

    return token;
  } catch (err) {
    await Log("backend", "fatal", "auth", `Authentication failed — ${err.message}`);
    throw err;
  }
}

module.exports = { authenticate };
