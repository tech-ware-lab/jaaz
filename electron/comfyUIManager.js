// comfyUIManager.js - ComfyUI进程管理器
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

// Check if running in worker process
const isWorkerProcess =
  process.send !== undefined || process.env.IS_WORKER_PROCESS === 'true'

// Import electron modules only if not in worker process
let app
if (!isWorkerProcess) {
  const electron = require('electron')
  app = electron.app
}

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
 * Detect if NVIDIA GPU is available and has drivers
 * @returns {Promise<boolean>} - True if NVIDIA GPU is available
 */
async function detectNvidiaGPU() {
  return new Promise((resolve) => {
    try {
      // Try to run nvidia-smi to check for NVIDIA GPU
      const nvidiaSmi = spawn(
        'nvidia-smi',
        ['--query-gpu=name', '--format=csv,noheader'],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      )

      let hasOutput = false

      nvidiaSmi.stdout.on('data', (data) => {
        const output = data.toString().trim()
        if (output && !output.includes('No devices were found')) {
          hasOutput = true
        }
      })

      nvidiaSmi.on('close', (code) => {
        resolve(hasOutput && code === 0)
      })

      nvidiaSmi.on('error', () => {
        resolve(false)
      })

      // Timeout after 3 seconds
      setTimeout(() => {
        nvidiaSmi.kill()
        resolve(false)
      }, 3000)
    } catch (error) {
      resolve(false)
    }
  })
}

/**
 * Get preferred ComfyUI startup script based on GPU availability
 * @param {string} comfyUIMainDir - ComfyUI main directory
 * @returns {Promise<{script: string, mode: string}>}
 */
async function getPreferredStartupScript(comfyUIMainDir) {
  // Detect GPU support
  const hasNvidiaGPU = await detectNvidiaGPU()
  console.log(`🦄 NVIDIA GPU detected: ${hasNvidiaGPU}`)

  // Define script priority based on GPU availability
  const preferredScripts = hasNvidiaGPU
    ? [
        'run_nvidia_gpu.bat',
        'run_nvidia_gpu_fast_fp16_accumulation.bat',
        'run_cpu.bat',
      ]
    : [
        'run_cpu.bat',
        'run_nvidia_gpu.bat',
        'run_nvidia_gpu_fast_fp16_accumulation.bat',
      ]

  // Find the first available script
  for (const script of preferredScripts) {
    const scriptPath = path.join(comfyUIMainDir, script)
    if (fs.existsSync(scriptPath)) {
      const mode = script.includes('cpu') ? 'CPU' : 'GPU'
      console.log(`🦄 Selected startup script: ${script} (${mode} mode)`)
      return { script: scriptPath, mode }
    }
  }

  // Fallback to any available script
  const runScript = findRunScript(comfyUIMainDir)
  if (runScript) {
    const mode = runScript.includes('cpu') ? 'CPU' : 'GPU'
    console.log(`🦄 Fallback to: ${path.basename(runScript)} (${mode} mode)`)
    return { script: runScript, mode }
  }

  throw new Error('No startup script found')
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

    // Get preferred startup script
    const { script, mode } = await getPreferredStartupScript(comfyUIMainDir)

    console.log(`🦄 Startup mode: ${mode}`)

    let command, args, spawnOptions

    if (script) {
      console.log(`🦄 Using startup script: ${script}`)

      // On Windows, use cmd.exe to execute bat files
      const isWindows = process.platform === 'win32'
      if (isWindows) {
        command = 'cmd.exe'
        args = ['/c', script]

        // Windows-specific spawn options for silent execution
        spawnOptions = {
          cwd: path.dirname(script),
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true, // Hide CMD window
          shell: false, // Don't use shell to avoid extra window
        }
      } else {
        command = script
        args = []
        spawnOptions = {
          cwd: path.dirname(script),
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      }
    } else {
      throw new Error('No startup script found')
    }

    console.log(`🦄 Executing command: ${command} ${args.join(' ')}`)

    comfyUIProcess = spawn(command, args, spawnOptions)

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
      console.error(`🦄 Error details:`, error)
      comfyUIProcess = null
      comfyUIProcessPid = null
    })

    // Detach process to run independently
    comfyUIProcess.unref()

    // Wait a moment to see if the process starts successfully
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // Check if process is still running after 3 seconds
    if (comfyUIProcess && !comfyUIProcess.killed) {
      console.log(`🦄 ComfyUI process appears to be running successfully`)
      return {
        success: true,
        message: `ComfyUI started successfully in ${mode} mode`,
        mode: mode,
      }
    } else {
      console.log(`🦄 ComfyUI process failed to start or exited immediately`)
      return {
        success: false,
        message:
          'ComfyUI process failed to start or exited immediately. Check the logs for details.',
      }
    }
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

    const isWindows = process.platform === 'win32'

    if (isWindows) {
      // On Windows, use taskkill for more reliable process termination
      try {
        // First try graceful termination
        console.log('🦄 Attempting graceful shutdown...')
        const gracefulKill = spawn(
          'taskkill',
          ['/pid', comfyUIProcessPid.toString(), '/t'],
          {
            stdio: 'ignore',
            windowsHide: true,
          }
        )

        await new Promise((resolve) => {
          gracefulKill.on('close', resolve)
          setTimeout(resolve, 3000) // 3 second timeout
        })

        // Check if process is still running
        if (comfyUIProcess && !comfyUIProcess.killed) {
          console.log('🦄 Graceful shutdown failed, force killing...')
          const forceKill = spawn(
            'taskkill',
            ['/pid', comfyUIProcessPid.toString(), '/t', '/f'],
            {
              stdio: 'ignore',
              windowsHide: true,
            }
          )

          await new Promise((resolve) => {
            forceKill.on('close', resolve)
            setTimeout(resolve, 2000) // 2 second timeout
          })
        }
      } catch (killError) {
        console.log(
          '🦄 taskkill failed, using Node.js kill:',
          killError.message
        )
        // Fallback to Node.js kill
        comfyUIProcess.kill('SIGTERM')
        await new Promise((resolve) => setTimeout(resolve, 2000))

        if (comfyUIProcess && !comfyUIProcess.killed) {
          comfyUIProcess.kill('SIGKILL')
        }
      }
    } else {
      // Unix-like systems
      comfyUIProcess.kill('SIGTERM')
      await new Promise((resolve) => setTimeout(resolve, 3000))

      if (comfyUIProcess && !comfyUIProcess.killed) {
        console.log('🦄 Force killing ComfyUI process...')
        comfyUIProcess.kill('SIGKILL')
      }
    }

    // Clean up references
    comfyUIProcess = null
    comfyUIProcessPid = null

    console.log('🦄 ComfyUI process stopped successfully')
    return { success: true, message: 'ComfyUI process stopped successfully' }
  } catch (error) {
    console.error('🦄 Failed to stop ComfyUI process:', error)

    // Force cleanup even if stop failed
    comfyUIProcess = null
    comfyUIProcessPid = null

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

module.exports = {
  isComfyUIInstalled,
  startComfyUIProcess,
  stopComfyUIProcess,
  isComfyUIProcessRunning,
  getComfyUIProcessStatus,
  detectNvidiaGPU,
  getPreferredStartupScript,
  findComfyUIMainDir,
  findRunScript,
}
