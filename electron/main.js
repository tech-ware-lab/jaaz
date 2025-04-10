// electron/main.js
// npx electron electron/main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

const net = require("net");

function findAvailablePort(startPort = 5000) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        // Port is in use, try the next one
        findAvailablePort(startPort + 1)
          .then(resolve)
          .catch(reject);
      } else {
        reject(err);
      }
    });

    server.listen(startPort, () => {
      server.close(() => {
        resolve(startPort);
      });
    });
  });
}

let mainWindow;
let pyProc = null;
let pyPort = null;

const createWindow = (pyPort) => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, use Vite dev server
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://127.0.0.1:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load built files
    mainWindow.loadURL(`http://127.0.0.1:${pyPort}`);
  }
};

// 获取 app.asar 内部的根路径
const appRoot = app.getAppPath();

const startPythonApi = async () => {
  // Find an available port
  pyPort = await findAvailablePort(5100);

  // 确定UI dist目录
  const env = { ...process.env };
  if (app.isPackaged) {
    env.UI_DIST_DIR = path.join(process.resourcesPath, "react", "dist");
  }

  // Determine the Python executable path (considering packaged app)
  const pythonExecutable = app.isPackaged
    ? path.join(process.resourcesPath, "server", "dist", "main", "main")
    : "python";
  const fs = require("fs");
  // fs.chmodSync(pythonExecutable, "755");

  console.log("Python executable path:", pythonExecutable);
  console.log("Python executable exists?", fs.existsSync(pythonExecutable));
  // Determine script path
  const scriptPath = path.join(__dirname, "../server/main.py");

  // Start the FastAPI process
  pyProc = spawn(
    pythonExecutable,
    app.isPackaged ? [`--port`, pyPort] : [scriptPath, `--port`, pyPort],
    {
      env: env,
    }
  );

  // Log output
  pyProc.stdout.on("data", (data) => {
    console.log(`Python stdout: ${data}`);
  });

  pyProc.stderr.on("data", (data) => {
    console.error(`Python stderr: ${data}`);
  });

  return pyPort;
};

app.whenReady().then(async () => {
  const pyPort = await startPythonApi();
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // wait for the server to start
    let status = await fetch(`http://127.0.0.1:${pyPort}`);
    if (status.ok) {
      break;
    }
  }
  createWindow(pyPort);
});

// Quit the app and clean up the Python process
app.on("will-quit", () => {
  if (pyProc) {
    pyProc.kill();
    pyProc = null;
  }
});
