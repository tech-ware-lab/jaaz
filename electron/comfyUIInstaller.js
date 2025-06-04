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
 * Send progress update to main window
 * @param {number} percent - Progress percentage
 * @param {string} status - Status message
 */
function sendProgress(percent, status) {
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

/**
 * Send log message to main window
 * @param {string} message - Log message
 */
function sendLog(message) {
  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript(`
      window.dispatchEvent(new CustomEvent('comfyui-install-log', {
        detail: { message: "${message.replace(/"/g, '\\"')}" }
      }));
    `)
  }
  console.log(`[ComfyUI Install] ${message}`)
}

/**
 * Send error message to main window
 * @param {string} error - Error message
 */
function sendError(error) {
  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript(`
      window.dispatchEvent(new CustomEvent('comfyui-install-error', {
        detail: { error: "${error.replace(/"/g, '\\"')}" }
      }));
    `)
  }
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

  try {
    // Get user data directory and temp directory
    const userDataDir = app.getPath('userData')
    const tempDir = path.join(userDataDir, 'temp')
    const comfyUIDir = path.join(userDataDir, 'comfyui')

    // Ensure directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
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

    return { success: true }
  } catch (error) {
    console.error('ComfyUI installation failed:', error)
    sendError(error.message)
    throw error
  }
}

module.exports = {
  installComfyUI,
  getLatestComfyUIRelease,
  downloadFile,
  findComfyUIMainDir,
  findRunScript,
  startComfyUI,
  startComfyUIFromSource,
  updateConfigWithComfyUI,
}
