const path = require("node:path");
const { register, require: tsxRequire } = require("tsx/cjs/api");

register();

const serverEntry = path.join(
  process.env.APP_ROOT || process.cwd(),
  "src",
  "server",
  "index.ts"
);

tsxRequire(serverEntry, __filename);
