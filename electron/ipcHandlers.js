// ipcHandlers.js
const { chromium, BrowserContext } = require("playwright");
const path = require("path");
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const https = require("https");
const { spawn } = require("child_process");
const { createWriteStream } = require("fs");
const { pipeline } = require("stream");
const { promisify } = require("util");
const AdmZip = require("adm-zip");

module.exports = {
  publishPost: async (event, data) => {
    console.log("🦄🦄publishPost called with data:", data);
    try {
      if (data.channel === "xiaohongshu") {
        await publishXiaohongshu(data);
      } else if (data.channel === "bilibili") {
        await publishBilibili(data);
      } else if (data.channel === "youtube") {
        await publishYoutube(data);
      }
    } catch (error) {
      console.error("Error in publish post:", error);
      return { error: error.message };
    }
  },
  "install-comfyui": async (event) => {
    console.log("🦄🦄install-comfyui called");
    try {
      await installComfyUI();
      return { success: true };
    } catch (error) {
      console.error("Error installing ComfyUI:", error);
      return { error: error.message };
    }
  },
};

const userDataDir = app.getPath("userData");
/** @type {BrowserContext | null} */
let browser;

async function launchBrowser() {
  const context = await chromium.launchPersistentContext(
    path.join(userDataDir, "browser_data"),
    {
      headless: false,
      channel: "chrome",
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars", // hides "Chrome is being controlled" banner
      ],
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      viewport: null,
      ignoreDefaultArgs: ["--enable-automation"],
    }
  );

  return context;
}

/**
 * @typedef {Object} PublishData
 * @property {"youtube" | "bilibili" | "douyin" | "xiaohongshu"} channel - The platform to publish to
 * @property {string} title - The title of the post
 * @property {string} content - The content of the post
 * @property {string[]} images - Array of image paths
 * @property {string} video - Path to the video file
 */

/**
 * @param {PublishData} data - The data for publishing the post
 */
async function publishXiaohongshu(data) {
  if (!browser) {
    browser = await launchBrowser();
  }
  const page = await browser.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    });
  });
  try {
    await page.goto("https://creator.xiaohongshu.com/publish/publish");

    // Wait for the upload container to be visible
    try {
      await page.waitForSelector(".upload-container", { timeout: 5000 });
    } catch (error) {
      throw new Error("Please login to Xiaohongshu first");
    }

    // Check if video upload tab exists
    const videoTab = await page.$('.creator-tab:has-text("上传视频")');
    if (!videoTab) {
      throw new Error("Video upload tab not found on the page");
    }

    // Click on "上传视频" (Upload Video) button
    await videoTab.click();

    // Wait for the file input to be visible
    await page.waitForSelector('input[type="file"]');

    // Check if video path exists in data
    if (!data.video) {
      throw new Error("No video file path provided in data");
    }

    // Upload the video file
    await page.setInputFiles('input[type="file"]', data.video);

    // Wait for upload progress to appear
    await page.waitForSelector(".uploading", { timeout: 10000 });

    // Wait a bit more to ensure the upload is fully processed
    await page.waitForTimeout(1000);

    const [content, uploadComplete] = await Promise.all([
      fillXiaohongshuContent(page, data.title, data.content),
      waitForXiaohongshuUploadComplete(page),
    ]);

    console.log("🦄🦄uploadComplete:", uploadComplete);

    // Wait a bit to ensure content is properly set
    await page.waitForTimeout(1000);
  } catch (error) {
    console.error("Error during video upload:", error);
    throw error;
  } finally {
    // await page.close();
  }
}

async function fillXiaohongshuContent(page, title, content) {
  // fill in title
  await page.waitForSelector(
    'input.d-text[placeholder="填写标题会有更多赞哦～"]',
    { timeout: 10000 } // Increase timeout if necessary
  );

  // Focus on the input field
  await page.focus('input.d-text[placeholder="填写标题会有更多赞哦～"]');
  await page.fill(
    'input.d-text[placeholder="填写标题会有更多赞哦～"]',
    title || ""
  );

  await page.waitForTimeout(1000);
  await page.waitForSelector(".ql-editor");
  await page.focus(".ql-editor");
  const { tags, content: contentWithoutTags } = getTagsFromContent(
    content || ""
  );

  // Fill in the content by clipboard copying pasting
  await copyPasteContent(page, contentWithoutTags);
  await page.waitForTimeout(2000);

  await page.keyboard.press("Enter");

  await page.waitForTimeout(1000);

  // Add hashtags
  console.log("🦄🦄tags:", tags);
  for (const tag of tags) {
    await copyPasteContent(page, `#${tag}`);
    await page.waitForTimeout(2000);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
  }

  await page.waitForTimeout(1000);

  return true;
}

async function waitForXiaohongshuUploadComplete(page) {
  // Wait for upload to complete (100%)
  while (true) {
    const progressText = await page.evaluate(() => {
      return document.querySelector(".stage")?.textContent || "";
    });

    // Check if the text contains "上传成功" (Upload Successful)
    if (progressText.includes("上传成功")) {
      console.log("Upload completed!");
      return true;
    }

    // Match the text that contains "上传中" followed by a percentage
    const progressMatch = progressText.match(/上传中\s*(\d+)%/);

    if (!progressMatch) {
      throw new Error("Could not find upload progress percentage");
    }

    const progress = parseInt(progressMatch[1]);
    console.log(`⏳Upload progress: ${progress}%`);

    if (progress === 99) {
      console.log("Upload completed!");
      break;
    }

    // Wait a bit before checking again
    await page.waitForTimeout(3000);
  }
  return false;
}

/**
 * @param {PublishData} data - The data for publishing the post
 */

async function publishBilibili(data) {
  if (!browser) {
    browser = await launchBrowser();
  }
  const page = await browser.newPage();
  try {
    await page.goto("https://member.bilibili.com/platform/upload/video/frame");
    await page.waitForTimeout(3000); // Let Vue UI settle

    // Ensure the "上传视频" button is visible and clickable
    const uploadButton = await page.waitForSelector(".bcc-upload-wrapper", {
      timeout: 10000,
      state: "visible",
    });

    // Listen for the file chooser BEFORE clicking
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      uploadButton.click(), // This triggers file picker
    ]);

    // Use the filechooser to set your file
    await fileChooser.setFiles(data.video);
    // fill in title
    await page.locator('input[placeholder="请输入稿件标题"]').click();
    await page.keyboard.press(
      process.platform === "darwin" ? "Meta+A" : "Control+A"
    );
    await page.keyboard.press("Delete");
    await copyPasteContent(page, data.title);

    const { tags, content: contentWithoutTags } = getTagsFromContent(
      data.content || ""
    );
    // fill in content
    await page.focus(".ql-editor");
    await copyPasteContent(page, contentWithoutTags);
    await page.waitForTimeout(1000);
    // fill in tags
    const tagInput = await page
      .locator('input[placeholder="按回车键Enter创建标签"]')
      .nth(0);
    await tagInput.click();
    await page.waitForTimeout(1000);
    for (const tag of tags) {
      await copyPasteContent(page, `${tag}`);
      await page.waitForTimeout(1000);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(2000);
  } catch (err) {
    console.error("Upload error:", err);
    throw err;
  }
}

async function publishYoutube(data) {
  if (!browser) {
    browser = await launchBrowser();
  }
  const page = await browser.newPage();
  try {
    await page.goto("https://www.youtube.com/upload");
    await page.waitForTimeout(3000); // Let Vue UI settle
  } catch (err) {
    console.error("Upload error:", err);
    throw err;
  }
}
/**
 * @param {string} content - The content of the post
 * @returns {{tags: string[], content: string}} - The tags of the post and the content without tags
 */
function getTagsFromContent(content) {
  const tags = content.match(/#(\w+)/g);
  const ret = tags ? tags.map((tag) => tag.slice(1)) : [];
  console.log("🦄🦄ret:", ret);
  // remove tags from content
  for (const tag of ret) {
    content = content.replace(`#${tag}`, "");
  }
  // remove spaces and trailing \n from content
  content = content.trim().replace(/\n+$/, "");

  return { tags: ret, content };
}
async function copyPasteContent(page, content) {
  await page.evaluate(async (text) => {
    await navigator.clipboard.writeText(text);
  }, content || "");
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+V" : "Control+V"
  );
}

/**
 * Get the latest ComfyUI release information from GitHub
 * @returns {Promise<{version: string, downloadUrl: string}>} - Promise resolving to latest release info
 */
async function getLatestComfyUIRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: "/repos/comfyanonymous/ComfyUI/releases/latest",
      method: "GET",
      headers: {
        "User-Agent": "Jaaz-App/1.0.0",
        Accept: "application/vnd.github.v3+json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const release = JSON.parse(data);

          if (res.statusCode !== 200) {
            reject(
              new Error(
                `GitHub API error: ${res.statusCode} - ${
                  release.message || "Unknown error"
                }`
              )
            );
            return;
          }

          // Find the Windows portable NVIDIA version
          const windowsPortableAsset = release.assets.find(
            (asset) =>
              asset.name.includes("windows_portable") &&
              asset.name.includes("nvidia") &&
              (asset.name.endsWith(".7z") || asset.name.endsWith(".zip"))
          );

          if (!windowsPortableAsset) {
            // Fallback to any Windows portable version
            const fallbackAsset = release.assets.find(
              (asset) =>
                asset.name.includes("windows_portable") &&
                (asset.name.endsWith(".7z") || asset.name.endsWith(".zip"))
            );

            if (!fallbackAsset) {
              reject(
                new Error(
                  "No suitable Windows portable version found in latest release"
                )
              );
              return;
            }

            resolve({
              version: release.tag_name,
              downloadUrl: fallbackAsset.browser_download_url,
              fileName: fallbackAsset.name,
              size: fallbackAsset.size,
            });
            return;
          }

          resolve({
            version: release.tag_name,
            downloadUrl: windowsPortableAsset.browser_download_url,
            fileName: windowsPortableAsset.name,
            size: windowsPortableAsset.size,
          });
        } catch (error) {
          reject(
            new Error(`Failed to parse GitHub API response: ${error.message}`)
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(new Error(`GitHub API request failed: ${error.message}`));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("GitHub API request timeout"));
    });

    req.end();
  });
}

/**
 * Install ComfyUI
 * @returns {Promise<{success: boolean}>} - Promise resolving to installation result
 */
async function installComfyUI() {
  console.log("🦄 Starting ComfyUI installation...");

  // Create installation progress window
  const progressWindow = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Installing ComfyUI",
    resizable: false,
    minimizable: false,
    maximizable: false,
  });

  // Create simple progress page
  const progressHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Installing ComfyUI</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          background: #f5f5f5;
        }
        .container {
          max-width: 500px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .progress-bar {
          width: 100%;
          height: 20px;
          background: #e0e0e0;
          border-radius: 10px;
          overflow: hidden;
          margin: 20px 0;
        }
        .progress-fill {
          height: 100%;
          background: #4CAF50;
          width: 0%;
          transition: width 0.3s ease;
        }
        .log {
          background: #f0f0f0;
          padding: 10px;
          border-radius: 5px;
          height: 200px;
          overflow-y: auto;
          font-family: monospace;
          font-size: 12px;
        }
        h2 { color: #333; text-align: center; }
        .status { text-align: center; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🎨 Installing Flux Image Generation Model</h2>
        <div class="status" id="status">Preparing to start download...</div>
        <div class="progress-bar">
          <div class="progress-fill" id="progress"></div>
        </div>
        <div class="log" id="log">Waiting to start...\\n</div>
      </div>
      <script>
        function updateProgress(percent) {
          document.getElementById('progress').style.width = percent + '%';
        }
        function updateStatus(text) {
          document.getElementById('status').textContent = text;
        }
        function addLog(text) {
          const log = document.getElementById('log');
          log.textContent += text + '\\n';
          log.scrollTop = log.scrollHeight;
        }

        // Listen for messages from main process
        window.addEventListener('message', (event) => {
          const { type, data } = event.data;
          if (type === 'progress') {
            updateProgress(data.percent);
            updateStatus(data.status);
          } else if (type === 'log') {
            addLog(data.message);
          }
        });
      </script>
    </body>
    </html>
  `;

  // Load progress page
  progressWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(progressHtml)}`
  );

  try {
    // Get user data directory and temp directory
    const userDataDir = app.getPath("userData");
    const tempDir = path.join(userDataDir, "temp");
    const comfyUIDir = path.join(userDataDir, "comfyui");

    // Ensure directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Send log messages to progress window
    const sendProgress = (percent, status) => {
      progressWindow.webContents.executeJavaScript(`
        updateProgress(${percent});
        updateStatus("${status}");
      `);
    };

    const sendLog = (message) => {
      progressWindow.webContents.executeJavaScript(`
        addLog("${message.replace(/"/g, '\\"')}");
      `);
      console.log(`[ComfyUI Install] ${message}`);
    };

    sendLog("Starting ComfyUI installation...");
    sendProgress(5, "Fetching latest ComfyUI version...");

    // Get latest ComfyUI release information
    let releaseInfo;
    try {
      sendLog("Fetching latest ComfyUI release from GitHub...");
      releaseInfo = await getLatestComfyUIRelease();
      sendLog(`Found latest version: ${releaseInfo.version}`);
      sendLog(
        `Download file: ${releaseInfo.fileName} (${Math.round(
          releaseInfo.size / 1024 / 1024
        )}MB)`
      );
    } catch (error) {
      sendLog(`Failed to fetch latest release: ${error.message}`);
      sendLog("Falling back to default version...");
      // Fallback to hardcoded version
      releaseInfo = {
        version: "v0.3.39",
        downloadUrl:
          "https://github.com/comfyanonymous/ComfyUI/releases/download/v0.3.39/ComfyUI_windows_portable_nvidia.7z",
        fileName: "ComfyUI_windows_portable_nvidia.7z",
      };
    }

    sendProgress(10, "Checking existing files...");

    const zipPath = path.join(tempDir, releaseInfo.fileName);

    // Check if already downloaded
    let shouldDownload = true;
    if (fs.existsSync(zipPath)) {
      sendLog("Found existing installation package, checking integrity...");
      try {
        const stats = fs.statSync(zipPath);
        if (stats.size > 1000000) {
          // At least 1MB, simple integrity check
          sendLog("Installation package is complete, skipping download");
          shouldDownload = false;
        } else {
          sendLog("Installation package is incomplete, re-downloading");
          fs.unlinkSync(zipPath);
        }
      } catch (error) {
        sendLog("Error checking installation package, re-downloading");
        shouldDownload = true;
      }
    }

    if (shouldDownload) {
      sendProgress(15, "Starting ComfyUI download...");
      sendLog(
        `Downloading ComfyUI ${releaseInfo.version} from ${releaseInfo.downloadUrl}...`
      );

      await downloadFile(releaseInfo.downloadUrl, zipPath, (progress) => {
        const percent = 15 + progress * 60; // 15-75% for download
        sendProgress(percent, `Downloading... ${Math.round(progress * 100)}%`);
      });

      sendLog("Download completed");
    }

    sendProgress(75, "Extracting installation package...");
    sendLog("Starting ComfyUI extraction...");

    // Extract files
    if (fs.existsSync(comfyUIDir)) {
      sendLog("Removing old ComfyUI directory...");
      fs.rmSync(comfyUIDir, { recursive: true, force: true });
    }

    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(comfyUIDir, true);
      sendLog("Extraction completed");
    } catch (error) {
      sendLog(`Extraction failed: ${error.message}`);
      throw error;
    }

    sendProgress(90, "Configuring ComfyUI...");
    sendLog("Configuring ComfyUI environment...");

    // Find ComfyUI main directory (may be in subdirectory after extraction)
    const comfyUIMainDir = findComfyUIMainDir(comfyUIDir);
    if (!comfyUIMainDir) {
      throw new Error("ComfyUI main directory not found");
    }

    sendLog(`Found ComfyUI main directory: ${comfyUIMainDir}`);

    sendProgress(95, "Updating configuration...");
    sendLog("Updating application configuration...");

    // Update configuration, add ComfyUI as image model
    await updateConfigWithComfyUI();

    sendProgress(100, "Installation completed!");
    sendLog("ComfyUI installation successful!");
    sendLog("You can now use local ComfyUI for image generation.");

    // Close progress window after 3 seconds
    setTimeout(() => {
      progressWindow.close();
    }, 3000);

    return { success: true };
  } catch (error) {
    console.error("ComfyUI installation failed:", error);

    // Show error message
    progressWindow.webContents.executeJavaScript(`
      updateStatus("Installation failed: ${error.message}");
      addLog("Error: ${error.message}");
    `);

    // Close window after 5 seconds
    setTimeout(() => {
      progressWindow.close();
    }, 5000);

    throw error;
  }
}

// Helper function to download files
async function downloadFile(url, filePath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(filePath);

    const downloadFromUrl = (downloadUrl, maxRedirects = 5) => {
      if (maxRedirects <= 0) {
        reject(new Error("Too many redirects"));
        return;
      }

      https
        .get(downloadUrl, (response) => {
          // Handle redirects (301, 302, 303, 307, 308)
          if (
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            console.log(`Redirecting to: ${response.headers.location}`);
            downloadFromUrl(response.headers.location, maxRedirects - 1);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed: HTTP ${response.statusCode}`));
            return;
          }

          const totalSize = parseInt(response.headers["content-length"] || "0");
          let downloadedSize = 0;

          response.on("data", (chunk) => {
            downloadedSize += chunk.length;
            if (totalSize > 0) {
              const progress = downloadedSize / totalSize;
              onProgress(progress);
            }
          });

          response.pipe(file);

          file.on("finish", () => {
            file.close();
            resolve();
          });

          file.on("error", (error) => {
            fs.unlink(filePath, () => {}); // Delete incomplete file
            reject(error);
          });
        })
        .on("error", (error) => {
          reject(error);
        });
    };

    downloadFromUrl(url);
  });
}

// Find run script
function findRunScript(comfyUIDir) {
  const possibleScripts = [
    "run_cpu.bat",
    "run_nvidia_gpu.bat",
    "run_nvidia_gpu_fast_fp16_accumulation.bat",
  ];

  for (const script of possibleScripts) {
    const scriptPath = path.join(comfyUIDir, script);
    if (fs.existsSync(scriptPath)) {
      return scriptPath;
    }
  }

  return null;
}

// Start ComfyUI
async function startComfyUI(scriptPath, sendLog) {
  return new Promise((resolve, reject) => {
    sendLog(`Executing startup script: ${scriptPath}`);

    const process = spawn(scriptPath, [], {
      cwd: path.dirname(scriptPath),
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let startupTimeout = setTimeout(() => {
      sendLog("ComfyUI startup timeout, but process is running in background");
      resolve();
    }, 30000); // 30 second timeout

    process.stdout.on("data", (data) => {
      const output = data.toString();
      sendLog(`ComfyUI: ${output.trim()}`);

      // Check if startup is successful
      if (
        output.includes("Starting server") ||
        output.includes("127.0.0.1:8188")
      ) {
        clearTimeout(startupTimeout);
        sendLog("ComfyUI service started successfully!");
        resolve();
      }
    });

    process.stderr.on("data", (data) => {
      const output = data.toString();
      sendLog(`ComfyUI Error: ${output.trim()}`);
    });

    process.on("error", (error) => {
      clearTimeout(startupTimeout);
      sendLog(`Startup failed: ${error.message}`);
      reject(error);
    });

    // Detach process to run in background
    process.unref();
  });
}

// Update configuration, add ComfyUI models
async function updateConfigWithComfyUI() {
  try {
    // Call backend API to update configuration
    const response = await fetch(
      "http://127.0.0.1:57988/api/comfyui/update_config",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log(
        "ComfyUI configuration updated successfully:",
        result.message
      );
    } else {
      const error = await response.text();
      console.error("Configuration update failed:", error);
      throw new Error(`Configuration update failed: ${error}`);
    }
  } catch (error) {
    console.error("Configuration update failed:", error);
    throw error;
  }
}

// Find ComfyUI main directory (may be in subdirectory after extraction)
function findComfyUIMainDir(comfyUIDir) {
  const possibleDirs = ["ComfyUI-master", "ComfyUI-main"];

  for (const dir of possibleDirs) {
    const dirPath = path.join(comfyUIDir, dir);
    if (fs.existsSync(dirPath)) {
      return dirPath;
    }
  }

  return null;
}

// Start ComfyUI from source code
async function startComfyUIFromSource(comfyUIMainDir, sendLog) {
  return new Promise((resolve, reject) => {
    sendLog(`Starting ComfyUI from source: ${comfyUIMainDir}`);

    // Check if main.py file exists
    const mainPyPath = path.join(comfyUIMainDir, "main.py");
    if (!fs.existsSync(mainPyPath)) {
      reject(new Error("main.py file not found"));
      return;
    }

    // Use Python to start ComfyUI
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const process = spawn(
      pythonCmd,
      ["main.py", "--listen", "127.0.0.1", "--port", "8188"],
      {
        cwd: comfyUIMainDir,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let startupTimeout = setTimeout(() => {
      sendLog("ComfyUI startup timeout, but process is running in background");
      resolve();
    }, 60000); // 60 second timeout, as first startup may need to download models

    process.stdout.on("data", (data) => {
      const output = data.toString();
      sendLog(`ComfyUI: ${output.trim()}`);

      // Check if startup is successful
      if (
        output.includes("Starting server") ||
        output.includes("127.0.0.1:8188") ||
        output.includes("To see the GUI go to")
      ) {
        clearTimeout(startupTimeout);
        sendLog("ComfyUI service started successfully!");
        resolve();
      }
    });

    process.stderr.on("data", (data) => {
      const output = data.toString();
      sendLog(`ComfyUI Error: ${output.trim()}`);
    });

    process.on("error", (error) => {
      clearTimeout(startupTimeout);
      sendLog(`Startup failed: ${error.message}`);
      reject(error);
    });

    // Detach process to run in background
    process.unref();
  });
}
