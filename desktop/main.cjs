const { app, BrowserWindow, dialog, shell, utilityProcess } = require("electron");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const localDataRoot = path.join(
  process.env.LOCALAPPDATA || app.getPath("appData"),
  "DashCom"
);
app.setPath("userData", localDataRoot);
app.setAppUserModelId("com.dashcom.desktop");

let mainWindow;
let serverProcess;
let serverStopped = false;
let shuttingDown = false;
let logStream;

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2");
    values[key] = value;
  }
  return values;
}

function copyInitialData() {
  const dataDir = path.join(localDataRoot, "data");
  const uploadsDir = path.join(localDataRoot, "uploads");
  const configPath = path.join(localDataRoot, "config.env");
  const bundledSeed = path.join(process.resourcesPath, "seed");
  const bundledDb = path.join(bundledSeed, "hyl_gym.db");
  const databasePath = path.join(dataDir, "hyl_gym.db");

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(path.join(localDataRoot, "logs"), { recursive: true });

  if (!fs.existsSync(databasePath)) {
    if (!fs.existsSync(bundledDb)) {
      throw new Error("El instalador no contiene la base inicial de DashCom.");
    }
    fs.copyFileSync(bundledDb, databasePath);
    const bundledUploads = path.join(bundledSeed, "uploads");
    if (fs.existsSync(bundledUploads)) {
      fs.cpSync(bundledUploads, uploadsDir, { recursive: true, force: false });
    }
  }

  const bundledConfig = path.join(process.resourcesPath, "runtime.env");
  if (!fs.existsSync(configPath) && fs.existsSync(bundledConfig)) {
    fs.copyFileSync(bundledConfig, configPath);
  }

  return { configPath, databasePath, uploadsDir };
}

function findAvailablePort(startPort = 4310) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > startPort + 30) {
        reject(new Error("No se encontro un puerto disponible para DashCom."));
        return;
      }
      const probe = net.createServer();
      probe.unref();
      probe.once("error", () => tryPort(port + 1));
      // Se prueba en 0.0.0.0, la misma direccion en la que escucha el servidor: en Windows un puerto tomado
      // en 0.0.0.0 (otra instancia o un contenedor Docker) puede parecer libre si solo se prueba 127.0.0.1.
      probe.listen(port, "0.0.0.0", () => {
        probe.close(() => resolve(port));
      });
    };
    tryPort(startPort);
  });
}

function startServer(port, paths) {
  const logPath = path.join(localDataRoot, "logs", "dashcom.log");
  logStream = fs.createWriteStream(logPath, { flags: "a" });
  logStream.write(`\n[${new Date().toISOString()}] Iniciando DashCom Desktop\n`);

  const runtimeEnv = parseEnvFile(paths.configPath);
  const packagedAppRoot = app.getAppPath();
  const serverCwd = packagedAppRoot.endsWith(".asar")
    ? process.resourcesPath
    : packagedAppRoot;
  const serverEntry = path.join(packagedAppRoot, "desktop", "server.cjs");
  serverProcess = utilityProcess.fork(serverEntry, [], {
    cwd: serverCwd,
    stdio: "pipe",
    serviceName: "DashCom API",
    env: {
      ...process.env,
      ...runtimeEnv,
      APP_ROOT: packagedAppRoot,
      DASHCOM_DESKTOP_VERSION: app.getVersion(),
      NODE_ENV: "production",
      NODE_USE_SYSTEM_CA: "1",
      HOST: "0.0.0.0",
      PORT: String(port),
      DATABASE_PATH: paths.databasePath,
      UPLOAD_DIR: paths.uploadsDir
    }
  });

  serverProcess.stdout.pipe(logStream, { end: false });
  serverProcess.stderr.pipe(logStream, { end: false });
  serverProcess.once("exit", (code) => {
    serverStopped = true;
    logStream?.write(`[${new Date().toISOString()}] Servidor finalizado: ${code}\n`);
    if (!shuttingDown && code !== 0) {
      dialog.showErrorBox(
        "DashCom no pudo continuar",
        `El servidor local se cerro inesperadamente. Revisa el registro en:\n${logPath}`
      );
      app.quit();
    }
  });
}

async function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (serverStopped) {
      throw new Error("El servidor local termino antes de iniciar.");
    }
    try {
      const response = await fetch(`${url}/api/ping`);
      if (response.ok) return;
    } catch {
      // El servidor aun esta iniciando.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("DashCom tardo demasiado en iniciar.");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#0b0d0f",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(__dirname, "splash.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
}

async function boot() {
  try {
    createWindow();
    const paths = copyInitialData();
    const port = await findAvailablePort();
    const url = `http://127.0.0.1:${port}`;
    startServer(port, paths);
    await waitForServer(url);
    await mainWindow.loadURL(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("No se pudo iniciar DashCom", message);
    app.quit();
  }
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(boot);
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  shuttingDown = true;
  if (serverProcess && !serverStopped) serverProcess.kill();
  logStream?.end();
});
