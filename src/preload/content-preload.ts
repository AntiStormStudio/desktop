import { ipcRenderer, contextBridge } from 'electron'
import { APP_PROFILE } from '../shared/profile'

// ─── Desktop ↔ Open WebUI Generic Protocol ──────────────
// This preload is a dumb relay. It passes typed {type, data}
// messages between the embedder (desktop renderer) and the
// Open WebUI page. Business logic lives elsewhere.
// To add new features, just add new event types — this file
// never needs to change.

type EventCallback = (data: any) => void
const eventCallbacks: EventCallback[] = []

// Embedder → Guest (push events from desktop)
ipcRenderer.on('desktop:event', (_event, data) => {
  eventCallbacks.forEach((cb) => cb(data))
})

// ─── Theme Sync: Open WebUI → Desktop ───────────────────
// Open WebUI calls window.applyTheme() after every theme change.
// We inject this hook so the desktop shell can mirror the theme.
contextBridge.exposeInMainWorld('applyTheme', () => {
  const theme = localStorage.getItem('theme') ?? 'system'
  ipcRenderer.sendToHost('webview:event', { type: 'theme:update', data: { theme } })
})

// Expose to the Open WebUI page via contextBridge (secure, unforgeable)
const desktopBridge = {
  // Push events: desktop → Open WebUI
  onEvent: (callback: EventCallback): void => {
    eventCallbacks.push(callback)
  },

  // Request/Response: Open WebUI → desktop
  send: (data: any): Promise<any> => {
    return new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2)
      const handler = (_event: any, response: any) => {
        if (response?._responseId === id) {
          ipcRenderer.removeListener('desktop:response', handler)
          resolve(response.data)
        }
      }
      ipcRenderer.on('desktop:response', handler)
      ipcRenderer.sendToHost('webview:send', { ...data, _requestId: id })
    })
  },

  // Navigation: Open WebUI → desktop
  load: (page: string): void => {
    ipcRenderer.sendToHost('webview:load', page)
  },

  invoke: (request: { capability: string; action?: string; payload?: any }): Promise<any> => {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2)
      const handler = (_event: any, response: any) => {
        if (response?._responseId !== id) return
        ipcRenderer.removeListener('desktop:response', handler)
        if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response.data)
        }
      }
      ipcRenderer.on('desktop:response', handler)
      ipcRenderer.sendToHost('webview:send', {
        type: 'desktop:invoke',
        capability: request.capability,
        action: request.action ?? 'default',
        payload: request.payload ?? null,
        _requestId: id
      })
    })
  }
}

if (APP_PROFILE.features.allowRemoteDesktopBridge) {
  contextBridge.exposeInMainWorld('electronAPI', desktopBridge)
  contextBridge.exposeInMainWorld('openWebUIDesktop', {
    version: 1,
    capabilities: {
      invoke: desktopBridge.invoke,
      onEvent: desktopBridge.onEvent
    },
    invoke: desktopBridge.invoke,
    onEvent: desktopBridge.onEvent
  })
}
