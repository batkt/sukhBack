const dotEnv = require("dotenv");
dotEnv.config({ path: "./tokhirgoo/tokhirgoo.env" });

module.exports = {
  PORT: process.env.PORT,
  DB_URL: process.env.MONGODB_URI,
  APP_SECRET: process.env.APP_SECRET,
  UNDSEN_IP: process.env.UNDSEN_IP,
  BAAZ: process.env.BAAZ,
}
