import { ipcRenderer, contextBridge } from 'electron'

const api = {
  onSources: (callback: (sources: Array<{id: string, name: string, type: string, thumbnail: string | null}>) => void): (() => void) => {
    const handler = (_event: any, sources: any) => callback(sources)
    ipcRenderer.on('source-picker:sources', handler)
    return () => ipcRenderer.removeListener('source-picker:sources', handler)
  },
  select: (sourceId: string): void => {
    ipcRenderer.invoke('source-picker:select', sourceId)
  },
  cancel: (): void => {
    ipcRenderer.invoke('source-picker:cancel')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('sourcePickerAPI', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.sourcePickerAPI = api
}
