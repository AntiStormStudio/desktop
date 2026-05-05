import { autoUpdater, type UpdateInfo } from 'electron-updater'
import log from 'electron-log'
import * as fs from 'fs'
import { app, BrowserWindow, dialog } from 'electron'
import { APP_PROFILE } from '../shared/profile'
import { getConfig, setConfig } from './utils'

let mainWin: BrowserWindow | null = null
let autoUpdateEnabled = true
let installPendingOnLaunch = false
let updateFlow: 'idle' | 'auto' | 'manual' = 'idle'
let latestFeedInfo: DesktopUpdateInfo | null = null
let prepareToQuitForInstall: (() => Promise<void> | void) | null = null

type DesktopUpdateInfo = {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

const send = (type: string, data?: any): void => {
  mainWin?.webContents.send('main:data', { type, data })
}

const setPendingInstall = async (value: boolean): Promise<void> => {
  installPendingOnLaunch = value
  await setConfig({ desktopAutoUpdateInstallOnLaunch: value })
}

const normalizeReleaseNotes = (releaseNotes: unknown): string => {
  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const entry = item as { note?: unknown; text?: unknown; notes?: unknown }
          return String(entry.note ?? entry.text ?? entry.notes ?? '')
        }
        return ''
      })
      .filter(Boolean)
      .join('\n\n')
  }

  return typeof releaseNotes === 'string' ? releaseNotes : ''
}

const parseYamlScalar = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed.slice(1, -1)
    }
  }

  return trimmed
}

const parseGenericUpdateFeed = (content: string): DesktopUpdateInfo | null => {
  const result: Record<string, string> = {}
  let inFiles = false

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (trimmed === 'files:') {
      inFiles = true
      continue
    }

    if (inFiles && line.startsWith(' ')) continue
    inFiles = false

    const idx = trimmed.indexOf(':')
    if (idx === -1) continue

    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1)
    result[key] = parseYamlScalar(value)
  }

  const version = (result.version ?? '').trim()
  if (!version) return null

  return {
    version,
    releaseDate: result.releaseDate,
    releaseNotes: result.releaseNotes
  }
}

const getGenericFeedManifestUrl = (): string | null => {
  if (APP_PROFILE.updates.provider !== 'generic' || !APP_PROFILE.updates.url) return null

  const baseUrl = APP_PROFILE.updates.url.endsWith('/')
    ? APP_PROFILE.updates.url
    : `${APP_PROFILE.updates.url}/`
  const manifest = process.platform === 'darwin' ? 'latest-mac.yml' : 'latest.yml'
  return new URL(manifest, baseUrl).toString()
}

const getLatestGenericUpdateInfo = async (): Promise<DesktopUpdateInfo | null> => {
  const manifestUrl = getGenericFeedManifestUrl()
  if (!manifestUrl) return null

  const response = await fetch(manifestUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Update feed request failed: HTTP ${response.status}`)
  }

  const info = parseGenericUpdateFeed(await response.text())
  if (!info || info.version === '0.0.0') return null
  return info
}

const parseSparkReleaseVersion = (version: string): number[] | null => {
  const match = version
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})-t(\d{2})(\d{2})(\d{2})$/)
  if (!match) return null
  return match.slice(1).map((value) => Number(value))
}

const parseSemver = (version: string): number[] | null => {
  const match = version
    .trim()
    .replace(/^v/i, '')
    .match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
  if (!match) return null
  return match.slice(1).map((value) => Number(value))
}

const compareParts = (latest: number[], current: number[]): number => {
  const length = Math.max(latest.length, current.length)
  for (let i = 0; i < length; i += 1) {
    const left = latest[i] ?? 0
    const right = current[i] ?? 0
    if (left > right) return 1
    if (left < right) return -1
  }
  return 0
}

const compareUpdateVersions = (latest: string, current: string): number => {
  if (!latest || !current) return latest ? 1 : 0
  if (latest === current) return 0

  const latestSpark = parseSparkReleaseVersion(latest)
  const currentSpark = parseSparkReleaseVersion(current)
  if (latestSpark && currentSpark) return compareParts(latestSpark, currentSpark)
  if (latestSpark && !currentSpark) return 1
  if (!latestSpark && currentSpark) return -1

  const latestSemver = parseSemver(latest)
  const currentSemver = parseSemver(current)
  if (latestSemver && currentSemver) return compareParts(latestSemver, currentSemver)

  return latest.localeCompare(current, undefined, { numeric: true, sensitivity: 'base' })
}

const getCurrentDesktopUpdateState = async (): Promise<{
  version: string
  hasReleaseVersion: boolean
}> => {
  const config = await getConfig()
  const configuredVersion = (
    config.desktopUpdateVersion ||
    APP_PROFILE.updates.currentVersion ||
    ''
  ).trim()

  return {
    version: configuredVersion || app.getVersion(),
    hasReleaseVersion: Boolean(configuredVersion)
  }
}

const getInstalledBuildTimeMs = async (): Promise<number> => {
  const candidates = [process.execPath, app.getAppPath()]
  const mtimes = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        return (await fs.promises.stat(candidate)).mtimeMs
      } catch {
        return 0
      }
    })
  )

  return Math.max(...mtimes)
}

const shouldBootstrapCurrentFeedVersion = async (
  latestInfo: DesktopUpdateInfo
): Promise<boolean> => {
  if (!latestInfo.releaseDate) return false

  const releaseTimeMs = Date.parse(latestInfo.releaseDate)
  if (!Number.isFinite(releaseTimeMs)) return false

  const installedBuildTimeMs = await getInstalledBuildTimeMs()
  if (!installedBuildTimeMs) return false

  const sixHoursMs = 6 * 60 * 60 * 1000
  return installedBuildTimeMs >= releaseTimeMs - sixHoursMs
}

const persistInstalledUpdateInfo = async (): Promise<void> => {
  if (!latestFeedInfo?.version) return

  await setConfig({
    desktopUpdateVersion: latestFeedInfo.version,
    desktopUpdateReleaseDate: latestFeedInfo.releaseDate ?? '',
    desktopUpdateReleaseNotes: latestFeedInfo.releaseNotes ?? '',
    desktopAvailableUpdateVersion: '',
    desktopAvailableUpdateReleaseDate: '',
    desktopAvailableUpdateReleaseNotes: ''
  })
}

const persistAvailableUpdateInfo = async (info: DesktopUpdateInfo): Promise<void> => {
  if (!info.version) return

  await setConfig({
    desktopAvailableUpdateVersion: info.version,
    desktopAvailableUpdateReleaseDate: info.releaseDate ?? '',
    desktopAvailableUpdateReleaseNotes: info.releaseNotes ?? ''
  })
}

const clearAvailableUpdateInfo = async (): Promise<void> => {
  await setConfig({
    desktopAvailableUpdateVersion: '',
    desktopAvailableUpdateReleaseDate: '',
    desktopAvailableUpdateReleaseNotes: ''
  })
}

const checkForUpdatesWithDesktopVersion = async (flow: 'auto' | 'manual'): Promise<void> => {
  updateFlow = flow
  latestFeedInfo = null
  send('update:checking')

  try {
    const latestInfo = await getLatestGenericUpdateInfo()
    if (latestInfo) {
      latestFeedInfo = latestInfo
      const currentState = await getCurrentDesktopUpdateState()
      let currentVersion = currentState.version
      let comparison = compareUpdateVersions(latestInfo.version, currentVersion)

      if (
        comparison > 0 &&
        !currentState.hasReleaseVersion &&
        (await shouldBootstrapCurrentFeedVersion(latestInfo))
      ) {
        currentVersion = latestInfo.version
        comparison = 0
      }

      log.info(
        `Desktop update feed version=${latestInfo.version}, current=${currentVersion}, comparison=${comparison}`
      )

      if (comparison <= 0) {
        if (comparison === 0) {
          await setConfig({
            desktopUpdateVersion: latestInfo.version,
            desktopUpdateReleaseDate: latestInfo.releaseDate ?? '',
            desktopUpdateReleaseNotes: latestInfo.releaseNotes ?? '',
            desktopAvailableUpdateVersion: '',
            desktopAvailableUpdateReleaseDate: '',
            desktopAvailableUpdateReleaseNotes: ''
          })
        } else {
          await clearAvailableUpdateInfo()
        }
        updateFlow = 'idle'
        send('update:not-available', {
          version: latestInfo.version,
          currentVersion,
          releaseDate: latestInfo.releaseDate,
          releaseNotes: latestInfo.releaseNotes
        })
        return
      }
    }
  } catch (err) {
    log.warn('Failed to preflight desktop update feed:', err)
  }

  await autoUpdater.checkForUpdates()
}

const promptToInstallDownloadedUpdate = async (): Promise<void> => {
  const result = mainWin
    ? await dialog.showMessageBox(mainWin, {
        type: 'info',
        buttons: ['Update Now', 'Install on Next Launch'],
        defaultId: 0,
        cancelId: 1,
        title: `${APP_PROFILE.brand.name} Update Ready`,
        message: 'A new version has been downloaded.',
        detail:
          'Restart now to apply the update, or keep working and install it automatically the next time the app starts.'
      })
    : await dialog.showMessageBox({
        type: 'info',
        buttons: ['Update Now', 'Install on Next Launch'],
        defaultId: 0,
        cancelId: 1,
        title: `${APP_PROFILE.brand.name} Update Ready`,
        message: 'A new version has been downloaded.',
        detail:
          'Restart now to apply the update, or keep working and install it automatically the next time the app starts.'
      })

  if (result.response === 0) {
    await setPendingInstall(false)
    await installUpdate()
  } else {
    await setPendingInstall(true)
  }
}

const runStartupAutoUpdate = async (): Promise<void> => {
  if (!app.isPackaged || !autoUpdateEnabled) return

  updateFlow = 'auto'
  try {
    await checkForUpdatesWithDesktopVersion('auto')
  } catch (err) {
    updateFlow = 'idle'
    log.warn('Auto update check failed:', err)
  }
}

export function initUpdater(
  window: BrowserWindow,
  options: {
    autoUpdateEnabled?: boolean
    installPendingOnLaunch?: boolean
    prepareToQuitForInstall?: () => Promise<void> | void
  } = {}
): void {
  mainWin = window
  autoUpdateEnabled = options.autoUpdateEnabled !== false
  installPendingOnLaunch = options.installPendingOnLaunch === true
  prepareToQuitForInstall = options.prepareToQuitForInstall ?? null

  autoUpdater.logger = log
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  const updateProvider = APP_PROFILE.updates.provider as string
  if (updateProvider === 'generic' && APP_PROFILE.updates.url) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: APP_PROFILE.updates.url
    })
  } else if (updateProvider === 'github') {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: APP_PROFILE.updates.owner,
      repo: APP_PROFILE.updates.repo
    })
  }

  autoUpdater.on('checking-for-update', () => {
    send('update:checking')
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    latestFeedInfo = {
      version: latestFeedInfo?.version || info.version,
      releaseDate: latestFeedInfo?.releaseDate || info.releaseDate,
      releaseNotes: latestFeedInfo?.releaseNotes || normalizeReleaseNotes(info.releaseNotes)
    }
    persistAvailableUpdateInfo(latestFeedInfo).catch((err) => {
      log.warn('Failed to persist available desktop update info:', err)
    })

    send('update:available', {
      version: latestFeedInfo.version,
      releaseDate: latestFeedInfo.releaseDate,
      releaseNotes: latestFeedInfo.releaseNotes
    })

    if (updateFlow === 'auto') {
      autoUpdater.downloadUpdate().catch((err) => {
        updateFlow = 'idle'
        log.warn('Auto update download failed:', err)
        send('update:error', { message: err?.message ?? 'Update download failed' })
      })
    }
  })

  autoUpdater.on('update-not-available', (_info: UpdateInfo) => {
    updateFlow = 'idle'
    clearAvailableUpdateInfo().catch((err) => {
      log.warn('Failed to clear available desktop update info:', err)
    })
    send('update:not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    send('update:download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', async (_info: UpdateInfo) => {
    send('update:downloaded')
    const shouldInstallNow = updateFlow === 'auto' && installPendingOnLaunch
    const shouldPrompt = updateFlow === 'auto' && !installPendingOnLaunch
    updateFlow = 'idle'

    if (shouldInstallNow) {
      await setPendingInstall(false)
      await installUpdate()
      return
    }

    if (shouldPrompt) {
      await promptToInstallDownloadedUpdate()
    }
  })

  autoUpdater.on('error', (error: Error) => {
    updateFlow = 'idle'
    send('update:error', { message: error?.message ?? 'Update error' })
  })

  runStartupAutoUpdate()
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    log.info('Skipping update check — app is not packaged')
    send('update:not-available')
    return
  }
  updateFlow = 'manual'
  await checkForUpdatesWithDesktopVersion('manual')
}

export async function downloadUpdate(): Promise<void> {
  updateFlow = 'manual'
  await autoUpdater.downloadUpdate()
}

export async function installUpdate(): Promise<void> {
  await persistInstalledUpdateInfo()
  await prepareToQuitForInstall?.()
  autoUpdater.quitAndInstall(false, true)
}
