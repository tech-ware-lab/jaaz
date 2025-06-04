// comfyUIInstaller.js
const path = require('path')
const fs = require('fs')
const https = require('https')
const { spawn } = require('child_process')
const { createWriteStream } = require('fs')
const _7z = require('7zip-min')

// Check if running in worker process
const isWorkerProcess =
  process.send !== undefined || process.env.IS_WORKER_PROCESS === 'true'

// Import electron modules only if not in worker process
let app, BrowserWindow
if (!isWorkerProcess) {
  const electron = require('electron')
  app = electron.app
  BrowserWindow = electron.BrowserWindow
}

// Global cancellation flag
let installationCancelled = false
let currentDownloadRequest = null
let currentChildProcess = null

// Global ComfyUI process management
let comfyUIProcess = null
let comfyUIProcessPid = null

/**
 * Get user data directory
 * @returns {string} - User data directory path
 */
function getUserDataDir() {
  if (isWorkerProcess) {
    // In worker process, use environment variable
    return process.env.USER_DATA_DIR
  } else {
    // In main process, use app.getPath
    return app.getPath('userData')
  }
}

/**
 * Cancel the current ComfyUI installation
 */
function cancelInstallation() {
  console.log('🦄 Cancelling ComfyUI installation...')
  installationCancelled = true

  // Cancel ongoing download
  if (currentDownloadRequest) {
    currentDownloadRequest.destroy()
    currentDownloadRequest = null
  }

  // Kill child processes
  if (currentChildProcess) {
    currentChildProcess.kill('SIGTERM')
    currentChildProcess = null
  }

  sendCancelled('Installation cancelled by user')
}

/**
 * Reset cancellation state
 */
function resetCancellationState() {
  installationCancelled = false
  currentDownloadRequest = null
  currentChildProcess = null
}

/**
 * Check if installation is cancelled
 * @returns {boolean} - True if cancelled
 */
function isInstallationCancelled() {
  return installationCancelled
}

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
 * Send progress update to main window or parent process
 * @param {number} percent - Progress percentage
 * @param {string} status - Status message
 */
function sendProgress(percent, status) {
  if (isWorkerProcess) {
    // In worker process, send to parent process
    if (process.send) {
      process.send({
        type: 'progress',
        percent: percent,
        status: status,
      })
    }
  } else {
    // In main process, send to renderer
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        window.dispatchEvent(new CustomEvent('comfyui-install-progress', {
          detail: { percent: ${percent}, status: "${status.replace(
        /"/g,
        '\\"'
      )}" }
        }));
      `)
    }
  }
}

/**
 * Send log message to main window or parent process
 * @param {string} message - Log message
 */
function sendLog(message) {
  if (isWorkerProcess) {
    // In worker process, send to parent process
    if (process.send) {
      process.send({
        type: 'log',
        message: message,
      })
    }
  } else {
    // In main process, send to renderer
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        window.dispatchEvent(new CustomEvent('comfyui-install-log', {
          detail: { message: "${message.replace(/"/g, '\\"')}" }
        }));
      `)
    }
  }
  console.log(`[ComfyUI Install] ${message}`)
}

/**
 * Send error message to main window or parent process
 * @param {string} error - Error message
 */
function sendError(error) {
  const errorMessage = error || 'Unknown error occurred'

  if (isWorkerProcess) {
    // In worker process, send to parent process
    if (process.send) {
      process.send({
        type: 'error',
        error: errorMessage,
      })
    }
  } else {
    // In main process, send to renderer
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        window.dispatchEvent(new CustomEvent('comfyui-install-error', {
          detail: { error: "${errorMessage.replace(/"/g, '\\"')}" }
        }));
      `)
    }
  }
}

/**
 * Send cancellation message to main window or parent process
 * @param {string} message - Cancellation message
 */
function sendCancelled(message) {
  const cancelMessage = message || 'Installation cancelled'

  if (isWorkerProcess) {
    // In worker process, send to parent process
    if (process.send) {
      process.send({
        type: 'cancelled',
        message: cancelMessage,
      })
    }
  } else {
    // In main process, send to renderer
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        window.dispatchEvent(new CustomEvent('comfyui-install-cancelled', {
          detail: { message: "${cancelMessage.replace(/"/g, '\\"')}" }
        }));
      `)
    }
  }
  console.log(`[ComfyUI Install Cancelled] ${cancelMessage}`)
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
    // Check cancellation before starting
    if (isInstallationCancelled()) {
      reject(new Error('Installation cancelled'))
      return
    }

    const file = createWriteStream(filePath)

    const downloadFromUrl = (downloadUrl, maxRedirects = 5) => {
      if (maxRedirects <= 0) {
        reject(new Error('Too many redirects'))
        return
      }

      // Check cancellation before each request
      if (isInstallationCancelled()) {
        file.close()
        fs.unlink(filePath, () => {}) // Delete incomplete file
        reject(new Error('Installation cancelled'))
        return
      }

      const req = https.get(downloadUrl, (response) => {
        // Store current request for cancellation
        currentDownloadRequest = req

        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${response.statusCode}`))
          return
        }

        const totalSize = parseInt(response.headers['content-length'] || '0')
        let downloadedSize = 0

        response.on('data', (chunk) => {
          // Check cancellation during download
          if (isInstallationCancelled()) {
            response.destroy()
            file.close()
            fs.unlink(filePath, () => {}) // Delete incomplete file
            reject(new Error('Installation cancelled'))
            return
          }

          downloadedSize += chunk.length
          if (totalSize > 0) {
            const progress = downloadedSize / totalSize
            onProgress(progress)
          }
        })

        response.pipe(file)

        file.on('finish', () => {
          file.close()
          currentDownloadRequest = null
          resolve()
        })

        file.on('error', (error) => {
          fs.unlink(filePath, () => {}) // Delete incomplete file
          reject(error)
        })
      })

      req.on('error', (error) => {
        reject(error)
      })

      req.setTimeout(30000, () => {
        req.destroy()
        reject(new Error('Download timeout'))
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
    'run_nvidia_gpu.bat',
    'run_nvidia_gpu_fast_fp16_accumulation.bat',
    'run_cpu.bat',
    'run.bat',
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
 * Check if ComfyUI is installed
 * @returns {boolean} - True if ComfyUI is installed
 */
function isComfyUIInstalled() {
  const userDataDir = getUserDataDir()
  if (!userDataDir) return false

  const comfyUIDir = path.join(userDataDir, 'comfyui')
  const comfyUIMainDir = findComfyUIMainDir(comfyUIDir)

  if (!comfyUIMainDir) return false

  // Only check if run script (bat file) exists
  const runScript = findRunScript(comfyUIMainDir)
  return !!runScript
}

/**
 * Start ComfyUI process
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function startComfyUIProcess() {
  try {
    // Check if already running
    if (comfyUIProcess && !comfyUIProcess.killed) {
      return { success: false, message: 'ComfyUI is already running' }
    }

    // Check if ComfyUI is installed
    if (!isComfyUIInstalled()) {
      return { success: false, message: 'ComfyUI is not installed' }
    }

    const userDataDir = getUserDataDir()
    const comfyUIDir = path.join(userDataDir, 'comfyui')
    const comfyUIMainDir = findComfyUIMainDir(comfyUIDir)

    console.log('🦄 Starting ComfyUI process...')

    // Only use bat script
    const runScript = findRunScript(comfyUIMainDir)
    if (!runScript) {
      return {
        success: false,
        message:
          'No run script (bat file) found. ComfyUI requires a bat script to start.',
      }
    }

    console.log(`🦄 Using run script: ${runScript}`)

    comfyUIProcess = spawn(runScript, [], {
      cwd: path.dirname(runScript),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    comfyUIProcessPid = comfyUIProcess.pid
    console.log(`🦄 ComfyUI process started with PID: ${comfyUIProcessPid}`)

    // Handle process output
    comfyUIProcess.stdout.on('data', (data) => {
      const output = data.toString()
      console.log(`[ComfyUI] ${output.trim()}`)
    })

    comfyUIProcess.stderr.on('data', (data) => {
      const output = data.toString()
      console.log(`[ComfyUI Error] ${output.trim()}`)
    })

    // Handle process exit
    comfyUIProcess.on('exit', (code, signal) => {
      console.log(
        `🦄 ComfyUI process exited with code ${code}, signal ${signal}`
      )
      comfyUIProcess = null
      comfyUIProcessPid = null
    })

    comfyUIProcess.on('error', (error) => {
      console.error(`🦄 ComfyUI process error: ${error.message}`)
      comfyUIProcess = null
      comfyUIProcessPid = null
    })

    // Detach process to run independently
    comfyUIProcess.unref()

    return { success: true, message: 'ComfyUI process started successfully' }
  } catch (error) {
    console.error('🦄 Failed to start ComfyUI process:', error)
    comfyUIProcess = null
    comfyUIProcessPid = null
    return {
      success: false,
      message: `Failed to start ComfyUI: ${error.message}`,
    }
  }
}

/**
 * Stop ComfyUI process
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function stopComfyUIProcess() {
  try {
    if (!comfyUIProcess || comfyUIProcess.killed) {
      return { success: false, message: 'ComfyUI process is not running' }
    }

    console.log(`🦄 Stopping ComfyUI process (PID: ${comfyUIProcessPid})...`)

    // Try graceful shutdown first
    comfyUIProcess.kill('SIGTERM')

    // Wait a bit for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Force kill if still running
    if (comfyUIProcess && !comfyUIProcess.killed) {
      console.log('🦄 Force killing ComfyUI process...')
      comfyUIProcess.kill('SIGKILL')
    }

    comfyUIProcess = null
    comfyUIProcessPid = null

    console.log('🦄 ComfyUI process stopped successfully')
    return { success: true, message: 'ComfyUI process stopped successfully' }
  } catch (error) {
    console.error('🦄 Failed to stop ComfyUI process:', error)
    return {
      success: false,
      message: `Failed to stop ComfyUI: ${error.message}`,
    }
  }
}

/**
 * Check if ComfyUI process is running
 * @returns {boolean} - True if ComfyUI process is running
 */
function isComfyUIProcessRunning() {
  return comfyUIProcess && !comfyUIProcess.killed
}

/**
 * Get ComfyUI process status
 * @returns {{running: boolean, pid?: number}}
 */
function getComfyUIProcessStatus() {
  return {
    running: isComfyUIProcessRunning(),
    pid: comfyUIProcessPid,
  }
}

/**
 * Install ComfyUI
 * @returns {Promise<{success: boolean}>} - Promise resolving to installation result
 */
async function installComfyUI() {
  console.log('🦄 Starting ComfyUI installation...')

  try {
    // Reset cancellation state at start
    resetCancellationState()

    // Get user data directory and temp directory
    const userDataDir = getUserDataDir()
    if (!userDataDir) {
      throw new Error('Unable to get user data directory')
    }

    const tempDir = path.join(userDataDir, 'temp')
    const comfyUIDir = path.join(userDataDir, 'comfyui')

    // Ensure directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    sendLog('Starting ComfyUI installation...')
    sendProgress(5, 'Fetching latest ComfyUI version...')

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
    }

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

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
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

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
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

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
    }

    sendProgress(75, 'Extracting installation package...')
    sendLog('Starting ComfyUI extraction...')

    // Extract files
    if (fs.existsSync(comfyUIDir)) {
      sendLog('Removing old ComfyUI directory...')
      fs.rmSync(comfyUIDir, { recursive: true, force: true })
    }

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
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

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
    }

    sendProgress(85, 'Configuring ComfyUI...')
    sendLog('Configuring ComfyUI environment...')

    // Find ComfyUI main directory (may be in subdirectory after extraction)
    const comfyUIMainDir = findComfyUIMainDir(comfyUIDir)
    if (!comfyUIMainDir) {
      throw new Error('ComfyUI main directory not found')
    }

    sendLog(`Found ComfyUI main directory: ${comfyUIMainDir}`)

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
    }

    sendProgress(90, 'Updating configuration...')
    sendLog('Updating application configuration...')

    // Update configuration, add ComfyUI as image model
    try {
      await updateConfigWithComfyUI()
      sendLog('Configuration updated successfully')
    } catch (error) {
      sendLog(`Configuration update failed: ${error.message}`)
      // Don't fail the installation if config update fails
    }

    // Check cancellation
    if (isInstallationCancelled()) {
      throw new Error('Installation cancelled')
    }

    sendProgress(100, 'Installation completed!')
    sendLog('ComfyUI installation completed successfully!')
    sendLog('ComfyUI is ready to use at http://127.0.0.1:8188')
    sendLog('You can now enable ComfyUI in settings to start the service.')

    return { success: true }
  } catch (error) {
    console.error('ComfyUI installation failed:', error)

    if (error.message === 'Installation cancelled') {
      sendCancelled('Installation was cancelled by user')
      return { cancelled: true }
    } else {
      sendError(error.message)
      throw error
    }
  }
}

// Worker process logic
if (isWorkerProcess) {
  console.log('🦄 ComfyUI install worker process started and ready')

  // Handle process messages
  process.on('message', async (message) => {
    if (message.type === 'start-install') {
      try {
        console.log('🦄 Starting ComfyUI installation in worker process...')
        const result = await installComfyUI()

        // Check if installation was cancelled
        if (result.cancelled) {
          process.send({
            type: 'install-cancelled',
            success: true,
            message: result.message || 'Installation cancelled',
          })
        } else {
          // Send success result back to main process
          process.send({
            type: 'install-complete',
            success: true,
            result: result,
          })
        }
      } catch (error) {
        console.error(
          '🦄 ComfyUI installation failed in worker process:',
          error
        )

        // Send error result back to main process
        process.send({
          type: 'install-error',
          success: false,
          error: error.message || 'Unknown error occurred',
        })
      }
    } else if (message.type === 'cancel-install') {
      console.log('🦄 Received cancellation request in worker process')
      cancelInstallation()

      process.send({
        type: 'install-cancelled',
        success: true,
        message: 'Installation cancelled',
      })
    }
  })

  // Handle process exit
  process.on('exit', (code) => {
    console.log(`🦄 ComfyUI install worker process exiting with code ${code}`)
  })

  process.on('SIGTERM', () => {
    console.log('🦄 ComfyUI install worker process received SIGTERM')
    process.exit(0)
  })

  process.on('SIGINT', () => {
    console.log('🦄 ComfyUI install worker process received SIGINT')
    process.exit(0)
  })
}

module.exports = {
  installComfyUI,
  cancelInstallation,
  resetCancellationState,
  isInstallationCancelled,
  getLatestComfyUIRelease,
  downloadFile,
  findComfyUIMainDir,
  findRunScript,
  startComfyUI,
  updateConfigWithComfyUI,
  isComfyUIInstalled,
  startComfyUIProcess,
  stopComfyUIProcess,
  isComfyUIProcessRunning,
  getComfyUIProcessStatus,
}
