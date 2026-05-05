// @ts-nocheck

import crypto from 'crypto'
import log from 'electron-log'
import { spawn } from 'child_process'
import {
  getPythonPath,
  getConfig,
  setConfig,
  installPython,
  installPackage,
  isPackageInstalled,
  isPythonInstalled,
  isUvInstalled,
  portInUse
} from './index'
import { ServiceLock, isProcessAlive } from './service-lock'

// ─── State ──────────────────────────────────────────────

let ptyProcess: any | null = null
let pid: number | null = null
let url: string | null = null
let apiKey: string | null = null
let status: string | null = null // null | starting | started | stopped | failed
let logBuffer: string[] = []
let ptyModule: any = null

const getPty = async () => {
  if (!ptyModule) ptyModule = await import('node-pty')
  return ptyModule
}

const lock = new ServiceLock('open-terminal')

const OPEN_TERMINAL_STARTUP_TIMEOUT_MS = 30_000

const createPipeProcessAdapter = (child: any) => {
  const listeners = new Set<(data: string) => void>()
  const forward = (data: Buffer | string) => {
    const chunk = data.toString()
    for (const listener of listeners) listener(chunk)
  }

  child.stdout?.on('data', forward)
  child.stderr?.on('data', forward)
  child.on('error', (error: Error) => {
    forward(`Failed to start process: ${error.message}\n`)
  })

  return {
    pid: child.pid,
    kill: () => child.kill(),
    onData: (listener: (data: string) => void) => {
      listeners.add(listener)
      return { dispose: () => listeners.delete(listener) }
    },
    onExit: (listener: (event: { exitCode: number | null; signal?: string | null }) => void) => {
      child.once('exit', (exitCode: number | null, signal: string | null) => {
        listener({ exitCode, signal })
      })
    }
  }
}

const spawnOpenTerminalProcess = async (
  pythonPath: string,
  commandArgs: string[],
  env: Record<string, string>
) => {
  try {
    const pty = await getPty()
    return pty.spawn(pythonPath, commandArgs, {
      name: 'xterm-256color',
      cols: 200,
      rows: 50,
      env
    })
  } catch (error) {
    log.warn(
      `Open Terminal PTY spawn failed; falling back to child_process.spawn: ${error?.message ?? error}`
    )
    const child = spawn(pythonPath, commandArgs, {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    return createPipeProcessAdapter(child)
  }
}

const waitForOpenTerminalReady = async (
  host: string,
  port: number,
  getExited: () => boolean
): Promise<void> => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < OPEN_TERMINAL_STARTUP_TIMEOUT_MS) {
    if (getExited()) {
      const tail = logBuffer.join('').slice(-1200).trim()
      throw new Error(
        `Open Terminal exited before it was ready.${tail ? ` Last output: ${tail}` : ''}`
      )
    }
    if (await portInUse(port, host)) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error('Timed out waiting for Open Terminal to start.')
}

// ─── Public API ─────────────────────────────────────────

export const getOpenTerminalInfo = () => ({
  url,
  apiKey,
  status,
  pid
})

export const getOpenTerminalPty = (): any | null => ptyProcess
export const getOpenTerminalLog = (): string[] => logBuffer

export const installOpenTerminal = async (
  version?: string,
  onStatus?: (status: string) => void,
  force = false
): Promise<boolean> => {
  if (!isPythonInstalled() || !isUvInstalled()) {
    onStatus?.('Installing Python runtime…')
    await installPython(undefined, onStatus)
  }

  if (isPackageInstalled('open-terminal') && !version && !force) {
    onStatus?.('Open Terminal is already installed.')
    return true
  }

  onStatus?.('Installing Open Terminal…')
  return installPackage('open-terminal', version, onStatus)
}

export const startOpenTerminal = async (
  port: number | null = null
): Promise<{ url: string; apiKey: string; pid: number }> => {
  if (!lock.acquire()) {
    return { url, apiKey, pid }
  }

  await stopOpenTerminal(false)

  try {
    if (!isPackageInstalled('open-terminal')) {
      log.info('open-terminal not installed, attempting install...')
      const config = await getConfig()
      await installOpenTerminal(config?.openTerminal?.version || undefined)
    }
  } catch (err) {
    lock.release()
    throw new Error(
      `Open Terminal is not installed and auto-install failed. ` +
        `Please connect to the internet and try again. (${err?.message ?? err})`
    )
  }

  const pythonPath = getPythonPath()
  const host = '127.0.0.1'
  const config = await getConfig()
  const configEnvVars = config.envVars ?? {}

  // Use persisted API key or generate and save a new one
  let generatedKey = config.openTerminal?.apiKey
  if (!generatedKey) {
    generatedKey = crypto.randomBytes(24).toString('base64url')
    await setConfig({
      openTerminal: { ...config.openTerminal, apiKey: generatedKey }
    })
  }

  // Find available port
  let desiredPort = port || 39284
  let availablePort = desiredPort
  while (await portInUse(availablePort, host)) {
    availablePort++
    if (availablePort > desiredPort + 100) {
      throw new Error('No available port found for Open Terminal')
    }
  }

  const cwd = config.openTerminal?.cwd || require('os').homedir()

  const commandArgs = [
    '-m',
    'uv',
    'run',
    'open-terminal',
    'run',
    '--host',
    host,
    '--port',
    availablePort.toString(),
    '--api-key',
    generatedKey,
    '--cwd',
    cwd
  ]

  log.info('Starting Open Terminal...', pythonPath, commandArgs.join(' '))

  let spawned: any
  const spawnEnv = {
    ...process.env,
    ...(configEnvVars ?? {}),
    PYTHONUNBUFFERED: '1',
    ...(process.platform === 'win32' ? { PYTHONIOENCODING: 'utf-8' } : {})
  }
  try {
    spawned = await spawnOpenTerminalProcess(pythonPath, commandArgs, spawnEnv)
  } catch (error) {
    lock.release()
    throw new Error(`Failed to spawn Open Terminal: ${error?.message ?? error}`)
  }

  const spawnedPid = spawned.pid
  logBuffer = []
  ptyProcess = spawned
  pid = spawnedPid
  apiKey = generatedKey
  status = 'starting'
  let exitedBeforeReady = false

  spawned.onData((data: string) => {
    logBuffer.push(data)
    log.info(`[OpenTerminal:${spawnedPid}] ${data.replace(/[\r\n]+/g, ' ').trim()}`)
  })

  spawned.onExit(({ exitCode, signal }) => {
    exitedBeforeReady = status === 'starting'
    log.info(`[OpenTerminal:${spawnedPid}] Exited code=${exitCode} signal=${signal}`)
    ptyProcess = null
    pid = null
    url = null
    apiKey = null
    status = 'stopped'
    lock.release()
  })

  const serverUrl = `http://${host}:${availablePort}`
  try {
    await waitForOpenTerminalReady(host, availablePort, () => exitedBeforeReady)
    url = serverUrl
    status = 'started'
    log.info(`Open Terminal started — PID: ${spawnedPid}, URL: ${serverUrl}`)
  } catch (error) {
    try {
      spawned.kill()
    } catch {}
    ptyProcess = null
    pid = null
    url = null
    apiKey = null
    status = 'failed'
    lock.release()
    throw error
  }

  return { url: serverUrl, apiKey: generatedKey, pid: spawnedPid }
}

export const stopOpenTerminal = async (releaseLock = true): Promise<void> => {
  if (ptyProcess) {
    try {
      ptyProcess.kill()
    } catch (e) {
      log.warn('Failed to kill Open Terminal PTY:', e)
    }
    // Give it a moment to exit
    await new Promise((r) => setTimeout(r, 1000))
    // Force kill if still running
    if (pid) {
      try {
        process.kill(pid, 0) // check alive
        process.kill(pid, 'SIGKILL')
      } catch {
        // already dead
      }
    }
  }
  ptyProcess = null
  pid = null
  url = null
  apiKey = null
  status = null
  logBuffer = []
  if (releaseLock) lock.release()
}

/**
 * Validate whether the tracked Open Terminal process is still alive.
 */
export const validateOpenTerminalProcess = (): boolean => {
  if (!pid) return false
  if (isProcessAlive(pid)) return true
  pid = null
  status = null
  lock.release()
  return false
}
