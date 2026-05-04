import { autoUpdater, type UpdateInfo } from 'electron-updater'
import log from 'electron-log'
import { app, BrowserWindow, dialog } from 'electron'
import { APP_PROFILE } from '../shared/profile'
import { setConfig } from './utils'

let mainWin: BrowserWindow | null = null
let autoUpdateEnabled = true
let installPendingOnLaunch = false
let updateFlow: 'idle' | 'auto' | 'manual' = 'idle'

const send = (type: string, data?: any): void => {
  mainWin?.webContents.send('main:data', { type, data })
}

const setPendingInstall = async (value: boolean): Promise<void> => {
  installPendingOnLaunch = value
  await setConfig({ desktopAutoUpdateInstallOnLaunch: value })
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
    installUpdate()
  } else {
    await setPendingInstall(true)
  }
}

const runStartupAutoUpdate = async (): Promise<void> => {
  if (!app.isPackaged || !autoUpdateEnabled) return

  updateFlow = 'auto'
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    updateFlow = 'idle'
    log.warn('Auto update check failed:', err)
  }
}

export function initUpdater(
  window: BrowserWindow,
  options: { autoUpdateEnabled?: boolean; installPendingOnLaunch?: boolean } = {}
): void {
  mainWin = window
  autoUpdateEnabled = options.autoUpdateEnabled !== false
  installPendingOnLaunch = options.installPendingOnLaunch === true

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
    send('update:available', {
      version: info.version,
      releaseDate: info.releaseDate
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
      installUpdate()
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
  await autoUpdater.checkForUpdates()
}

export async function downloadUpdate(): Promise<void> {
  updateFlow = 'manual'
  await autoUpdater.downloadUpdate()
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true)
}
