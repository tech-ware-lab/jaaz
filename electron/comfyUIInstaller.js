// comfyUIInstaller.js
const path = require('path')
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const https = require('https')
const { spawn } = require('child_process')
const { createWriteStream } = require('fs')
const _7z = require('7zip-min')

/**
 * Get the latest ComfyUI release information from GitHub
 * @returns {Promise<{version: string, downloadUrl: string}>} - Promise resolving to latest release info
 */
async function getLatestComfyUIRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/comfyanonymous/ComfyUI/releases/latest',
      method: 'GET',
      headers: {
        'User-Agent': 'Jaaz-App/1.0.0',
        Accept: 'application/vnd.github.v3+json',
      },
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const release = JSON.parse(data)

          if (res.statusCode !== 200) {
            reject(
              new Error(
                `GitHub API error: ${res.statusCode} - ${
                  release.message || 'Unknown error'
                }`
              )
            )
            return
          }

          // Find the Windows portable NVIDIA version
          const windowsPortableAsset = release.assets.find(
            (asset) =>
              asset.name.includes('windows_portable') &&
              asset.name.includes('nvidia') &&
              (asset.name.endsWith('.7z') || asset.name.endsWith('.zip'))
          )

          if (!windowsPortableAsset) {
            // Fallback to any Windows portable version
            const fallbackAsset = release.assets.find(
              (asset) =>
                asset.name.includes('windows_portable') &&
                (asset.name.endsWith('.7z') || asset.name.endsWith('.zip'))
            )

            if (!fallbackAsset) {
              reject(
                new Error(
                  'No suitable Windows portable version found in latest release'
                )
              )
              return
            }

            resolve({
              version: release.tag_name,
              downloadUrl: fallbackAsset.browser_download_url,
              fileName: fallbackAsset.name,
              size: fallbackAsset.size,
            })
            return
          }

          resolve({
            version: release.tag_name,
            downloadUrl: windowsPortableAsset.browser_download_url,
            fileName: windowsPortableAsset.name,
            size: windowsPortableAsset.size,
          })
        } catch (error) {
          reject(
            new Error(`Failed to parse GitHub API response: ${error.message}`)
          )
        }
      })
    })

    req.on('error', (error) => {
      reject(new Error(`GitHub API request failed: ${error.message}`))
    })

    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('GitHub API request timeout'))
    })

    req.end()
  })
}

/**
 * Create installation progress window
 * @returns {BrowserWindow} - Progress window instance
 */
function createProgressWindow() {
  const progressWindow = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Installing ComfyUI',
    resizable: false,
    minimizable: false,
    maximizable: false,
  })

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
  `

  // Load progress page
  progressWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(progressHtml)}`
  )

  return progressWindow
}

/**
 * Helper function to download files
 * @param {string} url - Download URL
 * @param {string} filePath - Local file path
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<void>}
 */
async function downloadFile(url, filePath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(filePath)

    const downloadFromUrl = (downloadUrl, maxRedirects = 5) => {
      if (maxRedirects <= 0) {
        reject(new Error('Too many redirects'))
        return
      }

      https
        .get(downloadUrl, (response) => {
          // Handle redirects (301, 302, 303, 307, 308)
          if (
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            console.log(`Redirecting to: ${response.headers.location}`)
            downloadFromUrl(response.headers.location, maxRedirects - 1)
            return
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed: HTTP ${response.statusCode}`))
            return
          }

          const totalSize = parseInt(response.headers['content-length'] || '0')
          let downloadedSize = 0

          response.on('data', (chunk) => {
            downloadedSize += chunk.length
            if (totalSize > 0) {
              const progress = downloadedSize / totalSize
              onProgress(progress)
            }
          })

          response.pipe(file)

          file.on('finish', () => {
            file.close()
            resolve()
          })

          file.on('error', (error) => {
            fs.unlink(filePath, () => {}) // Delete incomplete file
            reject(error)
          })
        })
        .on('error', (error) => {
          reject(error)
        })
    }

    downloadFromUrl(url)
  })
}

/**
 * Find ComfyUI main directory (may be in subdirectory after extraction)
 * @param {string} comfyUIDir - ComfyUI installation directory
 * @returns {string|null} - Main directory path or null if not found
 */
function findComfyUIMainDir(comfyUIDir) {
  const possibleDirs = ['ComfyUI_windows_portable']

  for (const dir of possibleDirs) {
    const dirPath = path.join(comfyUIDir, dir)
    if (fs.existsSync(dirPath)) {
      return dirPath
    }
  }

  return null
}

/**
 * Find run script
 * @param {string} comfyUIDir - ComfyUI directory
 * @returns {string|null} - Script path or null if not found
 */
function findRunScript(comfyUIDir) {
  const possibleScripts = [
    'run_cpu.bat',
    'run_nvidia_gpu.bat',
    'run_nvidia_gpu_fast_fp16_accumulation.bat',
  ]

  for (const script of possibleScripts) {
    const scriptPath = path.join(comfyUIDir, script)
    if (fs.existsSync(scriptPath)) {
      return scriptPath
    }
  }

  return null
}

/**
 * Start ComfyUI
 * @param {string} scriptPath - Script path
 * @param {Function} sendLog - Log callback
 * @returns {Promise<void>}
 */
async function startComfyUI(scriptPath, sendLog) {
  return new Promise((resolve, reject) => {
    sendLog(`Executing startup script: ${scriptPath}`)

    const process = spawn(scriptPath, [], {
      cwd: path.dirname(scriptPath),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let startupTimeout = setTimeout(() => {
      sendLog('ComfyUI startup timeout, but process is running in background')
      resolve()
    }, 30000) // 30 second timeout

    process.stdout.on('data', (data) => {
      const output = data.toString()
      sendLog(`ComfyUI: ${output.trim()}`)

      // Check if startup is successful
      if (
        output.includes('Starting server') ||
        output.includes('127.0.0.1:8188')
      ) {
        clearTimeout(startupTimeout)
        sendLog('ComfyUI service started successfully!')
        resolve()
      }
    })

    process.stderr.on('data', (data) => {
      const output = data.toString()
      sendLog(`ComfyUI Error: ${output.trim()}`)
    })

    process.on('error', (error) => {
      clearTimeout(startupTimeout)
      sendLog(`Startup failed: ${error.message}`)
      reject(error)
    })

    // Detach process to run in background
    process.unref()
  })
}

/**
 * Start ComfyUI from source code
 * @param {string} comfyUIMainDir - ComfyUI main directory
 * @param {Function} sendLog - Log callback
 * @returns {Promise<void>}
 */
async function startComfyUIFromSource(comfyUIMainDir, sendLog) {
  return new Promise((resolve, reject) => {
    sendLog(`Starting ComfyUI from source: ${comfyUIMainDir}`)

    // Check if main.py file exists
    const mainPyPath = path.join(comfyUIMainDir, 'main.py')
    if (!fs.existsSync(mainPyPath)) {
      reject(new Error('main.py file not found'))
      return
    }

    // Use Python to start ComfyUI
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
    const process = spawn(
      pythonCmd,
      ['main.py', '--listen', '127.0.0.1', '--port', '8188'],
      {
        cwd: comfyUIMainDir,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )

    let startupTimeout = setTimeout(() => {
      sendLog('ComfyUI startup timeout, but process is running in background')
      resolve()
    }, 60000) // 60 second timeout, as first startup may need to download models

    process.stdout.on('data', (data) => {
      const output = data.toString()
      sendLog(`ComfyUI: ${output.trim()}`)

      // Check if startup is successful
      if (
        output.includes('Starting server') ||
        output.includes('127.0.0.1:8188') ||
        output.includes('To see the GUI go to')
      ) {
        clearTimeout(startupTimeout)
        sendLog('ComfyUI service started successfully!')
        resolve()
      }
    })

    process.stderr.on('data', (data) => {
      const output = data.toString()
      sendLog(`ComfyUI Error: ${output.trim()}`)
    })

    process.on('error', (error) => {
      clearTimeout(startupTimeout)
      sendLog(`Startup failed: ${error.message}`)
      reject(error)
    })

    // Detach process to run in background
    process.unref()
  })
}

/**
 * Update configuration, add ComfyUI models
 * @returns {Promise<void>}
 */
async function updateConfigWithComfyUI() {
  try {
    // Call backend API to update configuration
    const response = await fetch(
      'http://127.0.0.1:57988/api/comfyui/update_config',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    if (response.ok) {
      const result = await response.json()
      console.log('ComfyUI configuration updated successfully:', result.message)
    } else {
      const error = await response.text()
      console.error('Configuration update failed:', error)
      throw new Error(`Configuration update failed: ${error}`)
    }
  } catch (error) {
    console.error('Configuration update failed:', error)
    throw error
  }
}

/**
 * Install ComfyUI
 * @returns {Promise<{success: boolean}>} - Promise resolving to installation result
 */
async function installComfyUI() {
  console.log('🦄 Starting ComfyUI installation...')

  // Create installation progress window
  const progressWindow = createProgressWindow()

  try {
    // Get user data directory and temp directory
    const userDataDir = app.getPath('userData')
    const tempDir = path.join(userDataDir, 'temp')
    const comfyUIDir = path.join(userDataDir, 'comfyui')

    // Ensure directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    // Send log messages to progress window
    const sendProgress = (percent, status) => {
      progressWindow.webContents.executeJavaScript(`
        updateProgress(${percent});
        updateStatus("${status}");
      `)
    }

    const sendLog = (message) => {
      progressWindow.webContents.executeJavaScript(`
        addLog("${message.replace(/"/g, '\\"')}");
      `)
      console.log(`[ComfyUI Install] ${message}`)
    }

    sendLog('Starting ComfyUI installation...')
    sendProgress(5, 'Fetching latest ComfyUI version...')

    // Get latest ComfyUI release information
    let releaseInfo
    try {
      sendLog('Fetching latest ComfyUI release from GitHub...')
      releaseInfo = await getLatestComfyUIRelease()
      sendLog(`Found latest version: ${releaseInfo.version}`)
      sendLog(
        `Download file: ${releaseInfo.fileName} (${Math.round(
          releaseInfo.size / 1024 / 1024
        )}MB)`
      )
    } catch (error) {
      sendLog(`Failed to fetch latest release: ${error.message}`)
      sendLog('Falling back to default version...')
      // Fallback to hardcoded version
      releaseInfo = {
        version: 'v0.3.39',
        downloadUrl:
          'https://github.com/comfyanonymous/ComfyUI/releases/download/v0.3.39/ComfyUI_windows_portable_nvidia.7z',
        fileName: 'ComfyUI_windows_portable_nvidia.7z',
      }
    }

    sendProgress(10, 'Checking existing files...')

    const zipPath = path.join(tempDir, releaseInfo.fileName)

    // Check if already downloaded
    let shouldDownload = true
    if (fs.existsSync(zipPath)) {
      sendLog('Found existing installation package, checking integrity...')
      try {
        const stats = fs.statSync(zipPath)
        if (stats.size > 1000000) {
          // At least 1MB, simple integrity check
          sendLog('Installation package is complete, skipping download')
          shouldDownload = false
        } else {
          sendLog('Installation package is incomplete, re-downloading')
          fs.unlinkSync(zipPath)
        }
      } catch (error) {
        sendLog('Error checking installation package, re-downloading')
        shouldDownload = true
      }
    }

    if (shouldDownload) {
      sendProgress(15, 'Starting ComfyUI download...')
      sendLog(
        `Downloading ComfyUI ${releaseInfo.version} from ${releaseInfo.downloadUrl}...`
      )

      await downloadFile(releaseInfo.downloadUrl, zipPath, (progress) => {
        const percent = 15 + progress * 60 // 15-75% for download
        sendProgress(percent, `Downloading... ${Math.round(progress * 100)}%`)
      })

      sendLog('Download completed')
    }

    sendProgress(75, 'Extracting installation package...')
    sendLog('Starting ComfyUI extraction...')

    // Extract files
    if (fs.existsSync(comfyUIDir)) {
      sendLog('Removing old ComfyUI directory...')
      fs.rmSync(comfyUIDir, { recursive: true, force: true })
    }

    try {
      // ComfyUI packages are only available in 7z format
      sendLog('Extracting 7z archive...')
      await _7z.unpack(zipPath, comfyUIDir)
      sendLog('Extraction completed')
    } catch (error) {
      sendLog(`Extraction failed: ${error.message}`)
      throw error
    }

    sendProgress(90, 'Configuring ComfyUI...')
    sendLog('Configuring ComfyUI environment...')

    // Find ComfyUI main directory (may be in subdirectory after extraction)
    const comfyUIMainDir = findComfyUIMainDir(comfyUIDir)
    if (!comfyUIMainDir) {
      throw new Error('ComfyUI main directory not found')
    }

    sendLog(`Found ComfyUI main directory: ${comfyUIMainDir}`)

    sendProgress(95, 'Updating configuration...')
    sendLog('Updating application configuration...')

    // Update configuration, add ComfyUI as image model
    await updateConfigWithComfyUI()

    sendProgress(100, 'Installation completed!')
    sendLog('ComfyUI installation successful!')
    sendLog('You can now use local ComfyUI for image generation.')

    // Close progress window after 3 seconds
    setTimeout(() => {
      progressWindow.close()
    }, 3000)

    return { success: true }
  } catch (error) {
    console.error('ComfyUI installation failed:', error)

    // Show error message
    progressWindow.webContents.executeJavaScript(`
      updateStatus("Installation failed: ${error.message}");
      addLog("Error: ${error.message}");
    `)

    // Close window after 5 seconds
    setTimeout(() => {
      progressWindow.close()
    }, 5000)

    throw error
  }
}

module.exports = {
  installComfyUI,
  getLatestComfyUIRelease,
  createProgressWindow,
  downloadFile,
  findComfyUIMainDir,
  findRunScript,
  startComfyUI,
  startComfyUIFromSource,
  updateConfigWithComfyUI,
}
