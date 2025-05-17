// electron/main.js
// npx electron electron/main.js
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const net = require("net");

function findAvailablePort(startPort = 5000) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.on(
      "error",
      /** @param {NodeJS.ErrnoException} err */ (err) => {
        if (err.code === "EADDRINUSE") {
          // Port is in use, try the next one
          findAvailablePort(startPort + 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(err);
        }
      }
    );

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
      // for showing local image and video files
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });

  // In development, use Vite dev server
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5174");
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
  console.log("available pyPort:", pyPort);

  // 确定UI dist目录
  const env = { ...process.env };
  if (app.isPackaged) {
    env.UI_DIST_DIR = path.join(process.resourcesPath, "react", "dist");
    env.USER_DATA_DIR = app.getPath("userData");
    env.IS_PACKAGED = "1";
  }

  // Determine the Python executable path (considering packaged app)
  const pythonExecutable = app.isPackaged
    ? path.join(process.resourcesPath, "server", "dist", "main", "main")
    : "python";
  const fs = require("fs");
  // fs.chmodSync(pythonExecutable, "755");

  console.log("Python executable path:", pythonExecutable);
  console.log("Python executable exists?", fs.existsSync(pythonExecutable));
  console.log("env:", env);
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

// Add these handlers before app.whenReady()
ipcMain.handle("pick-image", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths;
  }
  return null;
});

ipcMain.handle("pick-video", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Videos", extensions: ["mp4", "webm", "mov", "avi"] }],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

const handlers = require("./ipcHandlers");
console.log("Registering IPC handlers:", Object.keys(handlers));

for (const [name, fn] of Object.entries(handlers)) {
  console.log(`Registering handler for: ${name}`);
  ipcMain.handle(name, fn);
}

app.whenReady().then(async () => {
  if (process.env.NODE_ENV !== "development") {
    const pyPort = await startPythonApi();
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // wait for the server to start
      let status = await fetch(`http://127.0.0.1:${pyPort}`)
        .then((res) => {
          return res.ok;
        })
        .catch((err) => {
          console.error(err);
          return false;
        });
      if (status) {
        break;
      }
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

// ipcMain.handle("reveal-in-explorer", async (event, filePath) => {
//   try {
//     // Convert relative path to absolute path
//     const fullPath = path.join(app.getPath("userData"), "workspace", filePath);

//     // Use shell.openPath which is the recommended way in Electron
//     await shell.showItemInFolder(fullPath);
//     return { success: true };
//   } catch (error) {
//     console.error("Error revealing file:", error);
//     return { error: error.message };
//   }
// });
