const path = require("node:path");

const appRoot = process.env.APP_ROOT || path.join(__dirname, "..");
require(path.join(appRoot, "dist", "server", "index.cjs"));
