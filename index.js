"use strict";
const electron = require("electron");
const path = require("path");
const promises = require("fs/promises");
const utils = require("@electron-toolkit/utils");
const fs = require("fs");
const os = require("os");
const net = require("net");
const crypto = require("crypto");
const tar = require("tar");
const child_process = require("child_process");
const log = require("electron-log");
const pty = require("node-pty");
const electronUpdater = require("electron-updater");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const os__namespace = /* @__PURE__ */ _interopNamespaceDefault(os);
const tar__namespace = /* @__PURE__ */ _interopNamespaceDefault(tar);
const pty__namespace = /* @__PURE__ */ _interopNamespaceDefault(pty);
const APP_PROFILE = {
  "brand": {
    "name": "Spark Atlas",
    "desktopName": "Spark Atlas",
    "serviceName": "Open WebUI",
    "description": "Spark Atlas",
    "author": "Spark Atlas",
    "homepage": "https://openwebui.com",
    "officialWebsiteUrl": "https://spark-ai.top",
    "copyrightText": "Copyright (c) 2026 Spark Atlas. All rights reserved.",
    "creatorText": "Created by Spark Atlas",
    "packageName": "spark-atlas-desktop",
    "appId": "com.sparkatlas.desktop",
    "executableName": "spark-atlas",
    "linuxMaintainer": "openwebui.com",
    "githubOwner": "open-webui",
    "githubRepo": "desktop"
  },
  "features": {
    "allowLocalOpenWebUIInstall": false,
    "allowUserRemoteOpenWebUI": false,
    "defaultRemoteOpenWebUI": "https://chat.spark-ai.top",
    "defaultRemoteOpenWebUIName": "Spark Atlas",
    "defaultLandingMode": "remote",
    "allowRemotePasskeys": true,
    "allowRemoteDesktopBridge": true,
    "allowRemoteNativeApi": true,
    "allowRemoteLocalResources": true
  },
  "remotePermissions": {
    "allowed": [
      "media",
      "mediaKeySystem",
      "notifications",
      "clipboard-read",
      "clipboard-sanitized-write",
      "clipboard-read-write",
      "fullscreen",
      "geolocation",
      "hid",
      "serial",
      "usb",
      "pointerLock"
    ]
  },
  "auth": {
    "allowExternalAuthOriginsInWebview": true,
    "allowedAuthOrigins": []
  },
  "desktopBridge": {
    "allowedCapabilities": [
      "app.info",
      "app.openExternal",
      "system.platform",
      "system.selectFolder",
      "resources.openPath",
      "resources.selectFile"
    ]
  },
  "updates": {
    "provider": "generic",
    "owner": "open-webui",
    "repo": "desktop",
    "url": "https://chat.spark-ai.top/api/v1/configs/apps/updates/desktop/",
    "updaterCacheDirName": "spark-atlas-updater"
  },
  "assets": {
    "iconDir": "/Users/cary/Desktop/Fun/Spark Atlas/icons",
    "iconPng": "light.png",
    "iconIco": "light.ico",
    "trayPng": "carved_light.png",
    "macIconScale": 0.82,
    "splashLightPng": "carved_light.png",
    "splashDarkPng": "carved_dark.png"
  }
};
log.transports.file.resolvePathFn = () => getLogFilePath("main");
const serverLogger = log.create({ logId: "server" });
serverLogger.transports.file.resolvePath = () => getLogFilePath("server");
const getLogFilePath = (name = "main") => {
  const logDir = path__namespace.join(getUserDataPath(), "logs");
  if (!fs__namespace.existsSync(logDir)) {
    fs__namespace.mkdirSync(logDir, { recursive: true });
  }
  return path__namespace.join(logDir, `${name}.log`);
};
const getUserDataPath = () => {
  const userDataDir = electron.app.getPath("userData");
  if (!fs__namespace.existsSync(userDataDir)) {
    try {
      fs__namespace.mkdirSync(userDataDir, { recursive: true });
    } catch (error) {
      log.error(error);
    }
  }
  return path__namespace.normalize(userDataDir);
};
const getInstallDir = () => {
  const configPath = path__namespace.join(getUserDataPath(), "config.json");
  let customDir = "";
  try {
    if (fs__namespace.existsSync(configPath)) {
      const data = JSON.parse(fs__namespace.readFileSync(configPath, "utf8"));
      customDir = data.installDir || "";
    }
  } catch {
  }
  const installDir = customDir || getUserDataPath();
  if (!fs__namespace.existsSync(installDir)) {
    try {
      fs__namespace.mkdirSync(installDir, { recursive: true });
    } catch (error) {
      log.error(error);
    }
  }
  return path__namespace.normalize(installDir);
};
const getOpenWebUIDataPath = () => {
  const configPath = path__namespace.join(getUserDataPath(), "config.json");
  let customDir = "";
  try {
    if (fs__namespace.existsSync(configPath)) {
      const data = JSON.parse(fs__namespace.readFileSync(configPath, "utf8"));
      customDir = data.dataDir || "";
    }
  } catch {
  }
  const openWebUIDataDir = customDir || path__namespace.join(getInstallDir(), "data");
  if (!fs__namespace.existsSync(openWebUIDataDir)) {
    try {
      fs__namespace.mkdirSync(openWebUIDataDir, { recursive: true });
    } catch (error) {
      log.error(error);
    }
  }
  return path__namespace.normalize(openWebUIDataDir);
};
const openUrl = (url2) => {
  if (!url2) {
    throw new Error("No URL provided to open in browser.");
  }
  log.info("Opening URL in browser:", url2);
  if (url2.startsWith("http://0.0.0.0")) {
    url2 = url2.replace("http://0.0.0.0", "http://localhost");
  }
  electron.shell.openExternal(url2);
};
const getSecretKey = (keyPath, key) => {
  keyPath = keyPath || path__namespace.join(getOpenWebUIDataPath(), ".key");
  if (fs__namespace.existsSync(keyPath)) {
    return fs__namespace.readFileSync(keyPath, "utf-8");
  }
  key = key || crypto.randomBytes(64).toString("hex");
  fs__namespace.writeFileSync(keyPath, key);
  return key;
};
const portInUse = async (port, host = "0.0.0.0") => {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(1e3).once("connect", () => {
      client.destroy();
      resolve(true);
    }).once("timeout", () => {
      client.destroy();
      resolve(false);
    }).once("error", () => {
      resolve(false);
    }).connect(port, host);
  });
};
const getPlatformString = () => {
  const platformMap = {
    darwin: "apple-darwin",
    win32: "pc-windows-msvc",
    linux: "unknown-linux-gnu"
  };
  return platformMap[os__namespace.platform()] || "unknown-linux-gnu";
};
const getArchString = () => {
  const archMap = {
    x64: "x86_64",
    arm64: "aarch64",
    ia32: "i686"
  };
  return archMap[os__namespace.arch()] || "x86_64";
};
const generateDownloadUrl = () => {
  const baseUrl = "https://github.com/astral-sh/python-build-standalone/releases/download";
  const releaseDate = "20260310";
  const pythonVersion = "3.12.13";
  const archString = getArchString();
  const platformString = getPlatformString();
  const filename = `cpython-${pythonVersion}+${releaseDate}-${archString}-${platformString}-install_only.tar.gz`;
  return `${baseUrl}/${releaseDate}/${filename}`;
};
const downloadFileWithProgress = async (url2, downloadPath, onProgress) => {
  try {
    const response = await fetch(url2);
    if (!response || !response.ok) {
      throw new Error(`HTTP error! status: ${response?.status}`);
    }
    const totalSize = parseInt(response.headers.get("content-length"), 10);
    let downloadedSize = 0;
    const reader = response.body.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      downloadedSize += value.length;
      if (onProgress && totalSize) {
        onProgress(downloadedSize / totalSize * 100, downloadedSize, totalSize);
      }
    }
    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    fs__namespace.writeFileSync(downloadPath, buffer);
    log.info("File downloaded successfully:", downloadPath);
    return downloadPath;
  } catch (error) {
    try {
      if (fs__namespace.existsSync(downloadPath)) {
        fs__namespace.unlinkSync(downloadPath);
      }
    } catch {
    }
    log.error("Download failed:", error);
    throw error;
  }
};
const getPythonDownloadPath = () => {
  return path__namespace.join(getUserDataPath(), "python.tar.gz");
};
const getPythonInstallationDir = () => {
  const pythonDir = path__namespace.join(getInstallDir(), "python");
  if (!fs__namespace.existsSync(pythonDir)) {
    try {
      fs__namespace.mkdirSync(pythonDir, { recursive: true });
    } catch (error) {
      log.error(error);
    }
  }
  return path__namespace.normalize(pythonDir);
};
const downloadPython = async (onProgress = null) => {
  const url2 = generateDownloadUrl();
  const downloadPath = getPythonDownloadPath();
  log.info(`Detected system: ${os__namespace.platform()} ${os__namespace.arch()}`);
  log.info(`Download path: ${downloadPath}`);
  log.info(`URL: ${url2}`);
  if (fs__namespace.existsSync(downloadPath)) {
    log.info(`File already exists: ${downloadPath}`);
    return downloadPath;
  }
  try {
    const result = await downloadFileWithProgress(url2, downloadPath, onProgress);
    log.info(`Python downloaded successfully to: ${result}`);
    return result;
  } catch (error) {
    log.error(`Download failed: ${error?.message}`);
    throw error;
  }
};
const checkInternet = async () => {
  try {
    await fetch("https://api.openwebui.com", { method: "GET" });
    return true;
  } catch {
    return false;
  }
};
const installPython = async (installationDir, onStatus) => {
  const pythonDownloadPath = getPythonDownloadPath();
  if (!fs__namespace.existsSync(pythonDownloadPath)) {
    if (!await checkInternet()) {
      throw new Error(
        "An active internet connection is required. Please connect to the internet and try again."
      );
    }
    let lastReportedPct = -1;
    await downloadPython((progress, downloaded, total) => {
      const pct = Math.floor(progress);
      if (pct === lastReportedPct) return;
      lastReportedPct = pct;
      const mb = (downloaded / 1024 / 1024).toFixed(1);
      const totalMb = (total / 1024 / 1024).toFixed(1);
      log.info(`Downloading Python: ${pct}% (${mb}/${totalMb} MB)`);
      onStatus?.(`Downloading Python… ${pct}% (${mb}/${totalMb} MB)`);
    });
  }
  if (!fs__namespace.existsSync(pythonDownloadPath)) {
    log.error("Python download not found");
    return false;
  }
  installationDir = installationDir || getPythonInstallationDir();
  log.info(installationDir, pythonDownloadPath);
  try {
    onStatus?.("Extracting Python…");
    const installBase = getInstallDir();
    await tar__namespace.x({ cwd: installBase, file: pythonDownloadPath });
  } catch (error) {
    log.error(error);
    try {
      fs__namespace.unlinkSync(pythonDownloadPath);
    } catch {
    }
    throw new Error("Failed to extract Python. The download may be corrupted. Please try again.");
  }
  if (!isPythonInstalled(installationDir)) {
    log.error("Python installation failed or not found");
    throw new Error(
      "Python was not found after installation. Try restarting the app or freeing disk space."
    );
  }
  try {
    onStatus?.("Installing uv package manager…");
    const pythonPath = getPythonPath(installationDir);
    await new Promise((resolve, reject) => {
      child_process.execFile(
        pythonPath,
        ["-m", "pip", "install", "uv"],
        {
          encoding: "utf-8",
          env: pythonEnv()
        },
        (error) => {
          if (error) reject(error);
          else resolve();
        }
      );
    });
    log.info("Successfully installed uv package");
    return true;
  } catch (error) {
    log.error("Failed to install uv:", error);
    throw new Error(
      `Failed to install the uv package manager: ${error?.message || "unknown error"}`
    );
  }
};
const getPythonExecutablePath = (envPath) => {
  if (process.platform === "win32") {
    return path__namespace.normalize(path__namespace.join(envPath, "python.exe"));
  }
  return path__namespace.normalize(path__namespace.join(envPath, "bin", "python"));
};
const getPythonPath = (installationDir) => {
  return path__namespace.normalize(getPythonExecutablePath(installationDir || getPythonInstallationDir()));
};
const pythonEnv = (extra = {}) => {
  const base = { ...process.env };
  if (process.platform === "win32") {
    const pythonDir = getPythonInstallationDir();
    const currentPath = process.env["PATH"] || process.env["Path"] || "";
    base["PATH"] = `${pythonDir};${currentPath}`;
    base["PYTHONIOENCODING"] = "utf-8";
  }
  return { ...base, ...extra };
};
const isPythonInstalled = (installationDir) => {
  const pythonPath = getPythonPath(installationDir);
  if (!fs__namespace.existsSync(pythonPath)) {
    return false;
  }
  try {
    const pythonVersion = child_process.execFileSync(pythonPath, ["--version"], {
      encoding: "utf-8",
      env: pythonEnv()
    });
    log.info("Installed Python Version:", pythonVersion.trim());
    return true;
  } catch {
    return false;
  }
};
const isUvInstalled = (installationDir) => {
  const pythonPath = getPythonPath(installationDir);
  try {
    const result = child_process.execFileSync(pythonPath, ["-m", "uv", "--version"], {
      encoding: "utf-8",
      env: pythonEnv()
    });
    log.info("Installed uv Version:", result.trim());
    return true;
  } catch {
    return false;
  }
};
const uninstallPython = (installationDir) => {
  installationDir = installationDir || getPythonInstallationDir();
  if (!fs__namespace.existsSync(installationDir)) {
    log.error("Python installation not found");
    return false;
  }
  try {
    fs__namespace.rmSync(installationDir, { recursive: true, force: true });
    log.info("Python installation removed:", installationDir);
  } catch (error) {
    log.error("Failed to remove Python installation", error);
    return false;
  }
  try {
    const pythonDownloadPath = getPythonDownloadPath();
    fs__namespace.rmSync(pythonDownloadPath, { recursive: true });
  } catch (error) {
    log.error("Failed to remove Python download", error);
    return false;
  }
  return true;
};
const installPackage = (packageName, version, onStatus) => {
  return new Promise((resolve, reject) => {
    if (!isPythonInstalled()) {
      return reject(
        new Error("Python is not installed. Please reinstall the app or run setup again.")
      );
    }
    const pythonPath = getPythonPath();
    const commandProcess = child_process.execFile(
      pythonPath,
      [
        "-m",
        "uv",
        "pip",
        "install",
        ...version ? [`${packageName}==${version}`] : [packageName, "-U"]
      ],
      {
        env: pythonEnv()
      }
    );
    let lastLine = "";
    commandProcess.stdout?.on("data", (data) => {
      const line = data.toString().trim();
      log.info(line);
      if (line) {
        lastLine = line;
        onStatus?.(line);
      }
    });
    commandProcess.stderr?.on("data", (data) => {
      const line = data.toString().trim();
      log.info(line);
      if (line) {
        lastLine = line;
        onStatus?.(line);
      }
    });
    commandProcess.on("exit", (code) => {
      log.info(`Package install exited with code ${code}`);
      if (code === 0) {
        resolve(true);
      } else {
        reject(
          new Error(
            lastLine || `Package installation failed (exit code ${code}). Please check your internet connection and try again.`
          )
        );
      }
    });
    commandProcess.on("error", (error) => {
      log.error(`Package install error: ${error.message}`);
      reject(new Error(`Failed to run package installer: ${error.message}`));
    });
  });
};
const isPackageInstalled = (packageName) => {
  const pythonPath = getPythonPath();
  if (!fs__namespace.existsSync(pythonPath)) return false;
  try {
    const info = child_process.execFileSync(pythonPath, ["-m", "uv", "pip", "show", packageName], {
      encoding: "utf-8",
      env: pythonEnv()
    });
    return info.includes(`Name: ${packageName}`);
  } catch {
    return false;
  }
};
const getPackageVersion = (packageName) => {
  const pythonPath = getPythonPath();
  if (!fs__namespace.existsSync(pythonPath)) return null;
  try {
    const info = child_process.execFileSync(pythonPath, ["-m", "uv", "pip", "show", packageName], {
      encoding: "utf-8",
      env: pythonEnv()
    });
    const match = info.match(/^Version:\s*(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
};
const uninstallPackage = (packageName) => {
  const pythonPath = getPythonPath();
  if (!fs__namespace.existsSync(pythonPath)) return false;
  try {
    child_process.execFileSync(pythonPath, ["-m", "uv", "pip", "uninstall", packageName], {
      encoding: "utf-8",
      env: pythonEnv()
    });
    log.info(`Uninstalled package: ${packageName}`);
    return true;
  } catch (error) {
    log.error(`Failed to uninstall ${packageName}:`, error);
    return false;
  }
};
const serverPIDs = /* @__PURE__ */ new Set();
const serverLogs = /* @__PURE__ */ new Map();
let serverPtyProcesses = /* @__PURE__ */ new Map();
const getServerPIDs = () => Array.from(serverPIDs);
const getServerPty = (pid2) => serverPtyProcesses.get(pid2);
const startServer = async (expose = false, port = null) => {
  await stopAllServers();
  const config = await getConfig();
  const configEnvVars = config.envVars ?? {};
  const host = expose ? "0.0.0.0" : "127.0.0.1";
  if (!isPythonInstalled()) throw new Error("Python is not installed");
  if (!isPackageInstalled("open-webui")) throw new Error("open-webui package is not installed");
  const pythonPath = getPythonPath();
  log.info(`Using Python at: ${pythonPath}`);
  if (!fs__namespace.existsSync(pythonPath)) {
    throw new Error(`Python executable not found at: ${pythonPath}`);
  }
  const commandArgs = ["-m", "uv", "run", "open-webui", "serve", "--host", host];
  const dataDir = getOpenWebUIDataPath();
  const secretKey = getSecretKey();
  if (!fs__namespace.existsSync(dataDir)) {
    fs__namespace.mkdirSync(dataDir, { recursive: true });
  }
  let desiredPort = port || 8080;
  let availablePort = desiredPort;
  while (await portInUse(availablePort, host)) {
    availablePort++;
    if (availablePort > desiredPort + 100) {
      throw new Error("No available ports found");
    }
  }
  commandArgs.push("--port", availablePort.toString());
  log.info("Starting Open-WebUI server...", pythonPath, commandArgs.join(" "));
  let ptyProcess2;
  try {
    ptyProcess2 = pty__namespace.spawn(pythonPath, commandArgs, {
      name: "xterm-256color",
      cols: 200,
      rows: 50,
      env: pythonEnv({
        ...configEnvVars ?? {},
        DATA_DIR: dataDir,
        WEBUI_SECRET_KEY: secretKey,
        PYTHONUNBUFFERED: "1"
      })
    });
  } catch (error) {
    throw new Error(`Failed to spawn PTY with ${pythonPath}: ${error?.message ?? error}`);
  }
  const pid2 = ptyProcess2.pid;
  const rawBuffer = [];
  serverPIDs.add(pid2);
  serverLogs.set(pid2, rawBuffer);
  serverPtyProcesses.set(pid2, ptyProcess2);
  ptyProcess2.onData((data) => {
    rawBuffer.push(data);
    serverLogger.info(`[PID:${pid2}] ${data.replace(/[\r\n]+/g, " ").trim()}`);
  });
  ptyProcess2.onExit(({ exitCode, signal }) => {
    const exitMsg = `\r
[Process exited with code ${exitCode}${signal ? ` signal ${signal}` : ""}]\r
`;
    rawBuffer.push(exitMsg);
    serverLogger.info(`[PID:${pid2}] Exited code=${exitCode} signal=${signal}`);
    serverPIDs.delete(pid2);
    serverPtyProcesses.delete(pid2);
  });
  let effectiveHost = host;
  if (!expose && host === "0.0.0.0") effectiveHost = "127.0.0.1";
  const url2 = `http://${effectiveHost}:${availablePort}`;
  log.info(`Server started with PID: ${pid2}, URL: ${url2}`);
  return { url: url2, pid: pid2 };
};
async function stopAllServers() {
  log.info("Stopping all servers...");
  const pidsToStop = Array.from(serverPIDs);
  if (pidsToStop.length === 0) return;
  for (const pid2 of pidsToStop) {
    const ptyProc = serverPtyProcesses.get(pid2);
    if (ptyProc) {
      try {
        ptyProc.kill();
      } catch (e) {
        log.warn(`Failed to kill PTY process ${pid2}:`, e);
      }
    } else {
      await terminateProcessTree(pid2, false);
    }
  }
  await sleep(2e3);
  for (const pid2 of pidsToStop) {
    if (isProcessRunning(pid2)) {
      await terminateProcessTree(pid2, true);
    }
  }
  for (const pid2 of pidsToStop) {
    if (!isProcessRunning(pid2)) {
      serverPIDs.delete(pid2);
      serverLogs.delete(pid2);
      serverPtyProcesses.delete(pid2);
    } else {
      log.warn(`Process ${pid2} may still be running after termination attempts`);
    }
  }
}
const clearAllServerLogs = () => {
  for (const logs of serverLogs.values()) {
    logs.length = 0;
  }
};
async function terminateProcessTree(pid2, forceKill = false) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (process.platform === "win32") {
        await terminateWindows(pid2, forceKill);
      } else {
        await terminateUnix(pid2, forceKill);
      }
      if (!isProcessRunning(pid2)) {
        log.info(`Successfully terminated process tree (PID: ${pid2})`);
        return;
      }
    } catch (error) {
      log.warn(`Attempt ${attempt}/${maxRetries} failed for PID ${pid2}:`, error);
    }
    if (attempt < maxRetries) await sleep(1e3);
  }
  log.error(`Failed to terminate process tree (PID: ${pid2}) after ${maxRetries} attempts`);
}
async function terminateWindows(pid2, forceKill) {
  const commands = forceKill ? [`taskkill /PID ${pid2} /T /F`] : [`taskkill /PID ${pid2} /T`, `taskkill /PID ${pid2} /T /F`];
  for (const cmd of commands) {
    try {
      child_process.execSync(cmd, { timeout: 5e3, stdio: "ignore" });
      await sleep(500);
    } catch {
    }
  }
}
async function terminateUnix(pid2, forceKill) {
  const signals = forceKill ? ["SIGKILL"] : ["SIGTERM", "SIGKILL"];
  for (const signal of signals) {
    try {
      process.kill(-pid2, signal);
      await sleep(500);
      if (isProcessRunning(pid2)) {
        process.kill(pid2, signal);
        await sleep(500);
      }
    } catch {
    }
  }
}
function isProcessRunning(pid2) {
  try {
    process.kill(pid2, 0);
    return true;
  } catch {
    return false;
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function getServerLog(pid2) {
  return serverLogs.get(pid2) || [];
}
const checkUrlAndOpen = async (url2, callback = async () => {
}) => {
  const maxAttempts = 1800;
  const interval = 2e3;
  let attempts = 0;
  const checkUrl = async () => {
    try {
      const response = await electron.net.fetch(url2, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  };
  const pollUrl = async () => {
    while (attempts < maxAttempts) {
      attempts++;
      const isAvailable = await checkUrl();
      if (isAvailable) {
        log.info("URL is now available");
        await callback();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
    log.info("URL check timed out");
  };
  pollUrl().catch((error) => {
    log.error("Error in URL polling:", error);
  });
};
const validateRemoteUrl = async (url2) => {
  try {
    const response = await electron.net.fetch(url2, {
      method: "HEAD",
      signal: AbortSignal.timeout(5e3)
    });
    return response.ok;
  } catch {
    return false;
  }
};
const DEFAULT_CONFIG = {
  version: 1,
  defaultConnectionId: null,
  connections: [],
  runInBackground: true,
  glassEffect: true,
  globalShortcut: "Alt+CommandOrControl+O",
  spotlightShortcut: "Shift+CommandOrControl+I",
  installDir: "",
  dataDir: "",
  localServer: {
    port: 8080,
    serveOnLocalNetwork: false,
    autoUpdate: true
  },
  openTerminal: {
    enabled: false,
    cwd: "",
    apiKey: ""
  },
  llamaCpp: {
    enabled: false,
    version: "latest",
    variant: "cpu",
    extraArgs: []
  },
  envVars: {},
  showSidebar: false,
  spotlightPosition: null,
  spotlightClipboardPaste: true,
  voiceInputShortcut: "Shift+CommandOrControl+Space",
  voiceInputEnabled: true,
  callShortcut: "Shift+CommandOrControl+C",
  callEnabled: true,
  windowBounds: null,
  windowMaximized: false
};
const applyProfileDefaults = (config) => {
  const next = {
    ...config,
    connections: [...config.connections ?? []]
  };
  const profileRemoteUrl = APP_PROFILE.features.defaultRemoteOpenWebUI?.trim();
  if (profileRemoteUrl) {
    const normalizedUrl = profileRemoteUrl.startsWith("http") ? profileRemoteUrl : `https://${profileRemoteUrl}`;
    const defaultRemoteId = "profile-default-remote";
    const existingIdx = next.connections.findIndex((conn) => conn.id === defaultRemoteId);
    const defaultRemote = {
      id: defaultRemoteId,
      name: APP_PROFILE.features.defaultRemoteOpenWebUIName || APP_PROFILE.brand.name,
      type: "remote",
      url: normalizedUrl
    };
    if (existingIdx === -1) {
      next.connections.unshift(defaultRemote);
    } else {
      next.connections[existingIdx] = {
        ...next.connections[existingIdx],
        ...defaultRemote
      };
    }
    if (!next.defaultConnectionId) {
      next.defaultConnectionId = defaultRemoteId;
    }
  }
  if (!APP_PROFILE.features.allowLocalOpenWebUIInstall && next.defaultConnectionId) {
    const defaultConn = next.connections.find((conn) => conn.id === next.defaultConnectionId);
    if (defaultConn?.type === "local") {
      next.defaultConnectionId = next.connections.find((conn) => conn.type === "remote")?.id ?? null;
    }
  }
  return next;
};
const getConfig = async () => {
  const configPath = path__namespace.join(getUserDataPath(), "config.json");
  try {
    if (fs__namespace.existsSync(configPath)) {
      const data = await fs__namespace.promises.readFile(configPath, "utf8");
      return applyProfileDefaults({ ...DEFAULT_CONFIG, ...JSON.parse(data) });
    }
    return applyProfileDefaults({ ...DEFAULT_CONFIG });
  } catch (error) {
    log.error("Error reading config, using defaults:", error);
    return applyProfileDefaults({ ...DEFAULT_CONFIG });
  }
};
let configWriteLock = Promise.resolve();
const setConfig = async (config) => {
  const previous = configWriteLock;
  let resolve;
  configWriteLock = new Promise((r) => {
    resolve = r;
  });
  await previous;
  const configPath = path__namespace.join(getUserDataPath(), "config.json");
  const tmpPath = configPath + ".tmp";
  try {
    const existing = await getConfig();
    const merged = { ...existing, ...config };
    await fs__namespace.promises.writeFile(tmpPath, JSON.stringify(merged, null, 2));
    await fs__namespace.promises.rename(tmpPath, configPath);
  } catch (error) {
    log.error("Error writing config:", error);
    try {
      if (fs__namespace.existsSync(tmpPath)) fs__namespace.unlinkSync(tmpPath);
    } catch {
    }
    throw error;
  } finally {
    resolve();
  }
};
const resetApp = async () => {
  await uninstallPython();
  log.info("Uninstalled Python environment");
  const configPath = path__namespace.join(getUserDataPath(), "config.json");
  if (fs__namespace.existsSync(configPath)) {
    try {
      fs__namespace.unlinkSync(configPath);
    } catch (error) {
      log.error("Failed to remove config file:", error);
    }
  }
  const secretKeyPath = path__namespace.join(getOpenWebUIDataPath(), ".key");
  if (fs__namespace.existsSync(secretKeyPath)) {
    try {
      fs__namespace.unlinkSync(secretKeyPath);
    } catch (error) {
      log.error("Failed to remove secret key file:", error);
    }
  }
  const dataPath = getOpenWebUIDataPath();
  if (fs__namespace.existsSync(dataPath)) {
    try {
      fs__namespace.rmSync(dataPath, { recursive: true, force: true });
    } catch (error) {
      log.error("Failed to remove data directory:", error);
    }
  }
  const llamaCppPath = path__namespace.join(getInstallDir(), "llama.cpp");
  if (fs__namespace.existsSync(llamaCppPath)) {
    try {
      fs__namespace.rmSync(llamaCppPath, { recursive: true, force: true });
      log.info("Removed llama.cpp directory");
    } catch (error) {
      log.error("Failed to remove llama.cpp directory:", error);
    }
  }
  const modelsPath = path__namespace.join(getInstallDir(), "models");
  if (fs__namespace.existsSync(modelsPath)) {
    try {
      fs__namespace.rmSync(modelsPath, { recursive: true, force: true });
      log.info("Removed models directory");
    } catch (error) {
      log.error("Failed to remove models directory:", error);
    }
  }
  const locksPath = path__namespace.join(getUserDataPath(), "locks");
  if (fs__namespace.existsSync(locksPath)) {
    try {
      fs__namespace.rmSync(locksPath, { recursive: true, force: true });
      log.info("Removed service locks");
    } catch (error) {
      log.error("Failed to remove locks directory:", error);
    }
  }
  try {
    const { session } = require("electron");
    await session.defaultSession.clearStorageData();
    await session.defaultSession.clearCache();
    log.info("Cleared Electron session data");
  } catch (error) {
    log.error("Failed to clear Electron session data:", error);
  }
};
class ServiceLock {
  locked = false;
  name;
  constructor(name) {
    this.name = name;
  }
  /**
   * Try to acquire the lock. Returns false if already locked.
   * This is synchronous — no interleaving possible in Node.js event loop.
   */
  acquire() {
    if (this.locked) {
      log.info(`[${this.name}] Lock held — rejecting duplicate start`);
      return false;
    }
    this.locked = true;
    return true;
  }
  /**
   * Release the lock. Called in stop() or on failure.
   */
  release() {
    this.locked = false;
  }
  /**
   * Check if the lock is currently held.
   */
  isLocked() {
    return this.locked;
  }
}
const isProcessAlive = (pid2) => {
  if (!pid2) return false;
  try {
    process.kill(pid2, 0);
    return true;
  } catch {
    return false;
  }
};
let ptyProcess$1 = null;
let pid$1 = null;
let url$1 = null;
let apiKey = null;
let status$1 = null;
let logBuffer$1 = [];
const lock$1 = new ServiceLock("open-terminal");
const getOpenTerminalInfo = () => ({
  url: url$1,
  apiKey,
  status: status$1,
  pid: pid$1
});
const getOpenTerminalPty = () => ptyProcess$1;
const getOpenTerminalLog = () => logBuffer$1;
const startOpenTerminal = async (port = null) => {
  if (!lock$1.acquire()) {
    return { url: url$1, apiKey, pid: pid$1 };
  }
  await stopOpenTerminal();
  if (!isPythonInstalled()) throw new Error("Python is not installed");
  if (!isPackageInstalled("open-terminal")) {
    log.info("open-terminal not installed, attempting install...");
    try {
      await installPackage("open-terminal");
    } catch (err) {
      throw new Error(
        `Open Terminal is not installed and auto-install failed. Please connect to the internet and try again. (${err?.message ?? err})`
      );
    }
  }
  const pythonPath = getPythonPath();
  const host = "127.0.0.1";
  const config = await getConfig();
  const configEnvVars = config.envVars ?? {};
  let generatedKey = config.openTerminal?.apiKey;
  if (!generatedKey) {
    generatedKey = crypto.randomBytes(24).toString("base64url");
    await setConfig({
      openTerminal: { ...config.openTerminal, apiKey: generatedKey }
    });
  }
  let desiredPort = port || 39284;
  let availablePort = desiredPort;
  while (await portInUse(availablePort, host)) {
    availablePort++;
    if (availablePort > desiredPort + 100) {
      throw new Error("No available port found for Open Terminal");
    }
  }
  const cwd = config.openTerminal?.cwd || require("os").homedir();
  const commandArgs = [
    "-m",
    "uv",
    "run",
    "open-terminal",
    "run",
    "--host",
    host,
    "--port",
    availablePort.toString(),
    "--api-key",
    generatedKey,
    "--cwd",
    cwd
  ];
  log.info("Starting Open Terminal...", pythonPath, commandArgs.join(" "));
  let spawned;
  try {
    spawned = pty__namespace.spawn(pythonPath, commandArgs, {
      name: "xterm-256color",
      cols: 200,
      rows: 50,
      env: {
        ...process.env,
        ...configEnvVars ?? {},
        PYTHONUNBUFFERED: "1",
        ...process.platform === "win32" ? { PYTHONIOENCODING: "utf-8" } : {}
      }
    });
  } catch (error) {
    throw new Error(`Failed to spawn Open Terminal: ${error?.message ?? error}`);
  }
  const spawnedPid = spawned.pid;
  logBuffer$1 = [];
  ptyProcess$1 = spawned;
  pid$1 = spawnedPid;
  apiKey = generatedKey;
  status$1 = "starting";
  spawned.onData((data) => {
    logBuffer$1.push(data);
    log.info(`[OpenTerminal:${spawnedPid}] ${data.replace(/[\r\n]+/g, " ").trim()}`);
  });
  spawned.onExit(({ exitCode, signal }) => {
    log.info(`[OpenTerminal:${spawnedPid}] Exited code=${exitCode} signal=${signal}`);
    ptyProcess$1 = null;
    pid$1 = null;
    url$1 = null;
    apiKey = null;
    status$1 = "stopped";
  });
  const serverUrl = `http://${host}:${availablePort}`;
  url$1 = serverUrl;
  status$1 = "started";
  log.info(`Open Terminal started — PID: ${spawnedPid}, URL: ${serverUrl}`);
  return { url: serverUrl, apiKey: generatedKey, pid: spawnedPid };
};
const stopOpenTerminal = async () => {
  if (ptyProcess$1) {
    try {
      ptyProcess$1.kill();
    } catch (e) {
      log.warn("Failed to kill Open Terminal PTY:", e);
    }
    await new Promise((r) => setTimeout(r, 1e3));
    if (pid$1) {
      try {
        process.kill(pid$1, 0);
        process.kill(pid$1, "SIGKILL");
      } catch {
      }
    }
  }
  ptyProcess$1 = null;
  pid$1 = null;
  url$1 = null;
  apiKey = null;
  status$1 = null;
  logBuffer$1 = [];
  lock$1.release();
};
const validateOpenTerminalProcess = () => {
  if (!pid$1) return false;
  if (isProcessAlive(pid$1)) return true;
  pid$1 = null;
  status$1 = null;
  lock$1.release();
  return false;
};
const getHfCacheDir = () => {
  const dir = path__namespace.join(getInstallDir(), "models", "huggingface");
  if (!fs__namespace.existsSync(dir)) {
    fs__namespace.mkdirSync(dir, { recursive: true });
  }
  return dir;
};
const repoSlug = (repo) => repo.replace(/\//g, "--");
const getManifestPath = () => path__namespace.join(getHfCacheDir(), "manifest.json");
const readManifest = () => {
  const p = getManifestPath();
  if (!fs__namespace.existsSync(p)) return [];
  try {
    return JSON.parse(fs__namespace.readFileSync(p, "utf-8"));
  } catch {
    return [];
  }
};
const writeManifest = (models) => {
  fs__namespace.writeFileSync(getManifestPath(), JSON.stringify(models, null, 2));
};
const activeDownloads = /* @__PURE__ */ new Map();
const downloadKey = (repo, filename) => `${repo}/${filename}`;
const cancelDownload = (repo, filename) => {
  if (repo && filename) {
    const key = downloadKey(repo, filename);
    const ctrl = activeDownloads.get(key);
    if (ctrl) {
      ctrl.abort();
      activeDownloads.delete(key);
    }
  } else {
    for (const ctrl of activeDownloads.values()) {
      ctrl.abort();
    }
    activeDownloads.clear();
  }
};
const listModels = () => {
  const manifest = readManifest();
  return manifest.filter((m) => fs__namespace.existsSync(m.filepath));
};
const getModelsDir = () => {
  const dir = path__namespace.join(getInstallDir(), "models");
  if (!fs__namespace.existsSync(dir)) {
    fs__namespace.mkdirSync(dir, { recursive: true });
  }
  return dir;
};
const downloadModel = async (repo, filename, onProgress, token, expectedSize) => {
  const slug = repoSlug(repo);
  const repoDir = path__namespace.join(getHfCacheDir(), slug);
  if (!fs__namespace.existsSync(repoDir)) {
    fs__namespace.mkdirSync(repoDir, { recursive: true });
  }
  const destPath = path__namespace.join(repoDir, filename);
  if (fs__namespace.existsSync(destPath)) {
    log.info(`[huggingface] Already cached: ${destPath}`);
    return destPath;
  }
  const downloadUrl = `https://huggingface.co/${repo}/resolve/main/${encodeURIComponent(filename)}`;
  log.info(`[huggingface] Downloading ${repo}/${filename}`);
  log.info(`[huggingface] URL: ${downloadUrl}`);
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const key = downloadKey(repo, filename);
  activeDownloads.get(key)?.abort();
  const abortController = new AbortController();
  activeDownloads.set(key, abortController);
  const { signal } = abortController;
  const response = await fetch(downloadUrl, {
    headers,
    redirect: "follow",
    signal
  });
  if (!response.ok) {
    throw new Error(
      `Failed to download ${repo}/${filename}: ${response.status} ${response.statusText}`
    );
  }
  const contentLength = parseInt(response.headers.get("content-length") ?? "0", 10);
  const totalBytes = contentLength || expectedSize || 0;
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }
  const tmpPath = destPath + ".tmp";
  const writeStream = fs__namespace.createWriteStream(tmpPath);
  let downloadedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writeStream.write(Buffer.from(value));
      downloadedBytes += value.byteLength;
      if (onProgress && totalBytes > 0) {
        onProgress({
          percent: downloadedBytes / totalBytes * 100,
          downloadedBytes,
          totalBytes
        });
      }
    }
  } catch (err) {
    writeStream.end();
    try {
      fs__namespace.unlinkSync(tmpPath);
    } catch {
    }
    activeDownloads.delete(downloadKey(repo, filename));
    throw err;
  } finally {
    writeStream.end();
    await new Promise((resolve) => writeStream.on("finish", resolve));
  }
  fs__namespace.renameSync(tmpPath, destPath);
  activeDownloads.delete(downloadKey(repo, filename));
  const manifest = readManifest();
  const existing = manifest.findIndex((m) => m.repo === repo && m.filename === filename);
  const entry = {
    repo,
    filename,
    filepath: destPath,
    size: fs__namespace.statSync(destPath).size,
    downloadedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (existing >= 0) {
    manifest[existing] = entry;
  } else {
    manifest.push(entry);
  }
  writeManifest(manifest);
  log.info(`[huggingface] Downloaded: ${destPath} (${entry.size} bytes)`);
  return destPath;
};
const deleteModel = (repo, filename) => {
  const slug = repoSlug(repo);
  const filepath = path__namespace.join(getHfCacheDir(), slug, filename);
  try {
    if (fs__namespace.existsSync(filepath)) {
      fs__namespace.unlinkSync(filepath);
    }
  } catch (e) {
    log.error(`[huggingface] Failed to delete ${filepath}:`, e);
    return false;
  }
  const manifest = readManifest();
  const updated = manifest.filter((m) => !(m.repo === repo && m.filename === filename));
  writeManifest(updated);
  const repoDir = path__namespace.join(getHfCacheDir(), slug);
  try {
    const remaining = fs__namespace.readdirSync(repoDir);
    if (remaining.length === 0) {
      fs__namespace.rmdirSync(repoDir);
    }
  } catch {
  }
  log.info(`[huggingface] Deleted: ${repo}/${filename}`);
  return true;
};
const searchModels = async (query, token) => {
  const params = new URLSearchParams({
    search: query,
    filter: "gguf",
    sort: "downloads",
    direction: "-1",
    limit: "20"
  });
  const headers = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`https://huggingface.co/api/models?${params}`, { headers });
  if (!response.ok) {
    throw new Error(`HF search failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data.map((item) => ({
    id: item.id ?? item.modelId,
    author: item.author ?? item.id?.split("/")[0] ?? "",
    modelId: item.modelId ?? item.id,
    downloads: item.downloads ?? 0,
    likes: item.likes ?? 0,
    tags: item.tags ?? [],
    lastModified: item.lastModified ?? ""
  }));
};
const getRepoFiles = async (repo, token) => {
  const headers = { Accept: "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`https://huggingface.co/api/models/${repo}`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch repo info: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const siblings = data.siblings ?? [];
  return siblings.filter((f) => f.rfilename?.endsWith(".gguf")).map((f) => ({
    filename: f.rfilename,
    size: f.lfs?.size ?? f.size ?? 0
  })).sort((a, b) => a.size - b.size);
};
let ptyProcess = null;
let pid = null;
let url = null;
let status = null;
let logBuffer = [];
const lock = new ServiceLock("llamacpp");
let binaryPath = null;
const getLlamaCppInfo = () => {
  if (!binaryPath) {
    const cacheBase = path__namespace.join(getInstallDir(), "llama.cpp");
    try {
      if (fs__namespace.existsSync(cacheBase)) {
        const dirs = fs__namespace.readdirSync(cacheBase, { withFileTypes: true }).filter((d) => d.isDirectory());
        for (const d of dirs) {
          const found = findBinary(path__namespace.join(cacheBase, d.name));
          if (found) {
            binaryPath = found;
            break;
          }
        }
      }
    } catch {
    }
  }
  let version = null;
  if (binaryPath) {
    const cacheBase = path__namespace.join(getInstallDir(), "llama.cpp");
    const relative = path__namespace.relative(cacheBase, binaryPath);
    const tag = relative.split(path__namespace.sep)[0];
    if (tag) version = tag;
  }
  return { url, status, pid, binaryPath, version };
};
const getLlamaCppPty = () => ptyProcess;
const getLlamaCppLog = () => logBuffer;
const detectBestVariant = () => {
  const platform = process.platform;
  if (platform === "darwin") return "cpu";
  try {
    child_process.execFileSync("nvidia-smi", ["--query-gpu=name", "--format=csv,noheader"], {
      timeout: 5e3,
      stdio: "pipe"
    });
    if (platform === "win32") return "cuda-12.4";
  } catch {
  }
  try {
    if (platform === "win32") {
      child_process.execFileSync("vulkaninfo", ["--summary"], { timeout: 5e3, stdio: "pipe" });
    } else {
      child_process.execFileSync("vulkaninfo", ["--summary"], { timeout: 5e3, stdio: "pipe" });
    }
    return "vulkan";
  } catch {
  }
  if (platform === "linux") {
    try {
      if (fs__namespace.existsSync("/opt/rocm") || fs__namespace.existsSync("/usr/lib/rocm")) {
        return "rocm";
      }
    } catch {
    }
  }
  return "cpu";
};
const resolveVariant = (variant) => {
  if (!variant || variant === "auto") {
    const detected = detectBestVariant();
    log.info(`Auto-detected variant: ${detected}`);
    return detected;
  }
  return variant;
};
const getAssetPattern = (tag, variant) => {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === "darwin") {
    const archStr = arch === "arm64" ? "arm64" : "x64";
    return { pattern: `llama-${tag}-bin-macos-${archStr}.tar.gz`, isZip: false };
  }
  if (platform === "linux") {
    const variantMap = {
      cpu: `llama-${tag}-bin-ubuntu-x64.tar.gz`,
      vulkan: `llama-${tag}-bin-ubuntu-vulkan-x64.tar.gz`,
      rocm: `llama-${tag}-bin-ubuntu-rocm-7.2-x64.tar.gz`
    };
    const name = variantMap[variant] ?? variantMap.cpu;
    return { pattern: name, isZip: false };
  }
  if (platform === "win32") {
    const archStr = arch === "arm64" ? "arm64" : "x64";
    const variantMap = {
      cpu: `llama-${tag}-bin-win-cpu-${archStr}.zip`,
      "cuda-12.4": `llama-${tag}-bin-win-cuda-12.4-x64.zip`,
      "cuda-13.1": `llama-${tag}-bin-win-cuda-13.1-x64.zip`,
      vulkan: `llama-${tag}-bin-win-vulkan-x64.zip`
    };
    const name = variantMap[variant] ?? variantMap.cpu;
    return { pattern: name, isZip: true };
  }
  return { pattern: `llama-${tag}-bin-ubuntu-x64.tar.gz`, isZip: false };
};
const findBinary = (dir) => {
  const exeName = process.platform === "win32" ? "llama-server.exe" : "llama-server";
  const candidates = [
    path__namespace.join(dir, exeName),
    path__namespace.join(dir, "bin", exeName),
    path__namespace.join(dir, "build", "bin", exeName)
  ];
  for (const candidate of candidates) {
    if (fs__namespace.existsSync(candidate)) return candidate;
  }
  try {
    const entries = fs__namespace.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const nested = path__namespace.join(dir, entry.name, exeName);
        if (fs__namespace.existsSync(nested)) return nested;
        const nestedBin = path__namespace.join(dir, entry.name, "bin", exeName);
        if (fs__namespace.existsSync(nestedBin)) return nestedBin;
      }
    }
  } catch {
  }
  return null;
};
const setupLlamaCpp = async (onStatus) => {
  const config = await getConfig();
  const llamaConfig = config.llamaCpp ?? {};
  const version = llamaConfig.version || "latest";
  const variant = resolveVariant(llamaConfig.variant);
  const cacheBase = path__namespace.join(getInstallDir(), "llama.cpp");
  if (!fs__namespace.existsSync(cacheBase)) {
    fs__namespace.mkdirSync(cacheBase, { recursive: true });
  }
  if (version !== "latest") {
    const pinnedDir = path__namespace.join(cacheBase, version);
    const pinnedBinary = fs__namespace.existsSync(pinnedDir) ? findBinary(pinnedDir) : null;
    if (pinnedBinary) {
      log.info(`Using cached llama-server binary (pinned ${version}): ${pinnedBinary}`);
      binaryPath = pinnedBinary;
      onStatus?.("Ready");
      return pinnedBinary;
    }
  } else {
    try {
      const cachedVersions = fs__namespace.readdirSync(cacheBase, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
      for (const cachedTag of cachedVersions) {
        const cachedBinary = findBinary(path__namespace.join(cacheBase, cachedTag));
        if (cachedBinary) {
          log.info(`Found cached llama-server binary (${cachedTag}): ${cachedBinary}`);
          binaryPath = cachedBinary;
          break;
        }
      }
    } catch {
    }
  }
  onStatus?.("Fetching release info…");
  const apiUrl = version === "latest" ? "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest" : `https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/${version}`;
  let releaseData;
  try {
    const response = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.v3+json" },
      signal: AbortSignal.timeout(1e4)
    });
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
    }
    releaseData = await response.json();
  } catch (error) {
    if (binaryPath) {
      log.info("Network unavailable, using cached llama-server binary:", binaryPath);
      onStatus?.("Ready (offline)");
      return binaryPath;
    }
    throw new Error(
      `Failed to fetch release info (no internet?) and no cached llama.cpp binary found. Please connect to the internet for the initial llama.cpp installation. Original error: ${error?.message ?? error}`
    );
  }
  const tag = releaseData.tag_name;
  log.info(`llama.cpp release tag: ${tag}`);
  const versionDir = path__namespace.join(cacheBase, tag);
  if (!fs__namespace.existsSync(versionDir)) {
    fs__namespace.mkdirSync(versionDir, { recursive: true });
  }
  const existingBinary = findBinary(versionDir);
  if (existingBinary) {
    log.info(`llama-server binary already exists: ${existingBinary}`);
    binaryPath = existingBinary;
    return existingBinary;
  }
  const { pattern, isZip } = getAssetPattern(tag, variant);
  const asset = releaseData.assets.find((a) => a.name === pattern);
  if (!asset) {
    const available = releaseData.assets.map((a) => a.name).join(", ");
    throw new Error(`No matching asset found for pattern "${pattern}". Available: ${available}`);
  }
  log.info(`Downloading asset: ${asset.name}`);
  onStatus?.(`Downloading ${asset.name}…`);
  const downloadPath = path__namespace.join(versionDir, asset.name);
  if (!fs__namespace.existsSync(downloadPath)) {
    await downloadFileWithProgress(asset.browser_download_url, downloadPath, (progress) => {
      onStatus?.(`Downloading… ${progress.toFixed(0)}%`);
    });
  }
  onStatus?.("Extracting…");
  log.info(`Extracting ${downloadPath} to ${versionDir}`);
  if (isZip) {
    try {
      if (process.platform === "win32") {
        child_process.execFileSync("powershell", [
          "-Command",
          `Expand-Archive -Path "${downloadPath}" -DestinationPath "${versionDir}" -Force`
        ]);
      } else {
        child_process.execFileSync("unzip", ["-o", downloadPath, "-d", versionDir]);
      }
    } catch (error) {
      throw new Error(`Failed to extract zip: ${error?.message ?? error}`);
    }
  } else {
    await tar__namespace.x({ cwd: versionDir, file: downloadPath });
  }
  try {
    fs__namespace.unlinkSync(downloadPath);
  } catch {
  }
  if (process.platform !== "win32") {
    const binary = findBinary(versionDir);
    if (binary) {
      try {
        fs__namespace.chmodSync(binary, 493);
      } catch {
      }
    }
  }
  const resultBinary = findBinary(versionDir);
  if (!resultBinary) {
    throw new Error(`llama-server binary not found after extraction in ${versionDir}`);
  }
  log.info(`llama-server binary ready: ${resultBinary}`);
  binaryPath = resultBinary;
  onStatus?.("Ready");
  return resultBinary;
};
const checkLlamaCppUpdate = async () => {
  const currentInfo = getLlamaCppInfo();
  try {
    const response = await fetch(
      "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest",
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        signal: AbortSignal.timeout(5e3)
      }
    );
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
    }
    const releaseData = await response.json();
    const latestVersion = releaseData.tag_name;
    const currentVersion = currentInfo.version;
    if (!currentVersion) {
      return { currentVersion: null, latestVersion, updateAvailable: true };
    }
    return {
      currentVersion,
      latestVersion,
      updateAvailable: currentVersion !== latestVersion
    };
  } catch (error) {
    log.error("Failed to check for llama.cpp updates:", error);
    return {
      currentVersion: currentInfo.version,
      latestVersion: null,
      updateAvailable: false
    };
  }
};
const updateLlamaCpp = async (onStatus) => {
  onStatus?.("Checking for updates…");
  let releaseTag;
  try {
    const response = await fetch(
      "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest",
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        signal: AbortSignal.timeout(1e4)
      }
    );
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    releaseTag = data.tag_name;
  } catch (error) {
    throw new Error(
      `Cannot update llama.cpp: unable to reach GitHub. Please check your internet connection. (${error?.message ?? error})`
    );
  }
  await stopLlamaCpp();
  const currentInfo = getLlamaCppInfo();
  if (currentInfo.version) {
    const cacheDir = path__namespace.join(getInstallDir(), "llama.cpp", currentInfo.version);
    if (fs__namespace.existsSync(cacheDir)) {
      onStatus?.("Removing old version…");
      try {
        fs__namespace.rmSync(cacheDir, { recursive: true, force: true });
      } catch (err) {
        log.error(`Failed to remove old llama.cpp cache at ${cacheDir}:`, err);
      }
    }
  }
  const config = await getConfig();
  await setConfig({ llamaCpp: { ...config.llamaCpp, version: "latest" } });
  onStatus?.("Downloading update…");
  await setupLlamaCpp(onStatus);
  return getLlamaCppInfo();
};
const startLlamaCpp = async (onStatus) => {
  if (!lock.acquire()) {
    return { url, pid };
  }
  await stopLlamaCpp();
  status = "setting-up";
  onStatus?.("Setting up llama.cpp…");
  const binary = await setupLlamaCpp(onStatus);
  status = "starting";
  onStatus?.("Starting llama-server…");
  const config = await getConfig();
  const llamaConfig = config.llamaCpp ?? {};
  const host = "127.0.0.1";
  let desiredPort = llamaConfig.port || 18881;
  let availablePort = desiredPort;
  while (await portInUse(availablePort, host)) {
    availablePort++;
    if (availablePort > desiredPort + 100) {
      throw new Error("No available port found for llama-server");
    }
  }
  const extraArgs = llamaConfig.extraArgs ?? [];
  const modelsDir = getModelsDir();
  const commandArgs = [
    "--host",
    host,
    "--port",
    availablePort.toString(),
    "--models-dir",
    modelsDir,
    ...extraArgs
  ];
  log.info("Starting llama-server:", binary, commandArgs.join(" "));
  let spawned;
  try {
    spawned = pty__namespace.spawn(binary, commandArgs, {
      name: "xterm-256color",
      cols: 200,
      rows: 50,
      env: {
        ...process.env,
        ...config.envVars ?? {}
      }
    });
  } catch (error) {
    status = "failed";
    throw new Error(`Failed to spawn llama-server: ${error?.message ?? error}`);
  }
  const spawnedPid = spawned.pid;
  logBuffer = [];
  ptyProcess = spawned;
  pid = spawnedPid;
  spawned.onData((data) => {
    logBuffer.push(data);
    log.info(`[llamacpp:${spawnedPid}] ${data.replace(/[\r\n]+/g, " ").trim()}`);
  });
  spawned.onExit(({ exitCode, signal }) => {
    log.info(`[llamacpp:${spawnedPid}] Exited code=${exitCode} signal=${signal}`);
    const exitMsg = `\r
[Process exited with code ${exitCode}${signal ? ` signal ${signal}` : ""}]\r
`;
    logBuffer.push(exitMsg);
    ptyProcess = null;
    pid = null;
    url = null;
    status = "stopped";
  });
  const serverUrl = `http://${host}:${availablePort}`;
  const maxAttempts = 30;
  let ready = false;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1e3));
    try {
      const resp = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(2e3) });
      if (resp.ok) {
        const body = await resp.json();
        if (body.status === "ok" || body.status === "no slot available") {
          ready = true;
          break;
        }
      }
    } catch {
    }
  }
  if (!ready) {
    log.warn("llama-server did not report healthy within 30s, continuing anyway");
  }
  url = serverUrl;
  status = "started";
  log.info(`llama-server started — PID: ${spawnedPid}, URL: ${serverUrl}`);
  return { url: serverUrl, pid: spawnedPid };
};
const stopLlamaCpp = async () => {
  if (ptyProcess) {
    try {
      ptyProcess.kill();
    } catch (e) {
      log.warn("Failed to kill llama-server PTY:", e);
    }
    await new Promise((r) => setTimeout(r, 2e3));
    if (pid) {
      try {
        process.kill(pid, 0);
        process.kill(pid, "SIGKILL");
      } catch {
      }
    }
  }
  ptyProcess = null;
  pid = null;
  url = null;
  status = null;
  logBuffer = [];
  lock.release();
};
const validateLlamaCppProcess = () => {
  if (!pid) return false;
  if (isProcessAlive(pid)) return true;
  pid = null;
  status = null;
  lock.release();
  return false;
};
const uninstallLlamaCpp = async () => {
  await stopLlamaCpp();
  const cacheBase = path__namespace.join(getInstallDir(), "llama.cpp");
  if (fs__namespace.existsSync(cacheBase)) {
    fs__namespace.rmSync(cacheBase, { recursive: true, force: true });
    log.info("Removed llama.cpp directory:", cacheBase);
  }
  binaryPath = null;
};
let mainWin = null;
const send = (type, data) => {
  mainWin?.webContents.send("main:data", { type, data });
};
function initUpdater(window) {
  mainWin = window;
  electronUpdater.autoUpdater.logger = log;
  electronUpdater.autoUpdater.autoDownload = false;
  electronUpdater.autoUpdater.autoInstallOnAppQuit = true;
  const updateProvider = APP_PROFILE.updates.provider;
  if (updateProvider === "generic" && APP_PROFILE.updates.url) {
    electronUpdater.autoUpdater.setFeedURL({
      provider: "generic",
      url: APP_PROFILE.updates.url
    });
  } else if (updateProvider === "github") {
    electronUpdater.autoUpdater.setFeedURL({
      provider: "github",
      owner: APP_PROFILE.updates.owner,
      repo: APP_PROFILE.updates.repo
    });
  }
  electronUpdater.autoUpdater.on("checking-for-update", () => {
    send("update:checking");
  });
  electronUpdater.autoUpdater.on("update-available", (info) => {
    send("update:available", {
      version: info.version,
      releaseDate: info.releaseDate
    });
  });
  electronUpdater.autoUpdater.on("update-not-available", (_info) => {
    send("update:not-available");
  });
  electronUpdater.autoUpdater.on("download-progress", (progress) => {
    send("update:download-progress", {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    });
  });
  electronUpdater.autoUpdater.on("update-downloaded", (_info) => {
    send("update:downloaded");
  });
  electronUpdater.autoUpdater.on("error", (error) => {
    send("update:error", { message: error?.message ?? "Update error" });
  });
  if (electron.app.isPackaged) {
    electronUpdater.autoUpdater.checkForUpdates().catch((err) => {
      log.warn("Auto update check failed:", err);
    });
  }
}
async function checkForUpdates() {
  if (!electron.app.isPackaged) {
    log.info("Skipping update check — app is not packaged");
    send("update:not-available");
    return;
  }
  await electronUpdater.autoUpdater.checkForUpdates();
}
async function downloadUpdate() {
  await electronUpdater.autoUpdater.downloadUpdate();
}
function installUpdate() {
  electronUpdater.autoUpdater.quitAndInstall(false, true);
}
const icon = path.join(__dirname, "../../resources/icon.png");
const dockIcon = path.join(__dirname, "../../resources/dock-icon.png");
log.transports.file.resolvePathFn = () => getLogFilePath("main");
if (process.platform === "linux") {
  electron.app.commandLine.appendSwitch("no-sandbox");
  electron.app.commandLine.appendSwitch("disable-dev-shm-usage");
  electron.app.commandLine.appendSwitch("ozone-platform-hint", "auto");
  electron.app.commandLine.appendSwitch("disable-gpu");
}
const gpuCrashMarkerPath = path.join(electron.app.getPath("userData"), ".gpu-sandbox-disabled");
const gpuSandboxDisabled = fs.existsSync(gpuCrashMarkerPath);
const BRAND = APP_PROFILE.brand;
const FEATURES = APP_PROFILE.features;
const DESKTOP_PROTOCOL = "spal";
const DESKTOP_MAGIC_AUTH_HOST = "auth";
const REMOTE_PERMISSION_ALLOWLIST = /* @__PURE__ */ new Set([
  ...APP_PROFILE.remotePermissions.allowed,
  ...FEATURES.allowRemotePasskeys ? ["publickey-credentials-create", "publickey-credentials-get"] : []
]);
const isRemotePermissionAllowed = (permission) => {
  return REMOTE_PERMISSION_ALLOWLIST.has(permission);
};
const isOriginAllowedInWebview = (targetUrl, currentUrl) => {
  try {
    const target = new URL(targetUrl);
    if (!currentUrl) return true;
    const current = new URL(currentUrl);
    if (target.origin === current.origin) return true;
    if (!APP_PROFILE.auth.allowExternalAuthOriginsInWebview) ;
    return APP_PROFILE.auth.allowedAuthOrigins.some((origin) => origin === target.origin);
  } catch {
    return false;
  }
};
if (gpuSandboxDisabled) {
  log.info("GPU sandbox disabled due to previous GPU process crash");
  electron.app.commandLine.appendSwitch("disable-gpu-sandbox");
}
electron.app.disableDomainBlockingFor3DAPIs();
let mainWindow = null;
const detachedContentWindows = /* @__PURE__ */ new Set();
let spotlightWindow = null;
let voiceInputWindow = null;
let tray = null;
let isQuiting = false;
let CONFIG = null;
let SERVER_URL = null;
let SERVER_STATUS = null;
let SERVER_REACHABLE = false;
let SERVER_PID = null;
let AUTH_TOKEN = null;
let voiceInputRecording = false;
let pendingProtocolUrl = null;
function isGlobalShortcutSupported() {
  if (process.platform !== "linux") return true;
  return true;
}
function tryRegisterShortcut(accel, label, callback, silent = false) {
  try {
    const ok = electron.globalShortcut.register(accel, callback);
    if (ok) {
      log.info(`${label} shortcut "${accel}" registered`);
      return true;
    }
    log.warn(`${label} shortcut "${accel}" could not be registered (returned false)`);
    if (!silent) {
      new electron.Notification({
        title: label,
        body: `Could not register shortcut "${accel}". It may be in use by another application.`
      }).show();
    }
    return false;
  } catch (error) {
    log.warn(`${label} shortcut "${accel}" registration threw:`, error);
    if (!silent) {
      new electron.Notification({
        title: label,
        body: `Failed to register shortcut "${accel}". It may conflict with another application.`
      }).show();
    }
    return false;
  }
}
const registerShortcuts = (globalAccel, spotlightAccel, voiceInputAccel, callAccel) => {
  electron.globalShortcut.unregisterAll();
  if (!isGlobalShortcutSupported()) {
    log.info(
      `Global shortcut registration skipped — unsupported environment (XDG_SESSION_TYPE=${process.env["XDG_SESSION_TYPE"] ?? "(unset)"}, FLATPAK_ID=${process.env["FLATPAK_ID"] ?? "(unset)"})`
    );
    return;
  }
  if (globalAccel) {
    tryRegisterShortcut(globalAccel, BRAND.name, () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createMainWindow();
      }
    });
  }
  if (spotlightAccel) {
    tryRegisterShortcut(spotlightAccel, "Spotlight", () => {
      const text = CONFIG?.spotlightClipboardPaste !== false ? electron.clipboard.readText()?.trim() || "" : "";
      toggleSpotlight(text);
    });
  }
  if (voiceInputAccel && CONFIG?.voiceInputEnabled !== false) {
    tryRegisterShortcut(voiceInputAccel, "Voice Input", () => {
      toggleVoiceInput();
    });
  } else {
    log.info(
      `Voice input shortcut skipped — accel="${voiceInputAccel}", enabled=${CONFIG?.voiceInputEnabled}`
    );
  }
  if (callAccel && CONFIG?.callEnabled !== false) {
    tryRegisterShortcut(callAccel, "Call", () => {
      toggleCall();
    });
  } else {
    log.info(`Call shortcut skipped — accel="${callAccel}", enabled=${CONFIG?.callEnabled}`);
  }
};
let spotlightBarOffset = null;
function loadSpotlightPosition() {
  if (CONFIG?.spotlightPosition) {
    spotlightBarOffset = { ...CONFIG.spotlightPosition };
  }
}
function createSpotlightWindow() {
  const { screen } = require("electron");
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { x: sx, y: sy, width: sw, height: sh } = activeDisplay.bounds;
  spotlightWindow = new electron.BrowserWindow({
    x: sx,
    y: sy,
    width: sw,
    height: sh,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    focusable: true,
    icon: path.join(__dirname, "assets/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/spotlight-preload.js"),
      sandbox: false,
      webviewTag: false
    }
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    spotlightWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/spotlight.html`);
  } else {
    spotlightWindow.loadFile(path.join(__dirname, "../renderer/spotlight.html"));
  }
  let blurArmed = false;
  spotlightWindow.on("focus", () => {
    blurArmed = false;
    setTimeout(() => {
      blurArmed = true;
    }, 200);
  });
  spotlightWindow.on("blur", () => {
    if (blurArmed) {
      spotlightWindow?.hide();
    }
  });
  spotlightWindow.on("closed", () => {
    spotlightWindow = null;
  });
  return spotlightWindow;
}
function showAndFocusSpotlight(win, initialQuery) {
  if (process.platform === "darwin") {
    electron.app.focus({ steal: true });
  }
  const { screen } = require("electron");
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { x: sx, y: sy, width: sw, height: sh } = activeDisplay.bounds;
  win.setBounds({ x: sx, y: sy, width: sw, height: sh });
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    mainWindow.hide();
  }
  win.show();
  win.focus();
  win.webContents.focus();
  win.webContents.send("spotlight:init", {
    barOffset: spotlightBarOffset,
    screenSize: { width: sw, height: sh },
    query: initialQuery || ""
  });
}
function toggleSpotlight(selectedText) {
  if (spotlightWindow && !spotlightWindow.isDestroyed()) {
    if (spotlightWindow.isVisible()) {
      spotlightWindow.hide();
    } else {
      showAndFocusSpotlight(spotlightWindow, selectedText);
    }
  } else {
    const win = createSpotlightWindow();
    win.once("ready-to-show", () => {
      showAndFocusSpotlight(win, selectedText);
    });
  }
}
function createVoiceInputWindow() {
  const { screen } = require("electron");
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { x: sx, y: sy, width: sw } = activeDisplay.bounds;
  const winW = 340;
  const winH = 72;
  voiceInputWindow = new electron.BrowserWindow({
    x: sx + Math.round((sw - winW) / 2),
    y: sy + 120,
    width: winW,
    height: winH,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    focusable: true,
    icon: path.join(__dirname, "assets/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/voice-input-preload.js"),
      sandbox: false,
      webviewTag: false,
      autoplayPolicy: "no-user-gesture-required"
    }
  });
  voiceInputWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === "media");
    }
  );
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    voiceInputWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/voice-input.html`);
  } else {
    voiceInputWindow.loadFile(path.join(__dirname, "../renderer/voice-input.html"));
  }
  voiceInputWindow.on("closed", () => {
    voiceInputWindow = null;
    voiceInputRecording = false;
  });
  return voiceInputWindow;
}
function playChime(ascending) {
  return new Promise((resolve) => {
    const { execFile } = require("child_process");
    const fs2 = require("fs");
    const file = ascending ? "chime-start.wav" : "chime-stop.wav";
    const soundPath = electron.app.isPackaged ? path.join(process.resourcesPath, "app.asar.unpacked", "resources", "sounds", file) : path.join(electron.app.getAppPath(), "resources", "sounds", file);
    const exists = fs2.existsSync(soundPath);
    log.info(`playChime: ${ascending ? "start" : "stop"}, path=${soundPath}, exists=${exists}`);
    if (!exists) {
      resolve();
      return;
    }
    if (process.platform === "darwin") {
      execFile("afplay", [soundPath], (err, stdout, stderr) => {
        if (err) log.warn("afplay error:", err.message, stderr);
        resolve();
      });
    } else if (process.platform === "win32") {
      execFile(
        "powershell",
        ["-NoProfile", "-Command", `(New-Object Media.SoundPlayer '${soundPath}').PlaySync()`],
        () => resolve()
      );
    } else {
      execFile("paplay", [soundPath], (err) => {
        if (err) execFile("aplay", [soundPath], () => resolve());
        else resolve();
      });
    }
  });
}
async function toggleVoiceInput() {
  if (voiceInputRecording) {
    voiceInputRecording = false;
    if (voiceInputWindow && !voiceInputWindow.isDestroyed()) {
      voiceInputWindow.webContents.send("voiceInput:state", { recording: false });
    }
    return;
  }
  if (process.platform === "darwin") {
    const micStatus = electron.systemPreferences.getMediaAccessStatus("microphone");
    if (micStatus !== "granted") {
      const granted = await electron.systemPreferences.askForMediaAccess("microphone");
      if (!granted) {
        log.warn("Voice input: microphone permission denied");
        new electron.Notification({
          title: "Voice Input",
          body: "Microphone access denied. Enable it in System Settings → Privacy & Security → Microphone, then restart the app."
        }).show();
        return;
      }
    }
  }
  try {
    const config = await getConfig();
    if (!config.defaultConnectionId || config.connections.length === 0) {
      log.warn("Voice input: no connection configured");
      new electron.Notification({
        title: "Voice Input",
        body: "No connection configured. Set up a connection in Settings before using voice input."
      }).show();
      return;
    }
    const conn = config.connections.find((c) => c.id === config.defaultConnectionId);
    if (!conn) {
      log.warn("Voice input: default connection not found");
      new electron.Notification({
        title: "Voice Input",
        body: "Default connection not found. Check your connection settings."
      }).show();
      return;
    }
  } catch (err) {
    log.warn("Voice input: config check failed:", err);
  }
  voiceInputRecording = true;
  playChime(true);
  if (voiceInputWindow && !voiceInputWindow.isDestroyed()) {
    voiceInputWindow.show();
    voiceInputWindow.focus();
    voiceInputWindow.webContents.send("voiceInput:state", { recording: true });
  } else {
    const win = createVoiceInputWindow();
    win.once("ready-to-show", () => {
      win.show();
      win.focus();
      setTimeout(() => {
        win.webContents.send("voiceInput:state", { recording: true });
      }, 100);
    });
  }
}
async function toggleCall() {
  try {
    const config = await getConfig();
    if (!config.defaultConnectionId || config.connections.length === 0) {
      log.warn("Call: no connection configured");
      new electron.Notification({
        title: "Call",
        body: "No connection configured. Set up a connection in Settings before using the call shortcut."
      }).show();
      return;
    }
    const conn = config.connections.find((c) => c.id === config.defaultConnectionId);
    if (!conn) {
      log.warn("Call: default connection not found");
      new electron.Notification({
        title: "Call",
        body: "Default connection not found. Check your connection settings."
      }).show();
      return;
    }
    let url2 = conn.url;
    if (conn.type === "local" && SERVER_URL) {
      url2 = SERVER_URL;
    }
    if (url2.startsWith("http://0.0.0.0")) {
      url2 = url2.replace("http://0.0.0.0", "http://localhost");
    }
    sendToRenderer("call", { connectionId: conn.id, url: url2 });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  } catch (err) {
    log.warn("Call: config check failed:", err);
  }
}
const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 800;
const MIN_WINDOW_WIDTH = 480;
const MIN_WINDOW_HEIGHT = 360;
const BOUNDS_SAVE_DEBOUNCE_MS = 500;
const MIN_VISIBLE_OVERLAP_PX = 100;
let lastNormalBounds = null;
let boundsDebounceTimer = null;
function debounceSaveWindowBounds(win) {
  if (boundsDebounceTimer) clearTimeout(boundsDebounceTimer);
  boundsDebounceTimer = setTimeout(() => {
    if (win.isDestroyed()) return;
    const maximized = win.isMaximized();
    const bounds = maximized ? lastNormalBounds ?? win.getNormalBounds() : win.getBounds();
    setConfig({ windowBounds: bounds, windowMaximized: maximized }).catch(
      (err) => log.warn("Failed to save window bounds:", err)
    );
  }, BOUNDS_SAVE_DEBOUNCE_MS);
}
function isBoundsOnVisibleDisplay(bounds) {
  const { screen } = require("electron");
  const targetPoint = {
    x: bounds.x + MIN_VISIBLE_OVERLAP_PX / 2,
    y: bounds.y + MIN_VISIBLE_OVERLAP_PX / 2
  };
  const display = screen.getDisplayNearestPoint(targetPoint);
  const { x, y, width, height } = display.workArea;
  return bounds.x + MIN_VISIBLE_OVERLAP_PX > x && bounds.x < x + width && bounds.y + MIN_VISIBLE_OVERLAP_PX > y && bounds.y < y + height;
}
function trackNormalBounds(win) {
  if (!win.isDestroyed() && !win.isMaximized()) {
    lastNormalBounds = win.getBounds();
  }
}
function applyGlassEffect(win, enabled) {
  if (win.isDestroyed()) return;
  if (process.platform === "darwin") {
    win.setVibrancy(enabled ? "under-window" : null);
    win.setVisualEffectState(enabled ? "active" : "inactive");
  }
  if (process.platform === "win32") {
    const anyWin = win;
    anyWin.setBackgroundMaterial?.(enabled ? "acrylic" : "none");
  }
  win.setBackgroundColor(enabled ? "#00000000" : "#f5f5f7");
}
function createMainWindow(show = true) {
  const saved = CONFIG?.windowBounds;
  const glassEnabled = CONFIG?.glassEffect !== false;
  const windowOpts = {
    width: saved?.width ?? DEFAULT_WINDOW_WIDTH,
    height: saved?.height ?? DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: BRAND.name,
    icon: path.join(__dirname, "assets/icon.png"),
    show: false,
    titleBarStyle: process.platform === "win32" ? "default" : "hidden",
    trafficLightPosition: { x: 10, y: 10 },
    autoHideMenuBar: true,
    backgroundColor: glassEnabled ? "#00000000" : "#f5f5f7",
    transparent: glassEnabled,
    ...process.platform === "darwin" && glassEnabled ? { vibrancy: "under-window", visualEffectState: "active" } : {},
    ...process.platform === "win32" && glassEnabled ? { backgroundMaterial: "acrylic" } : {},
    ...process.platform === "win32" ? { frame: true } : {},
    ...process.platform === "linux" ? { icon } : {},
    ...process.platform !== "darwin" ? { titleBarOverlay: true } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      webviewTag: true
    }
  };
  if (saved?.x != null && saved?.y != null && isBoundsOnVisibleDisplay(saved)) {
    windowOpts.x = saved.x;
    windowOpts.y = saved.y;
  }
  mainWindow = new electron.BrowserWindow(windowOpts);
  applyGlassEffect(mainWindow, glassEnabled);
  if (process.platform !== "darwin") {
    mainWindow.setIcon(icon);
  }
  mainWindow.on("page-title-updated", (event) => {
    event.preventDefault();
    mainWindow?.setTitle(BRAND.name);
  });
  mainWindow.setTitle(BRAND.name);
  if (CONFIG?.windowMaximized) {
    mainWindow.maximize();
  }
  if (!electron.app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
  if (show) {
    mainWindow.on("ready-to-show", () => {
      mainWindow?.show();
    });
  }
  mainWindow.webContents.setWindowOpenHandler((details) => {
    openUrl(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  const onBoundsChanged = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    trackNormalBounds(mainWindow);
    debounceSaveWindowBounds(mainWindow);
  };
  mainWindow.on("resize", onBoundsChanged);
  mainWindow.on("move", onBoundsChanged);
  mainWindow.on("maximize", onBoundsChanged);
  mainWindow.on("unmaximize", onBoundsChanged);
  mainWindow.on("close", (event) => {
    if (!isQuiting) {
      if (CONFIG?.runInBackground === false) {
        isQuiting = true;
        electron.app.quit();
      } else {
        event.preventDefault();
        mainWindow?.hide();
      }
    }
  });
}
function createContentWindow(url2, connectionId, title = BRAND.name) {
  const contentWindow = new electron.BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    icon: path.join(__dirname, "assets/icon.png"),
    show: false,
    title,
    titleBarStyle: process.platform === "win32" ? "default" : "hidden",
    trafficLightPosition: { x: 16, y: 16 },
    autoHideMenuBar: true,
    ...process.platform === "win32" ? { frame: true } : {},
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      partition: `persist:connection-${connectionId}`
    }
  });
  electron.session.fromPartition(`persist:connection-${connectionId}`).setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowedPermissions = Array.from(REMOTE_PERMISSION_ALLOWLIST);
    callback(allowedPermissions.includes(permission));
  });
  electron.session.fromPartition(`persist:connection-${connectionId}`).setPermissionCheckHandler((_webContents, permission) => {
    return isRemotePermissionAllowed(permission);
  });
  contentWindow.on("ready-to-show", () => {
    contentWindow.show();
  });
  contentWindow.on("page-title-updated", (_event, nextTitle) => {
    if (nextTitle) contentWindow.setTitle(nextTitle);
  });
  contentWindow.webContents.setWindowOpenHandler((details) => {
    if (isOriginAllowedInWebview(details.url, contentWindow?.webContents.getURL())) {
      return { action: "allow" };
    }
    openUrl(details.url);
    return { action: "deny" };
  });
  contentWindow.loadURL(url2);
  contentWindow.on("close", (event) => {
    if (!isQuiting && CONFIG?.runInBackground === false) {
      const visibleAppWindows = electron.BrowserWindow.getAllWindows().filter(
        (win) => !win.isDestroyed() && win !== contentWindow
      );
      if (visibleAppWindows.length === 0) {
        isQuiting = true;
        electron.app.quit();
      }
    }
  });
  contentWindow.on("closed", () => {
    detachedContentWindows.delete(contentWindow);
  });
  detachedContentWindows.add(contentWindow);
  return contentWindow;
}
const updateTray = () => {
  if (!tray || !CONFIG) return;
  const connectionItems = (CONFIG.connections || []).map((conn) => ({
    label: `${conn.id === CONFIG.defaultConnectionId ? "★ " : ""}${conn.name}`,
    sublabel: conn.url,
    click: async () => {
      const result = await connectTo(conn);
      if (result) sendToRenderer("connection:open", result);
    }
  }));
  const trayMenuTemplate = [
    {
      label: `Show ${BRAND.name}`,
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    { type: "separator" },
    ...connectionItems.length > 0 ? [{ label: "Connections", enabled: false }, ...connectionItems, { type: "separator" }] : [],
    ...SERVER_STATUS === "started" && SERVER_URL ? [
      {
        label: `Local: ${SERVER_URL}`,
        click: () => {
          if (SERVER_URL) electron.clipboard.writeText(SERVER_URL);
        }
      },
      { type: "separator" }
    ] : [],
    {
      label: `Quit ${BRAND.name}`,
      accelerator: "CommandOrControl+Q",
      click: async () => {
        await stopServerHandler();
        isQuiting = true;
        electron.app.quit();
      }
    }
  ];
  const trayMenu = electron.Menu.buildFromTemplate(trayMenuTemplate);
  tray?.setContextMenu(trayMenu);
};
const connectTo = async (connection) => {
  let url2 = connection.url;
  if (connection.type === "local") {
    if (!FEATURES.allowLocalOpenWebUIInstall) {
      log.warn("connectTo: local connection blocked by build profile");
      return null;
    }
    if (SERVER_STATUS !== "started") {
      const started = await startServerHandler();
      if (!started) return null;
    }
    url2 = SERVER_URL || connection.url;
    if (!SERVER_REACHABLE) {
      const maxWait = 12e4;
      const poll = 2e3;
      const t0 = Date.now();
      while (!SERVER_REACHABLE && Date.now() - t0 < maxWait) {
        await new Promise((r) => setTimeout(r, poll));
      }
      if (!SERVER_REACHABLE) {
        log.warn("connectTo: server did not become reachable within timeout");
        return null;
      }
    }
  }
  if (url2.startsWith("http://0.0.0.0")) {
    url2 = url2.replace("http://0.0.0.0", "http://localhost");
  }
  return { url: url2, connectionId: connection.id };
};
const startServerHandler = async () => {
  if (!FEATURES.allowLocalOpenWebUIInstall) {
    log.warn("[server] Local server start blocked by build profile");
    sendToRenderer("error", { message: localInstallDisabledError().message });
    return false;
  }
  if (SERVER_STATUS === "starting" || SERVER_STATUS === "started") {
    log.info("[server] Already running or starting, skipping duplicate start");
    return true;
  }
  await stopServerHandler();
  SERVER_STATUS = "starting";
  sendToRenderer("status:server", SERVER_STATUS);
  try {
    CONFIG = await getConfig();
    const { url: url2, pid: pid2 } = await startServer(
      CONFIG?.localServer?.serveOnLocalNetwork ?? false,
      CONFIG?.localServer?.port ?? null
    );
    SERVER_URL = url2;
    SERVER_PID = pid2;
    SERVER_STATUS = "started";
    log.info("Server started:", SERVER_URL, SERVER_PID);
    sendToRenderer("status:server", SERVER_STATUS);
    connectPtyPort(pid2);
    updateTray();
    checkUrlAndOpen(SERVER_URL, async () => {
      SERVER_REACHABLE = true;
      sendToRenderer("server:ready", { url: SERVER_URL });
      updateTray();
    });
    return true;
  } catch (error) {
    log.error("Failed to start server:", error);
    SERVER_STATUS = "failed";
    sendToRenderer("status:server", SERVER_STATUS);
    sendToRenderer("error", { message: `Failed to start server: ${error?.message}` });
    updateTray();
    return false;
  }
};
const activePtyDisposables = /* @__PURE__ */ new Map();
const connectPtyPort = (pid2) => {
  const targetPid = pid2 ?? SERVER_PID;
  if (!mainWindow) return;
  const { port1, port2 } = new electron.MessageChannelMain();
  if (!targetPid) {
    if (SERVER_STATUS === "starting") {
      log.info("pty:connect — server is starting, no PID yet");
    } else {
      log.info("pty:connect — no active server");
      port1.postMessage({ type: "output", data: "[No active server process]\r\n" });
    }
    mainWindow.webContents.postMessage("pty:port", { pid: 0 }, [port2]);
    return;
  }
  activePtyDisposables.get(targetPid)?.dispose();
  activePtyDisposables.delete(targetPid);
  const ptyProcess2 = getServerPty(targetPid);
  log.info(`pty:connect — PID ${targetPid}, pty exists: ${!!ptyProcess2}`);
  const buffer = getServerLog(targetPid);
  if (buffer?.length) {
    for (const chunk of buffer) {
      port1.postMessage({ type: "output", data: chunk });
    }
  }
  if (ptyProcess2) {
    const disposable = ptyProcess2.onData((data) => {
      port1.postMessage({ type: "output", data });
    });
    activePtyDisposables.set(targetPid, disposable);
    port1.on("message", (event) => {
      const msg = event.data;
      if (msg.type === "input") {
        ptyProcess2.write(msg.data);
      } else if (msg.type === "resize") {
        ptyProcess2.resize(msg.cols, msg.rows);
      }
    });
    port1.start();
  }
  mainWindow.webContents.postMessage("pty:port", { pid: targetPid }, [port2]);
};
let activeOpenTerminalDisposable = null;
const connectOpenTerminalPtyPort = () => {
  if (!mainWindow) return;
  const { port1, port2 } = new electron.MessageChannelMain();
  const otPty = getOpenTerminalPty();
  if (!otPty) {
    port1.postMessage({ type: "output", data: "[Open Terminal is not running]\r\n" });
    mainWindow.webContents.postMessage("open-terminal:pty:port", null, [port2]);
    return;
  }
  activeOpenTerminalDisposable?.dispose();
  const buffer = getOpenTerminalLog();
  for (const chunk of buffer) {
    port1.postMessage({ type: "output", data: chunk });
  }
  const disposable = otPty.onData((data) => {
    port1.postMessage({ type: "output", data });
  });
  activeOpenTerminalDisposable = disposable;
  port1.start();
  mainWindow.webContents.postMessage("open-terminal:pty:port", null, [port2]);
};
let activeLlamaCppDisposable = null;
const connectLlamaCppPtyPort = () => {
  if (!mainWindow) return;
  const { port1, port2 } = new electron.MessageChannelMain();
  const lsPty = getLlamaCppPty();
  if (!lsPty) {
    port1.postMessage({ type: "output", data: "[llamacpp is not running]\r\n" });
    mainWindow.webContents.postMessage("llamacpp:pty:port", null, [port2]);
    return;
  }
  activeLlamaCppDisposable?.dispose();
  const buffer = getLlamaCppLog();
  for (const chunk of buffer) {
    port1.postMessage({ type: "output", data: chunk });
  }
  const disposable = lsPty.onData((data) => {
    port1.postMessage({ type: "output", data });
  });
  activeLlamaCppDisposable = disposable;
  port1.start();
  mainWindow.webContents.postMessage("llamacpp:pty:port", null, [port2]);
};
const stopServerHandler = async () => {
  try {
    await stopAllServers();
    if (SERVER_STATUS) {
      SERVER_STATUS = "stopped";
      updateTray();
    }
    SERVER_REACHABLE = false;
    SERVER_URL = null;
    sendToRenderer("status:server", SERVER_STATUS);
    return true;
  } catch (error) {
    log.error("Failed to stop server:", error);
    return false;
  }
};
const resetAppHandler = async () => {
  try {
    await stopServerHandler();
    SERVER_STATUS = null;
    try {
      await stopOpenTerminal();
      sendToRenderer("status:open-terminal", null);
    } catch (e) {
      log.warn("Failed to stop Open Terminal during reset:", e);
    }
    try {
      await uninstallLlamaCpp();
      sendToRenderer("status:llamacpp", null);
    } catch (e) {
      log.warn("Failed to uninstall llama.cpp during reset:", e);
    }
    try {
      if (fs.existsSync(gpuCrashMarkerPath)) {
        fs.unlinkSync(gpuCrashMarkerPath);
        log.info("GPU crash marker removed during reset");
      }
    } catch (e) {
      log.warn("Failed to remove GPU crash marker during reset:", e);
    }
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    await resetApp();
    CONFIG = await getConfig();
    new electron.Notification({ title: BRAND.name, body: "Application has been reset." }).show();
  } catch (error) {
    log.error("Failed to reset:", error);
    new electron.Notification({ title: BRAND.name, body: `Reset failed: ${error.message}` }).show();
  }
};
const sendToRenderer = (type, data) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const send2 = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send("main:data", { type, data });
  };
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once("did-finish-load", send2);
  } else {
    send2();
  }
};
const getResolvedSystemTheme = () => electron.nativeTheme.shouldUseDarkColors ? "dark" : "light";
const broadcastSystemTheme = () => {
  sendToRenderer("theme:system-update", { theme: getResolvedSystemTheme() });
};
const localInstallDisabledError = () => new Error(`${APP_PROFILE.brand.serviceName} local installation is disabled in this build.`);
const remoteAddDisabledError = () => new Error("Adding remote Open WebUI instances is disabled in this build.");
const isBridgeOriginTrusted = (connection, origin) => {
  if (!connection) return false;
  try {
    return new URL(connection.url).origin === new URL(origin).origin;
  } catch {
    return false;
  }
};
const findProtocolUrl = (argv) => {
  return argv.find((arg) => typeof arg === "string" && arg.startsWith(`${DESKTOP_PROTOCOL}://`)) ?? null;
};
const getOrigin = (url2) => {
  try {
    return new URL(url2).origin;
  } catch {
    return null;
  }
};
const normalizeAppRedirectPath = (redirect) => {
  const value = String(redirect || "/").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
};
const ensureMainWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  }
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
};
const registerProtocolClient = () => {
  try {
    if (process.defaultApp && process.argv.length >= 2) {
      electron.app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL, process.execPath, [
        path.resolve(process.argv[1])
      ]);
    } else {
      electron.app.setAsDefaultProtocolClient(DESKTOP_PROTOCOL);
    }
  } catch (error) {
    log.warn(`Failed to register ${DESKTOP_PROTOCOL} protocol:`, error);
  }
};
const getWebviewTokenForConnection = async (connectionId) => {
  try {
    const { webContents: wc } = require("electron");
    const allContents = wc.getAllWebContents();
    for (const contents of allContents) {
      try {
        if (contents.getType() !== "webview" || contents.isDestroyed()) continue;
        const partition = contents.session?.partition ?? "";
        if (partition && partition !== `persist:connection-${connectionId}`) continue;
        const token = await contents.executeJavaScript(`localStorage.getItem('token') || ''`);
        if (token) return token;
      } catch {
      }
    }
  } catch {
    log.warn("Could not inspect webview token state");
  }
  return "";
};
const isConnectionLoggedIn = async (connectionId) => {
  if (AUTH_TOKEN) return true;
  return Boolean(await getWebviewTokenForConnection(connectionId));
};
const findConnectionForMagicServer = (config, serverUrl) => {
  const targetOrigin = getOrigin(serverUrl);
  if (!targetOrigin) return void 0;
  return config.connections.find((connection) => getOrigin(connection.url) === targetOrigin);
};
const handleProtocolUrl = async (rawUrl) => {
  if (!rawUrl) return;
  if (!electron.app.isReady() || !CONFIG) {
    pendingProtocolUrl = rawUrl;
    return;
  }
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    log.warn("Ignoring invalid protocol URL:", rawUrl);
    return;
  }
  if (parsed.protocol !== `${DESKTOP_PROTOCOL}:`) return;
  const action = parsed.hostname || parsed.pathname.replace(/^\/+/, "");
  if (action !== DESKTOP_MAGIC_AUTH_HOST) {
    ensureMainWindow();
    return;
  }
  const serverUrl = parsed.searchParams.get("server") || "";
  const ticket = parsed.searchParams.get("ticket") || "";
  const redirect = normalizeAppRedirectPath(parsed.searchParams.get("redirect"));
  if (!serverUrl || !ticket) {
    log.warn("Desktop magic link is missing server or ticket");
    ensureMainWindow();
    return;
  }
  const config = await getConfig();
  const connection = findConnectionForMagicServer(config, serverUrl);
  if (!connection) {
    log.warn("Desktop magic link server is not configured:", serverUrl);
    new electron.Notification({
      title: BRAND.name,
      body: "This desktop sign-in link does not match a configured Spark Atlas connection."
    }).show();
    ensureMainWindow();
    return;
  }
  ensureMainWindow();
  if (await isConnectionLoggedIn(connection.id)) {
    const result = await connectTo(connection);
    if (result) sendToRenderer("connection:open", result);
    return;
  }
  const serverOrigin = getOrigin(connection.url) || getOrigin(serverUrl);
  if (!serverOrigin) {
    log.warn("Desktop magic link server origin is invalid:", serverUrl);
    return;
  }
  const authUrl = new URL("/auth", serverOrigin);
  authUrl.searchParams.set("desktop_magic_ticket", ticket);
  authUrl.searchParams.set("desktop_magic_redirect", redirect);
  sendToRenderer("connection:open", {
    connectionId: connection.id,
    url: authUrl.toString()
  });
};
const gotTheLock = electron.app.requestSingleInstanceLock();
if (!gotTheLock) {
  electron.app.quit();
} else {
  electron.app.on("second-instance", (_event, argv) => {
    const protocolUrl = findProtocolUrl(argv);
    if (protocolUrl) {
      void handleProtocolUrl(protocolUrl);
      return;
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  electron.app.on("open-url", (event, url2) => {
    event.preventDefault();
    void handleProtocolUrl(url2);
  });
  electron.app.setAboutPanelOptions({
    applicationName: BRAND.desktopName,
    iconPath: icon,
    applicationVersion: electron.app.getVersion(),
    version: electron.app.getVersion(),
    website: BRAND.homepage,
    copyright: BRAND.copyrightText
  });
  electron.app.whenReady().then(async () => {
    registerProtocolClient();
    CONFIG = await getConfig();
    loadSpotlightPosition();
    log.info("Config:", CONFIG);
    electron.app.name = BRAND.desktopName;
    if (process.platform === "darwin" && electron.app.dock) {
      electron.app.dock.setIcon(dockIcon);
    }
    utils.electronApp.setAppUserModelId(BRAND.appId);
    electron.app.on("child-process-gone", (_event, details) => {
      if (details.type === "GPU") {
        log.error(`GPU process gone: reason=${details.reason}, exitCode=${details.exitCode}`);
        if (details.reason === "crashed" || details.reason === "launch-failed" || details.reason === "abnormal-exit") {
          if (!gpuSandboxDisabled) {
            log.info("Writing GPU crash marker and relaunching with --disable-gpu-sandbox");
            try {
              fs.writeFileSync(gpuCrashMarkerPath, (/* @__PURE__ */ new Date()).toISOString(), "utf-8");
            } catch (e) {
              log.warn("Failed to write GPU crash marker:", e);
            }
            electron.app.relaunch({ args: [...process.argv.slice(1), "--disable-gpu-sandbox"] });
            electron.app.exit(0);
          }
        }
      }
    });
    if (gpuSandboxDisabled) {
      log.info("Running with GPU sandbox disabled (marker file present)");
    }
    electron.app.on("certificate-error", (event, _webContents, url2, error, certificate, callback) => {
      log.warn(
        `Certificate error: ${error} for ${url2} (subject: ${certificate.subjectName}, issuer: ${certificate.issuerName})`
      );
      event.preventDefault();
      callback(true);
    });
    electron.session.defaultSession.setCertificateVerifyProc((_request, callback) => {
      callback(0);
    });
    electron.session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(isRemotePermissionAllowed(permission));
    });
    electron.session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
      return isRemotePermissionAllowed(permission);
    });
    electron.app.on("session-created", (newSession) => {
      newSession.setCertificateVerifyProc((_request, callback) => {
        callback(0);
      });
      newSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        callback(isRemotePermissionAllowed(permission));
      });
      newSession.setPermissionCheckHandler((_webContents, permission) => {
        return isRemotePermissionAllowed(permission);
      });
    });
    electron.app.on("browser-window-created", (_, window) => {
      utils.optimizer.watchWindowShortcuts(window);
      window.webContents.on("render-process-gone", (_event, details) => {
        log.error(`Renderer process gone: reason=${details.reason}, exitCode=${details.exitCode}`);
        if (details.reason !== "clean-exit") {
          window.webContents.reload();
        }
      });
    });
    electron.app.on("web-contents-created", (_event, contents) => {
      contents.on("render-process-gone", (_e, details) => {
        if (details.reason !== "clean-exit") {
          log.error(
            `WebContents render-process-gone: type=${contents.getType()}, reason=${details.reason}, exitCode=${details.exitCode}`
          );
        }
      });
      if (contents.getType() === "webview") {
        contents.setWindowOpenHandler(({ url: url2 }) => {
          if (isOriginAllowedInWebview(url2, contents.getURL())) {
            return { action: "allow" };
          }
          openUrl(url2);
          return { action: "deny" };
        });
        contents.on("will-navigate", (event, url2) => {
          try {
            const currentOrigin = new URL(contents.getURL()).origin;
            const targetOrigin = new URL(url2).origin;
            if (targetOrigin !== currentOrigin && !isOriginAllowedInWebview(url2, contents.getURL())) {
              event.preventDefault();
              openUrl(url2);
            }
          } catch {
          }
        });
        contents.on("context-menu", (_event2, params) => {
          const menuItems = [];
          if (params.misspelledWord && params.dictionarySuggestions?.length) {
            for (const suggestion of params.dictionarySuggestions) {
              menuItems.push({
                label: suggestion,
                click: () => contents.replaceMisspelling(suggestion)
              });
            }
            menuItems.push({ type: "separator" });
          }
          if (params.linkURL) {
            menuItems.push({
              label: "Open Link in Browser",
              click: () => openUrl(params.linkURL)
            });
            menuItems.push({
              label: "Copy Link",
              click: () => electron.clipboard.writeText(params.linkURL)
            });
            menuItems.push({ type: "separator" });
          }
          if (params.isEditable) {
            menuItems.push(
              { label: "Undo", role: "undo", enabled: params.editFlags.canUndo },
              { label: "Redo", role: "redo", enabled: params.editFlags.canRedo },
              { type: "separator" },
              { label: "Cut", role: "cut", enabled: params.editFlags.canCut },
              { label: "Copy", role: "copy", enabled: params.editFlags.canCopy },
              { label: "Paste", role: "paste", enabled: params.editFlags.canPaste },
              { label: "Select All", role: "selectAll", enabled: params.editFlags.canSelectAll }
            );
          } else if (params.selectionText) {
            menuItems.push({ label: "Copy", role: "copy", enabled: params.editFlags.canCopy });
          }
          if (menuItems.length > 0) {
            electron.Menu.buildFromTemplate(menuItems).popup();
          }
        });
      }
    });
    electron.ipcMain.handle("get:version", () => electron.app.getVersion());
    electron.ipcMain.handle("app:info", () => ({
      version: electron.app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      username: require("os").userInfo().username,
      gpuSandboxDisabled,
      brand: BRAND,
      features: FEATURES,
      updates: APP_PROFILE.updates
    }));
    electron.ipcMain.handle("app:contentPreloadPath", () => {
      return `file://${path.join(__dirname, "../preload/content-preload.js")}`;
    });
    electron.ipcMain.handle("app:defaultDataPath", () => {
      return path.join(getUserDataPath(), "data");
    });
    electron.ipcMain.handle("app:installDir", () => {
      return getInstallDir();
    });
    electron.ipcMain.handle("desktop:bridge:invoke", async (_event, request) => {
      if (!FEATURES.allowRemoteDesktopBridge) {
        throw new Error("Desktop bridge is disabled in this build.");
      }
      const config = await getConfig();
      const connection = config.connections.find((conn) => conn.id === request.connectionId);
      if (!isBridgeOriginTrusted(connection, request.origin)) {
        throw new Error("Desktop bridge origin is not trusted for this connection.");
      }
      if (!APP_PROFILE.desktopBridge.allowedCapabilities.includes(request.capability)) {
        throw new Error(`Desktop bridge capability is not allowed: ${request.capability}`);
      }
      switch (request.capability) {
        case "app.info":
          return {
            version: electron.app.getVersion(),
            platform: process.platform,
            arch: process.arch,
            brand: BRAND,
            features: FEATURES
          };
        case "app.openExternal": {
          const url2 = String(request.payload?.url ?? "");
          if (!url2) throw new Error("No URL provided.");
          openUrl(url2);
          return true;
        }
        case "system.platform":
          return { platform: process.platform, arch: process.arch };
        case "system.selectFolder": {
          const result = await electron.dialog.showOpenDialog({
            properties: ["openDirectory", "createDirectory"]
          });
          return result.canceled ? null : result.filePaths[0];
        }
        case "resources.selectFile": {
          if (!FEATURES.allowRemoteLocalResources) {
            throw new Error("Local resource access is disabled in this build.");
          }
          const result = await electron.dialog.showOpenDialog({
            properties: ["openFile", "multiSelections"]
          });
          return result.canceled ? [] : result.filePaths;
        }
        case "resources.openPath": {
          if (!FEATURES.allowRemoteLocalResources) {
            throw new Error("Local resource access is disabled in this build.");
          }
          const targetPath = String(request.payload?.path ?? "");
          if (!targetPath) throw new Error("No path provided.");
          return electron.shell.openPath(targetPath);
        }
        default:
          throw new Error(`Unhandled desktop bridge capability: ${request.capability}`);
      }
    });
    electron.ipcMain.handle("system:diskSpace", async () => {
      try {
        const stats = await promises.statfs(getUserDataPath());
        return { free: stats.bavail * stats.bsize };
      } catch (error) {
        log.error("Failed to check disk space:", error);
        return { free: -1 };
      }
    });
    electron.ipcMain.handle("tabs:detach", async (_event, tab) => {
      const connectionId = String(tab?.connectionId ?? "");
      const url2 = String(tab?.url ?? "");
      const title = String(tab?.title ?? BRAND.name);
      if (!connectionId || !url2) throw new Error("Missing tab information.");
      const config = await getConfig();
      const connection = config.connections.find((conn) => conn.id === connectionId);
      if (!connection) throw new Error("Connection is not configured.");
      if (!isOriginAllowedInWebview(url2, connection.url)) {
        throw new Error("Detached tab URL is not trusted for this connection.");
      }
      createContentWindow(url2, connectionId, title);
      return true;
    });
    electron.ipcMain.handle("get:config", () => getConfig());
    electron.ipcMain.handle("set:config", async (_event, config) => {
      await setConfig(config);
      CONFIG = await getConfig();
      if (mainWindow && !mainWindow.isDestroyed() && "glassEffect" in config) {
        applyGlassEffect(mainWindow, CONFIG.glassEffect !== false);
      }
      updateTray();
      voiceInputRecording = false;
      registerShortcuts(
        CONFIG.globalShortcut,
        CONFIG.spotlightShortcut,
        CONFIG.voiceInputShortcut,
        CONFIG.callShortcut
      );
    });
    electron.ipcMain.handle("install:python", async () => {
      if (!FEATURES.allowLocalOpenWebUIInstall) {
        sendToRenderer("error", { message: localInstallDisabledError().message });
        return false;
      }
      try {
        sendToRenderer("status:install", "Downloading Python…");
        const res = await installPython(void 0, (status2) => {
          sendToRenderer("status:install", status2);
        });
        sendToRenderer("status:python", res);
        return res;
      } catch (error) {
        sendToRenderer("status:python", false);
        sendToRenderer("error", {
          message: error?.message ?? "Python installation failed. Please check your internet connection and try again."
        });
        return false;
      }
    });
    electron.ipcMain.handle("status:python", async () => {
      return await isPythonInstalled() && await isUvInstalled();
    });
    electron.ipcMain.handle("install:package", async () => {
      if (!FEATURES.allowLocalOpenWebUIInstall) {
        sendToRenderer("error", { message: localInstallDisabledError().message });
        return false;
      }
      try {
        CONFIG = await getConfig();
        const owuiVersion = CONFIG?.localServer?.version || void 0;
        const otVersion = CONFIG?.openTerminal?.version || void 0;
        sendToRenderer("status:install", "Installing Open WebUI…");
        await installPackage("open-webui", owuiVersion, (status2) => {
          sendToRenderer("status:install", status2);
        });
        sendToRenderer("status:install", "Installing Open Terminal…");
        await installPackage("open-terminal", otVersion, (status2) => {
          sendToRenderer("status:install", status2);
        }).catch((e) => log.warn("open-terminal install failed (non-fatal):", e));
        sendToRenderer("status:package", true);
        return true;
      } catch (error) {
        sendToRenderer("status:package", false);
        sendToRenderer("error", {
          message: error?.message ?? "Package installation failed. Please check your internet connection and try again."
        });
        return false;
      }
    });
    electron.ipcMain.handle("status:package", async () => isPackageInstalled("open-webui"));
    electron.ipcMain.handle("server:start", () => startServerHandler());
    electron.ipcMain.handle("server:stop", () => stopServerHandler());
    electron.ipcMain.handle("server:restart", async () => {
      await stopServerHandler();
      return startServerHandler();
    });
    electron.ipcMain.handle("server:logs", () => SERVER_PID ? getServerLog(SERVER_PID) : []);
    electron.ipcMain.handle("server:logs:clear", () => clearAllServerLogs());
    electron.ipcMain.handle("pty:list", () => getServerPIDs());
    electron.ipcMain.handle("pty:connect", (_event, pid2) => connectPtyPort(pid2));
    electron.ipcMain.handle("server:info", () => ({
      url: SERVER_URL,
      status: SERVER_STATUS,
      pid: SERVER_PID,
      reachable: SERVER_REACHABLE
    }));
    electron.ipcMain.handle("connections:list", async () => {
      const config = await getConfig();
      return config.connections;
    });
    electron.ipcMain.handle("connections:add", async (_event, connection) => {
      if (connection.type === "local" && !FEATURES.allowLocalOpenWebUIInstall) {
        throw localInstallDisabledError();
      }
      if (connection.type === "remote" && !FEATURES.allowUserRemoteOpenWebUI) {
        throw remoteAddDisabledError();
      }
      const config = await getConfig();
      config.connections.push(connection);
      if (!config.defaultConnectionId) {
        config.defaultConnectionId = connection.id;
      }
      await setConfig(config);
      CONFIG = config;
      updateTray();
      return config.connections;
    });
    electron.ipcMain.handle("connections:remove", async (_event, id) => {
      const config = await getConfig();
      config.connections = config.connections.filter((c) => c.id !== id);
      if (config.defaultConnectionId === id) {
        config.defaultConnectionId = config.connections[0]?.id || null;
      }
      await setConfig(config);
      CONFIG = config;
      updateTray();
      return config.connections;
    });
    electron.ipcMain.handle(
      "connections:update",
      async (_event, id, updates) => {
        const config = await getConfig();
        const idx = config.connections.findIndex((c) => c.id === id);
        if (idx !== -1) {
          config.connections[idx] = { ...config.connections[idx], ...updates };
          await setConfig(config);
          CONFIG = config;
          updateTray();
        }
        return config.connections;
      }
    );
    electron.ipcMain.handle("connections:setDefault", async (_event, id) => {
      const config = await getConfig();
      config.defaultConnectionId = id;
      await setConfig(config);
      CONFIG = config;
      updateTray();
    });
    electron.ipcMain.handle("connections:connect", async (_event, id) => {
      const config = await getConfig();
      const conn = config.connections.find((c) => c.id === id);
      if (conn) {
        return await connectTo(conn);
      }
      return null;
    });
    electron.ipcMain.handle("validate:url", async (_event, url2) => {
      return await validateRemoteUrl(url2);
    });
    electron.ipcMain.handle("updater:check", () => checkForUpdates());
    electron.ipcMain.handle("updater:download", () => downloadUpdate());
    electron.ipcMain.handle("updater:install", () => installUpdate());
    electron.ipcMain.handle("app:changelog", async () => {
      try {
        const changelogPath = electron.app.isPackaged ? path.join(process.resourcesPath, "CHANGELOG.md") : path.join(electron.app.getAppPath(), "CHANGELOG.md");
        return await promises.readFile(changelogPath, "utf-8");
      } catch {
        return null;
      }
    });
    electron.ipcMain.handle("app:setAuthToken", (_event, token) => {
      AUTH_TOKEN = token || null;
      log.info("Auth token updated from webview");
    });
    electron.ipcMain.handle("app:reset", () => resetAppHandler());
    electron.ipcMain.handle("spotlight:submit", async (_event, query, images) => {
      const config = await getConfig();
      if (!config.defaultConnectionId || config.connections.length === 0) {
        mainWindow?.show();
        mainWindow?.focus();
        return;
      }
      const conn = config.connections.find((c) => c.id === config.defaultConnectionId);
      if (!conn) {
        mainWindow?.show();
        mainWindow?.focus();
        return;
      }
      let url2 = conn.url;
      if (conn.type === "local" && SERVER_URL) {
        url2 = SERVER_URL;
      }
      if (url2.startsWith("http://0.0.0.0")) {
        url2 = url2.replace("http://0.0.0.0", "http://localhost");
      }
      const files = images?.map((dataUrl, i) => ({
        name: `screenshot-${Date.now()}-${i + 1}.png`,
        mimeType: "image/png",
        dataUrl
      }));
      sendToRenderer("query", { query, connectionId: conn.id, url: url2, files });
      spotlightWindow?.hide();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    electron.ipcMain.handle("spotlight:close", () => {
      spotlightWindow?.hide();
    });
    electron.ipcMain.handle("spotlight:savePosition", async (_event, offset) => {
      spotlightBarOffset = offset;
      setConfig({ spotlightPosition: offset }).catch(
        (err) => log.warn("Failed to persist spotlight bar position:", err)
      );
    });
    electron.ipcMain.handle(
      "spotlight:captureRegion",
      async (_event, rect) => {
        try {
          if (process.platform === "darwin") {
            const status2 = electron.systemPreferences.getMediaAccessStatus("screen");
            if (status2 !== "granted") {
              log.warn(`spotlight:captureRegion — screen recording permission: ${status2}`);
              new electron.Notification({
                title: "Screen Recording Permission Required",
                body: `${BRAND.name} needs Screen Recording access to capture screenshots. Please enable it in System Settings → Privacy & Security → Screen Recording, then restart the app.`
              }).show();
              electron.shell.openExternal(
                "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
              ).catch(() => {
              });
              return "no-permission";
            }
          }
          spotlightWindow?.setOpacity(0);
          await new Promise((r) => setTimeout(r, 150));
          const { screen } = require("electron");
          const cursorPoint = screen.getCursorScreenPoint();
          const display = screen.getDisplayNearestPoint(cursorPoint);
          const scaleFactor = display.scaleFactor || 1;
          const sources = await electron.desktopCapturer.getSources({
            types: ["screen"],
            thumbnailSize: {
              width: Math.round(display.bounds.width * scaleFactor),
              height: Math.round(display.bounds.height * scaleFactor)
            }
          });
          const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
          if (!source) {
            spotlightWindow?.setOpacity(1);
            return null;
          }
          const fullImage = source.thumbnail;
          if (fullImage.isEmpty()) {
            log.warn("spotlight:captureRegion — captured thumbnail is empty (likely no permission)");
            spotlightWindow?.setOpacity(1);
            return null;
          }
          const cropped = fullImage.crop({
            x: Math.round(rect.x * scaleFactor),
            y: Math.round(rect.y * scaleFactor),
            width: Math.round(rect.width * scaleFactor),
            height: Math.round(rect.height * scaleFactor)
          });
          if (spotlightWindow && !spotlightWindow.isDestroyed()) {
            spotlightWindow.setOpacity(1);
          }
          return cropped.toDataURL();
        } catch (err) {
          log.error("spotlight:captureRegion failed:", err);
          spotlightWindow?.setOpacity(1);
          return null;
        }
      }
    );
    electron.ipcMain.handle("voiceInput:micPermission", async () => {
      if (process.platform === "darwin") {
        const status2 = electron.systemPreferences.getMediaAccessStatus("microphone");
        if (status2 !== "granted") {
          const granted = await electron.systemPreferences.askForMediaAccess("microphone");
          return granted ? "granted" : "denied";
        }
        return "granted";
      }
      return "granted";
    });
    electron.ipcMain.handle(
      "voiceInput:transcribe",
      async (_event, audioBuffer, rendererToken) => {
        try {
          const config = await getConfig();
          if (!config.defaultConnectionId || config.connections.length === 0) {
            throw new Error("No connection configured. Set up a connection in Settings first.");
          }
          const conn = config.connections.find((c) => c.id === config.defaultConnectionId);
          if (!conn)
            throw new Error("Default connection not found. Check your connection settings.");
          let url2 = conn.url;
          if (conn.type === "local" && SERVER_URL) {
            url2 = SERVER_URL;
          }
          if (url2.startsWith("http://0.0.0.0")) {
            url2 = url2.replace("http://0.0.0.0", "http://localhost");
          }
          let token = AUTH_TOKEN || rendererToken || "";
          if (!token) {
            try {
              const { webContents: wc } = require("electron");
              const allContents = wc.getAllWebContents();
              for (const contents of allContents) {
                try {
                  if (contents.getType() === "webview" && !contents.isDestroyed()) {
                    const t = await contents.executeJavaScript(
                      `localStorage.getItem('token') || ''`
                    );
                    if (t) {
                      token = t;
                      break;
                    }
                  }
                } catch {
                }
              }
            } catch {
              log.warn("voiceInput:transcribe — could not extract token from webviews");
            }
          }
          if (!token) {
            throw new Error(
              "Not authenticated. Open a connection and sign in before using voice input."
            );
          }
          const boundary = "----VoiceInput" + Date.now();
          const buffer = Buffer.from(audioBuffer);
          const filename = `recording-${Date.now()}.wav`;
          const header = [
            `--${boundary}`,
            `Content-Disposition: form-data; name="file"; filename="${filename}"`,
            `Content-Type: audio/wav`,
            "",
            ""
          ].join("\r\n");
          const footer = `\r
--${boundary}--\r
`;
          const headerBuf = Buffer.from(header, "utf-8");
          const footerBuf = Buffer.from(footer, "utf-8");
          const body = Buffer.concat([headerBuf, buffer, footerBuf]);
          const response = await fetch(`${url2}/api/v1/audio/transcriptions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": `multipart/form-data; boundary=${boundary}`
            },
            body
          });
          if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(
              `Transcription failed (HTTP ${response.status}). ${text || "Check that your server has Speech-to-Text configured."}`
            );
          }
          const result = await response.json();
          return result;
        } catch (error) {
          log.error("voiceInput:transcribe failed:", error);
          new electron.Notification({
            title: "Voice Input Failed",
            body: error?.message || "Transcription failed. Check logs for details."
          }).show();
          throw error;
        }
      }
    );
    electron.ipcMain.handle("voiceInput:done", async (_event, text) => {
      voiceInputRecording = false;
      playChime(false);
      if (voiceInputWindow && !voiceInputWindow.isDestroyed()) {
        voiceInputWindow.hide();
      }
      if (!text?.trim()) return;
      const config = await getConfig();
      if (!config.defaultConnectionId || config.connections.length === 0) {
        mainWindow?.show();
        mainWindow?.focus();
        return;
      }
      const conn = config.connections.find((c) => c.id === config.defaultConnectionId);
      if (!conn) {
        mainWindow?.show();
        mainWindow?.focus();
        return;
      }
      let url2 = conn.url;
      if (conn.type === "local" && SERVER_URL) {
        url2 = SERVER_URL;
      }
      if (url2.startsWith("http://0.0.0.0")) {
        url2 = url2.replace("http://0.0.0.0", "http://localhost");
      }
      sendToRenderer("query", { query: text.trim(), connectionId: conn.id, url: url2 });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    electron.ipcMain.handle("voiceInput:close", () => {
      voiceInputRecording = false;
      playChime(false);
      if (voiceInputWindow && !voiceInputWindow.isDestroyed()) {
        voiceInputWindow.hide();
      }
    });
    electron.ipcMain.handle("voiceInput:error", (_event, message) => {
      log.warn("Voice input error:", message);
      voiceInputRecording = false;
      new electron.Notification({
        title: "Voice Input Error",
        body: message || "An unknown error occurred with voice input."
      }).show();
    });
    electron.ipcMain.handle("open-terminal:start", async () => {
      try {
        sendToRenderer("status:open-terminal", "starting");
        const result = await startOpenTerminal(CONFIG?.openTerminal?.port ?? null);
        sendToRenderer("status:open-terminal", "started");
        sendToRenderer("open-terminal:ready", result);
        sendToRenderer("connections:terminal", {
          action: "add",
          url: result.url,
          key: result.apiKey
        });
        await setConfig({ openTerminal: { ...CONFIG?.openTerminal, enabled: true } });
        CONFIG = await getConfig();
        return result;
      } catch (error) {
        log.error("Failed to start Open Terminal:", error);
        sendToRenderer("status:open-terminal", "failed");
        sendToRenderer("error", { message: `Open Terminal failed: ${error?.message}` });
        return null;
      }
    });
    electron.ipcMain.handle("open-terminal:stop", async () => {
      try {
        const info = getOpenTerminalInfo();
        await stopOpenTerminal();
        sendToRenderer("status:open-terminal", "stopped");
        if (info.url) {
          sendToRenderer("connections:terminal", {
            action: "remove",
            url: info.url
          });
        }
        await setConfig({ openTerminal: { ...CONFIG?.openTerminal, enabled: false } });
        CONFIG = await getConfig();
        return true;
      } catch (error) {
        log.error("Failed to stop Open Terminal:", error);
        return false;
      }
    });
    electron.ipcMain.handle("open-terminal:info", () => getOpenTerminalInfo());
    electron.ipcMain.handle("open-terminal:status", () => isPackageInstalled("open-terminal"));
    electron.ipcMain.handle("open-terminal:pty:connect", () => connectOpenTerminalPtyPort());
    electron.ipcMain.handle("llamacpp:setup", async () => {
      try {
        sendToRenderer("status:llamacpp", "setting-up");
        const binary = await setupLlamaCpp((status2) => {
          sendToRenderer("status:llamacpp-setup", status2);
        });
        sendToRenderer("status:llamacpp", "ready");
        return binary;
      } catch (error) {
        log.error("Failed to setup llamacpp:", error);
        sendToRenderer("status:llamacpp", "failed");
        sendToRenderer("error", { message: `llamacpp setup failed: ${error?.message}` });
        return null;
      }
    });
    electron.ipcMain.handle("llamacpp:start", async () => {
      try {
        sendToRenderer("status:llamacpp", "starting");
        const result = await startLlamaCpp((status2) => {
          sendToRenderer("status:llamacpp-setup", status2);
        });
        sendToRenderer("status:llamacpp", "started");
        sendToRenderer("llamacpp:ready", result);
        if (result.url) {
          sendToRenderer("connections:openai", {
            action: "add",
            url: `${result.url}/v1`
          });
          setTimeout(() => sendToRenderer("models:refresh"), 1e3);
        }
        await setConfig({ llamaCpp: { ...CONFIG?.llamaCpp, enabled: true } });
        CONFIG = await getConfig();
        return result;
      } catch (error) {
        log.error("Failed to start llamacpp:", error);
        sendToRenderer("status:llamacpp", "failed");
        sendToRenderer("error", { message: `llamacpp failed: ${error?.message}` });
        return null;
      }
    });
    electron.ipcMain.handle("llamacpp:stop", async () => {
      try {
        const info = getLlamaCppInfo();
        await stopLlamaCpp();
        sendToRenderer("status:llamacpp", "stopped");
        if (info.url) {
          sendToRenderer("connections:openai", {
            action: "remove",
            url: `${info.url}/v1`
          });
          setTimeout(() => sendToRenderer("models:refresh"), 500);
        }
        await setConfig({ llamaCpp: { ...CONFIG?.llamaCpp, enabled: false } });
        CONFIG = await getConfig();
        return true;
      } catch (error) {
        log.error("Failed to stop llamacpp:", error);
        return false;
      }
    });
    electron.ipcMain.handle("llamacpp:info", () => getLlamaCppInfo());
    electron.ipcMain.handle("llamacpp:logs", () => getLlamaCppLog());
    electron.ipcMain.handle("llamacpp:pty:connect", () => connectLlamaCppPtyPort());
    electron.ipcMain.handle("llamacpp:uninstall", async () => {
      try {
        const info = getLlamaCppInfo();
        await uninstallLlamaCpp();
        sendToRenderer("status:llamacpp", null);
        if (info.url) {
          sendToRenderer("connections:openai", {
            action: "remove",
            url: `${info.url}/v1`
          });
          setTimeout(() => sendToRenderer("models:refresh"), 500);
        }
        await setConfig({ llamaCpp: { ...CONFIG?.llamaCpp, enabled: false } });
        CONFIG = await getConfig();
        return true;
      } catch (error) {
        log.error("Failed to uninstall llamacpp:", error);
        return false;
      }
    });
    electron.ipcMain.handle("huggingface:models:list", () => listModels());
    electron.ipcMain.handle("huggingface:models:dir", () => getModelsDir());
    electron.ipcMain.handle("huggingface:models:delete", (_event, repo, filename) => {
      return deleteModel(repo, filename);
    });
    electron.ipcMain.handle("huggingface:models:cancel", (_event, repo, filename) => {
      cancelDownload(repo, filename);
      return true;
    });
    electron.ipcMain.handle("huggingface:search", async (_event, query, token) => {
      return searchModels(query, token);
    });
    electron.ipcMain.handle("huggingface:repo:files", async (_event, repo, token) => {
      return getRepoFiles(repo, token);
    });
    electron.ipcMain.handle(
      "huggingface:models:download",
      async (_event, repo, filename, token, expectedSize) => {
        try {
          sendToRenderer("status:huggingface-download", {
            repo,
            filename,
            status: "downloading",
            percent: 0
          });
          const filepath = await downloadModel(
            repo,
            filename,
            (progress) => {
              sendToRenderer("status:huggingface-download", {
                repo,
                filename,
                status: "downloading",
                percent: progress.percent,
                downloadedBytes: progress.downloadedBytes,
                totalBytes: progress.totalBytes
              });
            },
            token,
            expectedSize
          );
          sendToRenderer("status:huggingface-download", {
            repo,
            filename,
            status: "done",
            filepath
          });
          return filepath;
        } catch (error) {
          log.error("Failed to download model:", error);
          sendToRenderer("status:huggingface-download", {
            repo,
            filename,
            status: "failed",
            error: error?.message
          });
          sendToRenderer("error", { message: `Model download failed: ${error?.message}` });
          return null;
        }
      }
    );
    electron.ipcMain.handle(
      "package:version",
      (_event, packageName) => getPackageVersion(packageName)
    );
    electron.ipcMain.handle("package:uninstall", async (_event, packageName) => {
      return uninstallPackage(packageName);
    });
    electron.ipcMain.handle("dialog:selectFolder", async () => {
      const result = await electron.dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"]
      });
      return result.canceled ? null : result.filePaths[0] ?? null;
    });
    electron.ipcMain.handle("app:launchAtLogin:get", () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    });
    electron.ipcMain.handle("app:launchAtLogin:set", (_event, enabled) => {
      electron.app.setLoginItemSettings({ openAtLogin: enabled });
    });
    electron.ipcMain.handle("open:browser", async (_event, { url: url2 }) => {
      if (!url2) throw new Error("No URL provided");
      let normalizedUrl = url2;
      if (normalizedUrl.startsWith("http://0.0.0.0")) {
        normalizedUrl = normalizedUrl.replace("http://0.0.0.0", "http://localhost");
      }
      await openUrl(normalizedUrl);
    });
    electron.ipcMain.handle("open:path", async (_event, folderPath) => {
      if (!folderPath) throw new Error("No path provided");
      await electron.shell.openPath(folderPath);
    });
    electron.ipcMain.handle("notification", async (_event, { title, body }) => {
      new electron.Notification({ title, body }).show();
    });
    electron.ipcMain.handle("llamacpp:check-update", async () => {
      try {
        return await checkLlamaCppUpdate();
      } catch (error) {
        log.error("Failed to check llamacpp update:", error);
        throw error;
      }
    });
    electron.ipcMain.handle("llamacpp:update", async () => {
      try {
        sendToRenderer("status:llamacpp", "setting-up");
        const result = await updateLlamaCpp((status2) => {
          sendToRenderer("status:llamacpp-setup", status2);
        });
        sendToRenderer("status:llamacpp", "ready");
        return result;
      } catch (error) {
        log.error("Failed to update llamacpp:", error);
        sendToRenderer("status:llamacpp", "failed");
        sendToRenderer("error", { message: `llamacpp update failed: ${error?.message}` });
        throw error;
      }
    });
    const trayIcon = electron.nativeImage.createFromPath(icon);
    tray = new electron.Tray(trayIcon.resize({ width: 16, height: 16 }));
    tray.setToolTip(BRAND.name);
    updateTray();
    registerShortcuts(
      CONFIG.globalShortcut,
      CONFIG.spotlightShortcut,
      CONFIG.voiceInputShortcut,
      CONFIG.callShortcut
    );
    electron.session.defaultSession.setDisplayMediaRequestHandler(
      (request, callback) => {
        electron.desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
          callback({ video: sources[0], audio: "loopback" });
        });
      },
      { useSystemPicker: true }
    );
    validateOpenTerminalProcess();
    validateLlamaCppProcess();
    if (CONFIG?.openTerminal?.enabled) {
      try {
        sendToRenderer("status:open-terminal", "starting");
        const result = await startOpenTerminal(CONFIG?.openTerminal?.port ?? null);
        sendToRenderer("status:open-terminal", "started");
        sendToRenderer("open-terminal:ready", result);
      } catch (error) {
        log.error("Auto-start Open Terminal failed:", error);
        sendToRenderer("status:open-terminal", "failed");
      }
    }
    if (CONFIG?.llamaCpp?.enabled) {
      try {
        sendToRenderer("status:llamacpp", "starting");
        const result = await startLlamaCpp((status2) => {
          sendToRenderer("status:llamacpp-setup", status2);
        });
        sendToRenderer("status:llamacpp", "started");
        sendToRenderer("llamacpp:ready", result);
      } catch (error) {
        log.error("Auto-start llama.cpp failed:", error);
        sendToRenderer("status:llamacpp", "failed");
      }
    }
    const startupProtocolUrl = pendingProtocolUrl || findProtocolUrl(process.argv);
    pendingProtocolUrl = null;
    if (startupProtocolUrl) {
      createMainWindow();
      await handleProtocolUrl(startupProtocolUrl);
    } else if (CONFIG.defaultConnectionId && CONFIG.connections.length > 0) {
      const defaultConn = CONFIG.connections.find((c) => c.id === CONFIG.defaultConnectionId);
      if (defaultConn) {
        createMainWindow();
        const result = await connectTo(defaultConn);
        if (result) sendToRenderer("connection:open", result);
      } else {
        createMainWindow();
      }
    } else {
      createMainWindow();
    }
    if (mainWindow) {
      initUpdater(mainWindow);
      broadcastSystemTheme();
    }
    electron.nativeTheme.on("updated", broadcastSystemTheme);
    electron.app.on("activate", () => {
      if (electron.BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
        broadcastSystemTheme();
      } else {
        mainWindow?.show();
        mainWindow?.focus();
      }
    });
  });
  electron.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      electron.app.quit();
    }
  });
  electron.app.on("before-quit", async () => {
    isQuiting = true;
    await stopLlamaCpp();
    await stopOpenTerminal();
    await stopServerHandler();
    electron.globalShortcut.unregisterAll();
    mainWindow = null;
    for (const win of detachedContentWindows) {
      if (!win.isDestroyed()) win.destroy();
    }
    detachedContentWindows.clear();
    if (spotlightWindow && !spotlightWindow.isDestroyed()) {
      spotlightWindow.destroy();
    }
    spotlightWindow = null;
    if (voiceInputWindow && !voiceInputWindow.isDestroyed()) {
      voiceInputWindow.destroy();
    }
    voiceInputWindow = null;
    tray?.destroy();
    tray = null;
  });
}
