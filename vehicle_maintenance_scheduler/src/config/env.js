const dotenv = require("dotenv");
dotenv.config();

const REQUIRED_VARS = [
  "PORT",
  "BASE_URL",
  "EMAIL",
  "NAME",
  "ROLL_NO",
  "ACCESS_CODE",
  "CLIENT_ID",
  "CLIENT_SECRET",
];

for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    throw new Error(
      `[env] Missing required environment variable: ${key}. Aborting startup.`
    );
  }
}

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  BASE_URL: process.env.BASE_URL,
  EMAIL: process.env.EMAIL,
  NAME: process.env.NAME,
  ROLL_NO: process.env.ROLL_NO,
  ACCESS_CODE: process.env.ACCESS_CODE,
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
};
