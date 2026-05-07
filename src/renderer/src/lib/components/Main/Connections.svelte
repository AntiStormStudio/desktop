<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { fade } from 'svelte/transition'
  import { connections, config, serverInfo, appState } from '../../stores'
  import i18n from '../../i18n'

  import Sidebar from './Connections/Sidebar.svelte'
  import Content from './Connections/Content.svelte'
  import LogPanel from './Connections/LogPanel.svelte'
  import { APP_PROFILE } from '../../profile'

  type BrowserTab = {
    id: string
    connectionId: string
    title: string
    initialUrl: string
    url: string
  }

  interface Props {
    onOpenSettings: () => void
    sidebarOpen: boolean
    activeConnectionName?: string
    browserTabs?: BrowserTab[]
    activeTabId?: string
  }

  let {
    onOpenSettings,
    sidebarOpen,
    activeConnectionName = $bindable(''),
    browserTabs = $bindable([]),
    activeTabId = $bindable('')
  }: Props = $props()

  let isLocalConnection = $state(false)
  let showingLogs = $state(false)

  let url = $state('')
  let connecting = $state(false)
  let error = $state('')
  let view = $state('welcome') // welcome | install | connected
  let autoInstall = $state(false)
  let installPhase = $state('idle') // idle | working | error
  let installError = $state('')
  let toastVisible = $state(false)
  let toastTimeout: ReturnType<typeof setTimeout> | null = null
  let installStatus = $state('')
  let settingsOpen = $state(false)
  let connectedUrl = $state('')
  let activeConnectionId = $state('')
  let connectingId = $state('')
  let localInstalled = $state(false)
  let showAddConnectionModal = $state(false)
  let splitTabIds = $state<string[]>([])

  // Active log panel
  let activeLog = $state<'server' | 'open-terminal' | 'llama-server' | null>(null)

  const serverStatus = $derived($serverInfo?.status)
  const serverReachable = $derived($serverInfo?.reachable)

  const isInitializing = $derived($appState === 'initializing')
  const hasLocal = $derived(($connections ?? []).some((c) => c.type === 'local'))
  const localConn = $derived(($connections ?? []).find((c) => c.type === 'local'))
  const remoteConnections = $derived(($connections ?? []).filter((c) => c.type !== 'local'))
  const activeTab = $derived(browserTabs.find((tab) => tab.id === activeTabId) ?? null)

  const getConnection = (id: string) => ($connections ?? []).find((conn) => conn.id === id)

  const getDefaultRemoteConnection = () => {
    const configuredDefault = getConnection($config?.defaultConnectionId ?? '')
    if (configuredDefault?.type === 'remote') return configuredDefault

    const profileDefault = remoteConnections.find(
      (conn) => conn.url === APP_PROFILE.features.defaultRemoteOpenWebUI
    )
    return profileDefault ?? remoteConnections[0] ?? null
  }

  const createTab = (connectionId: string, url: string, title?: string) => {
    const conn = getConnection(connectionId)
    const tab: BrowserTab = {
      id: crypto.randomUUID(),
      connectionId,
      initialUrl: url,
      url,
      title: title || conn?.name || $i18n.t('app.name')
    }
    browserTabs = [...browserTabs, tab]
    activeTabId = tab.id
    activeConnectionId = connectionId
    connectedUrl = url
    view = 'connected'
    if (
      openTerminalInfo?.status === 'started' &&
      openTerminalInfo?.url &&
      openTerminalInfo?.apiKey
    ) {
      requestAnimationFrame(() => publishDesktopLocalTerminal(openTerminalInfo))
    }
    return tab
  }

  const selectTab = (tabId: string) => {
    const tab = browserTabs.find((item) => item.id === tabId)
    if (!tab) return
    activeTabId = tab.id
    activeConnectionId = tab.connectionId
    connectedUrl = tab.url
    connectingId = ''
    view = 'connected'
  }

  const closeTab = (tabId: string) => {
    const index = browserTabs.findIndex((tab) => tab.id === tabId)
    if (index === -1) return
    const nextTabs = browserTabs.filter((tab) => tab.id !== tabId)
    browserTabs = nextTabs
    splitTabIds = splitTabIds.filter((id) => id !== tabId)

    if (activeTabId !== tabId) return

    const nextTab = nextTabs[Math.min(index, nextTabs.length - 1)]
    if (nextTab) {
      selectTab(nextTab.id)
    } else {
      const defaultRemote = getDefaultRemoteConnection()
      if (defaultRemote) {
        createTab(defaultRemote.id, defaultRemote.url)
      } else {
        disconnect()
      }
    }
  }

  const openNewTab = () => {
    const targetId =
      activeConnectionId ||
      $config?.defaultConnectionId ||
      remoteConnections[0]?.id ||
      (APP_PROFILE.features.allowLocalOpenWebUIInstall ? localConn?.id : '')
    if (!targetId) return

    const conn = getConnection(targetId)
    if (!conn) return
    if (conn.type === 'local') {
      if (!APP_PROFILE.features.allowLocalOpenWebUIInstall) return
      const existingUrl = activeTab?.connectionId === conn.id ? activeTab.url : connectedUrl
      if (existingUrl) createTab(conn.id, existingUrl)
      else connect(conn.id)
      return
    }

    createTab(conn.id, conn.url)
  }

  const splitTab = (tabId: string) => {
    if (!tabId || !browserTabs.some((tab) => tab.id === tabId)) return
    if (tabId === activeTabId) return
    if (splitTabIds.includes(tabId)) return
    if ([activeTabId, ...splitTabIds].filter(Boolean).length >= 4) return
    splitTabIds = [...splitTabIds, tabId]
  }

  const splitActiveWithNextTab = () => {
    const next = browserTabs.find((tab) => tab.id !== activeTabId && !splitTabIds.includes(tab.id))
    if (next) {
      splitTab(next.id)
      return
    }
    openNewTab()
  }

  const unsplitTab = (tabId: string) => {
    splitTabIds = splitTabIds.filter((id) => id !== tabId)
  }

  const updateTab = (tabId: string, patch: Partial<BrowserTab>) => {
    browserTabs = browserTabs.map((tab) => (tab.id === tabId ? { ...tab, ...patch } : tab))
    if (tabId === activeTabId) {
      const tab = browserTabs.find((item) => item.id === tabId)
      connectedUrl = tab?.url ?? connectedUrl
    }
  }

  const navigateTab = (tabId: string, nextUrl: string) => {
    updateTab(tabId, { url: nextUrl })
    requestAnimationFrame(() => {
      const wv = document.querySelector(`webview[data-tab-id="${tabId}"]`) as any
      if (!wv || typeof wv.loadURL !== 'function') return

      try {
        if (wv.getURL?.() !== nextUrl) {
          wv.loadURL(nextUrl)
        }
      } catch (error) {
        console.warn('Failed to navigate webview:', error)
      }
    })
  }

  // Open Terminal state
  let openTerminalStatus = $state<string | null>(null)
  let openTerminalInfo = $state<{ url?: string; apiKey?: string; status?: string } | null>(null)
  let pendingWebviewEvents: Array<{ event: any; connId?: string }> = []
  let pendingWebviewFlushTimer: ReturnType<typeof setTimeout> | null = null
  let pendingWebviewFlushAttempts = 0

  // Llama Server state
  let llamaCppStatus = $state<string | null>(null)
  let llamaCppInfo = $state<{ url?: string; pid?: number } | null>(null)
  let llamaCppSetupStatus = $state('')

  const startInstall = async (options?: {
    installOpenTerminal?: boolean
    installLlamaCpp?: boolean
    installDir?: string
  }) => {
    if (!APP_PROFILE.features.allowLocalOpenWebUIInstall) return
    installPhase = 'working'
    installError = ''
    installStatus = ''
    toastVisible = false
    try {
      // Save custom install directory before anything else
      if (options?.installDir) {
        const currentDir = await window.electronAPI.getInstallDir()
        if (options.installDir !== currentDir) {
          await window.electronAPI.setConfig({ installDir: options.installDir })
        }
      }

      // Check disk space before installing (minimum 5 GB)
      const MINIMUM_DISK_BYTES = 5 * 1024 * 1024 * 1024
      const disk = await window.electronAPI.getDiskSpace()
      if (disk?.free >= 0 && disk.free < MINIMUM_DISK_BYTES) {
        const availableGB = (disk.free / (1024 * 1024 * 1024)).toFixed(1)
        throw new Error(
          `Not enough disk space. At least 5 GB is required (${availableGB} GB available).`
        )
      }

      // Ensure Python and uv are installed before attempting package install
      const pythonReady = await window.electronAPI.getPythonStatus()
      if (!pythonReady) {
        const pythonOk = await window.electronAPI.installPython()
        if (!pythonOk) throw new Error('Failed to install Python. Please try again.')
      }

      const ok = await window.electronAPI.installPackage()
      if (!ok) throw new Error($i18n.t('error.installFailedGeneric'))

      // Start optional services after packages are installed to avoid
      // concurrent uv installs fighting over the lockfile
      if (options?.installOpenTerminal) {
        toggleOpenTerminal()
      }
      if (options?.installLlamaCpp) {
        toggleLlamaCpp()
      }

      installStatus = $i18n.t('main.install.startingServer')
      await window.electronAPI.startServer()
      const info = await window.electronAPI.getServerInfo()

      installStatus = $i18n.t('main.install.settingUpConnection')
      await window.electronAPI.addConnection({
        id: 'local',
        name: 'Local',
        type: 'local',
        url: info?.url || 'http://127.0.0.1:8080'
      })
      await window.electronAPI.setDefaultConnection('local')
      connections.set(await window.electronAPI.getConnections())
      config.set(await window.electronAPI.getConfig())

      // Wait for server to actually be reachable before showing connected view
      installStatus = $i18n.t('main.install.launchingOpenWebUI')
      const maxWait = 120000
      const pollInterval = 2000
      const startTime = Date.now()
      let reachable = false
      while (Date.now() - startTime < maxWait) {
        const si = await window.electronAPI.getServerInfo()
        if (si?.reachable) {
          reachable = true
          break
        }
        await new Promise((r) => setTimeout(r, pollInterval))
      }

      if (!reachable) {
        throw new Error('Server did not become reachable. Please try again.')
      }

      // Now connect — the server is ready
      installStatus = ''
      localInstalled = true
      connect('local')
      installPhase = 'idle'
    } catch (e: any) {
      installPhase = 'error'
      installError = e?.message || $i18n.t('error.somethingWentWrong')
      toastVisible = true
      if (toastTimeout) clearTimeout(toastTimeout)
      toastTimeout = setTimeout(() => {
        toastVisible = false
      }, 5000)
    }
  }

  const addConnection = async () => {
    if (!APP_PROFILE.features.allowUserRemoteOpenWebUI) {
      error = $i18n.t('setup.connectionManager.addDisabled')
      return
    }
    if (!url.trim()) return
    let u = url.trim()
    if (!u.startsWith('http')) u = 'https://' + u
    error = ''
    try {
      new URL(u)
    } catch {
      error = $i18n.t('setup.invalidUrl')
      return
    }
    connecting = true
    try {
      const valid = await window.electronAPI.validateUrl(u)
      if (!valid) {
        error = $i18n.t('setup.couldNotReachServer')
        connecting = false
        return
      }
      await window.electronAPI.addConnection({
        id: crypto.randomUUID(),
        name: new URL(u).hostname,
        type: 'remote',
        url: u
      })
      connections.set(await window.electronAPI.getConnections())
      config.set(await window.electronAPI.getConfig())
      url = ''
      error = ''
      showAddConnectionModal = false
      view = 'welcome'
    } catch {
      error = $i18n.t('setup.connectionFailed')
    } finally {
      connecting = false
    }
  }

  const connect = (id: string) => {
    showingLogs = false
    // Toggle: clicking the active connection unselects it
    if (activeConnectionId === id && view === 'connected') {
      connectingId = ''
      activeConnectionId = ''
      activeTabId = ''
      connectedUrl = ''
      view = 'welcome'
      return
    }
    // Persist as default so spotlight/startup always use the last-selected connection
    window.electronAPI.setDefaultConnection(id)
    // Already-open connection — just switch to its first tab
    const existingTab = browserTabs.find((tab) => tab.connectionId === id)
    if (existingTab) {
      connectingId = ''
      selectTab(existingTab.id)
      return
    }

    const conn = ($connections ?? []).find((c) => c.id === id)
    if (!conn) return

    activeConnectionId = id

    if (conn.type === 'local') {
      if (!APP_PROFILE.features.allowLocalOpenWebUIInstall) return
      // Local needs server start — use IPC
      connectingId = id
      view = 'welcome'
      window.electronAPI.connectTo(id).then((result: any) => {
        if (!result?.url) {
          if (connectingId === id) connectingId = ''
          return
        }
        if (connectingId === id) {
          const tab = createTab(result.connectionId, result.url)
          connectedUrl = tab.url
          activeConnectionId = result.connectionId
          connectingId = ''
          if (installPhase !== 'working') {
            view = 'connected'
          }
        }
      })
    } else {
      // Remote — open immediately, no IPC needed
      connectingId = ''
      createTab(id, conn.url)
    }
  }

  const disconnect = () => {
    activeConnectionId = ''
    activeTabId = ''
    connectedUrl = ''
    view = 'welcome'
  }

  const remove = async (id: string) => {
    await window.electronAPI.removeConnection(id)
    connections.set(await window.electronAPI.getConnections())
    config.set(await window.electronAPI.getConfig())
    if (activeConnectionId === id) {
      disconnect()
    }
    browserTabs = browserTabs.filter((tab) => tab.connectionId !== id)
  }

  // Sync active connection info to parent
  $effect(() => {
    const active = browserTabs.find((tab) => tab.id === activeTabId)
    if (active && activeConnectionId !== active.connectionId) {
      activeConnectionId = active.connectionId
      connectedUrl = active.url
    }
    const conn = ($connections ?? []).find((c) => c.id === activeConnectionId)
    activeConnectionName = conn?.name ?? ''
    isLocalConnection = conn?.type === 'local'
  })

  // React to showingLogs from parent — open the server log panel
  // Only react when parent sets showingLogs to true; don't close on false
  // (the status bar manages its own open/close via activeLog)
  $effect(() => {
    if (showingLogs) {
      activeLog = 'server'
    }
  })

  // Sync back: when panel closes, tell parent
  $effect(() => {
    if (activeLog === null) {
      showingLogs = false
    }
  })

  const openOfficialWebsite = () => {
    settingsOpen = false
    window.electronAPI?.openInBrowser?.(APP_PROFILE.brand.officialWebsiteUrl)
  }

  // ── Log panel PTY helpers ─────────────────────────────
  const getConnectPty = (log: string) => {
    return (callback: (data: string) => void) => {
      if (log === 'server') {
        window.electronAPI.connectPty(callback)
      } else if (log === 'open-terminal') {
        window.electronAPI.connectOpenTerminalPty(callback)
      } else if (log === 'llama-server') {
        window.electronAPI.connectLlamaCppPty(callback)
      }
    }
  }

  const getDisconnectPty = (log: string) => {
    return () => {
      if (log === 'server') {
        window.electronAPI.disconnectPty()
      } else if (log === 'open-terminal') {
        window.electronAPI?.disconnectOpenTerminalPty?.()
      } else if (log === 'llama-server') {
        window.electronAPI?.disconnectLlamaCppPty?.()
      }
    }
  }

  const getOnWrite = (log: string) => {
    if (log === 'server') {
      return (data: string) => window.electronAPI.writePty(data)
    }
    return undefined
  }

  const getOnResize = (log: string) => {
    if (log === 'server') {
      return (cols: number, rows: number) => window.electronAPI.resizePty(cols, rows)
    }
    return undefined
  }

  // ── Webview event delivery ─────────────────────────────
  // Single path: all events from the main process flow through here.
  // Query events target a specific webview; everything else broadcasts.
  const sendToWebview = (event: any, connId?: string) => {
    const container = document.querySelector('.content-webview-container')
    if (!container) {
      pendingWebviewEvents.push({ event, connId })
      schedulePendingWebviewFlush()
      return
    }

    let webviews: any[] = []
    if (connId) {
      const active = container.querySelector(
        `webview[data-tab-id="${activeTabId}"][data-connection-id="${connId}"]`
      ) as any
      const first = container.querySelector(`webview[data-connection-id="${connId}"]`) as any
      webviews = [active || first].filter(Boolean)
    } else {
      webviews = Array.from(container.querySelectorAll('webview'))
    }

    if (webviews.length === 0) {
      pendingWebviewEvents.push({ event, connId })
      schedulePendingWebviewFlush()
      return
    }

    for (const wv of webviews) {
      try {
        // Attempt to send — throws if webview hasn't fired dom-ready yet
        wv.send('desktop:event', event)
      } catch {
        // Webview not ready — queue delivery until dom-ready
        const onReady = () => {
          wv.removeEventListener('dom-ready', onReady)
          try {
            wv.send('desktop:event', event)
          } catch (_) {}
        }
        wv.addEventListener('dom-ready', onReady)
      }
    }
  }

  const flushPendingWebviewEvents = () => {
    if (pendingWebviewEvents.length === 0) return
    const pending = pendingWebviewEvents
    pendingWebviewEvents = []

    for (const item of pending) {
      sendToWebview(item.event, item.connId)
    }

    if (pendingWebviewEvents.length === 0) {
      pendingWebviewFlushAttempts = 0
    } else {
      schedulePendingWebviewFlush()
    }
  }

  const schedulePendingWebviewFlush = () => {
    if (pendingWebviewFlushTimer || pendingWebviewFlushAttempts >= 40) return
    pendingWebviewFlushAttempts += 1
    pendingWebviewFlushTimer = setTimeout(() => {
      pendingWebviewFlushTimer = null
      flushPendingWebviewEvents()
    }, 100)
  }

  onDestroy(() => {
    if (pendingWebviewFlushTimer) {
      clearTimeout(pendingWebviewFlushTimer)
      pendingWebviewFlushTimer = null
    }
  })

  function publishDesktopLocalTerminal(info: any, action: 'add' | 'remove' = 'add') {
    if (!info?.url) return
    sendToWebview({
      type: 'connections:terminal',
      data: {
        action,
        url: info.url,
        key: info.apiKey ?? '',
        name: '本机终端',
        provider: 'desktop-local',
        managed_by: 'desktop',
        config: {
          provider: 'desktop-local',
          managed_by: 'desktop',
          runtime: 'open-terminal'
        }
      }
    })
  }

  // Listen for events from main process
  onMount(() => {
    const handleNewTab = () => openNewTab()
    const handleSwitchTab = (event: Event) => {
      const tabId = (event as CustomEvent).detail?.tabId
      if (tabId) selectTab(tabId)
    }
    const handleCloseTab = (event: Event) => {
      const tabId = (event as CustomEvent).detail?.tabId
      if (tabId) closeTab(tabId)
    }
    const handleSplitTab = (event: Event) => {
      const tabId = (event as CustomEvent).detail?.tabId
      if (tabId) splitTab(tabId)
    }
    const handleSplitActive = () => splitActiveWithNextTab()

    window.addEventListener('spark-tabs:new', handleNewTab)
    window.addEventListener('spark-tabs:switch', handleSwitchTab)
    window.addEventListener('spark-tabs:close', handleCloseTab)
    window.addEventListener('spark-tabs:split', handleSplitTab)
    window.addEventListener('spark-tabs:split-active', handleSplitActive)

    window.electronAPI.onData((data: any) => {
      // ── Connection opened (startup, tray click) ───────
      if (data.type === 'connection:open' && data.data?.url) {
        const connId = data.data.connectionId ?? ''
        const incomingUrl = data.data.url
        const tab = browserTabs.find((item) => item.connectionId === connId)
        if (tab) {
          selectTab(tab.id)
        } else {
          createTab(connId, incomingUrl)
        }
        if (installPhase !== 'working') view = 'connected'
        return
      }

      // ── Spotlight / desktop query ─────────────────────
      if (data.type === 'query' && (data.data?.query || data.data?.files?.length)) {
        const connId = data.data.connectionId ?? ''
        const query = data.data.query
        const files = data.data.files
        const baseUrl = data.data.url ?? ''

        let targetTab = browserTabs.find((item) => item.connectionId === connId)
        if (!targetTab) {
          targetTab = createTab(connId, baseUrl)
        } else {
          selectTab(targetTab.id)
        }
        activeConnectionId = connId
        if (installPhase !== 'working') view = 'connected'

        // Targeted delivery — wait a frame for the webview DOM to exist
        requestAnimationFrame(() => {
          sendToWebview({ type: 'query', data: { query, files } }, connId)
        })
        return
      }

      // ── Call shortcut ─────────────────────────────────
      if (data.type === 'call' && data.data?.connectionId) {
        const connId = data.data.connectionId ?? ''
        const baseUrl = data.data.url ?? ''

        let targetTab = browserTabs.find((item) => item.connectionId === connId)
        if (!targetTab) {
          targetTab = createTab(connId, baseUrl)
        } else {
          selectTab(targetTab.id)
        }
        activeConnectionId = connId
        if (installPhase !== 'working') view = 'connected'

        // Targeted delivery — wait a frame for the webview DOM to exist
        requestAnimationFrame(() => {
          sendToWebview({ type: 'call' }, connId)
        })
        return
      }

      // ── Desktop runtime state forwarded to loaded webviews ─
      if (data.type === 'status:open-terminal') {
        openTerminalStatus = data.data
        sendToWebview(data)
        return
      }
      if (data.type === 'open-terminal:state') {
        openTerminalStatus = data.data?.status ?? null
        openTerminalInfo = data.data?.canUse
          ? { ...(data.data ?? {}), status: data.data?.status ?? 'started' }
          : data.data?.url
            ? { ...(data.data ?? {}), status: data.data?.status ?? 'started' }
            : null
        sendToWebview(data)
        if (data.data?.canUse && data.data?.url && data.data?.apiKey) {
          publishDesktopLocalTerminal(openTerminalInfo)
        } else if (data.data?.url) {
          publishDesktopLocalTerminal(data.data, 'remove')
        }
        return
      }
      if (data.type === 'open-terminal:ready') {
        openTerminalInfo = { ...(data.data ?? {}), status: 'started' }
        openTerminalStatus = 'started'
        sendToWebview(data)
        publishDesktopLocalTerminal(openTerminalInfo)
        return
      }
      if (data.type === 'status:llamacpp') {
        llamaCppStatus = data.data
        return
      }
      if (data.type === 'status:llamacpp-setup') {
        llamaCppSetupStatus = data.data ?? ''
        return
      }
      if (data.type === 'llamacpp:ready') {
        llamaCppInfo = data.data
        llamaCppStatus = 'started'
        llamaCppSetupStatus = ''
        return
      }
      if (data.type === 'status:install') {
        installStatus = data.data ?? ''
        return
      }

      // ── Everything else → broadcast to all webviews ───
      sendToWebview(data)
    })

    // Auto-connect to the default connection on startup so the webview
    // is pre-loaded and ready for spotlight queries.
    window.electronAPI.getConfig().then((cfg: any) => {
      if (cfg?.defaultConnectionId && !activeConnectionId) {
        connect(cfg.defaultConnectionId)
      }
    })

    // Check current Open Terminal state on mount
    window.electronAPI.getOpenTerminalInfo().then((info: any) => {
      if (info?.status) {
        openTerminalStatus = info.status
        openTerminalInfo = info
        if (info.status === 'started' && info.url && info.apiKey) {
          requestAnimationFrame(() => publishDesktopLocalTerminal(info))
        }
      }
    })

    // Check if Open WebUI package is installed
    window.electronAPI.getPackageVersion('open-webui').then((v: string | null) => {
      localInstalled = v !== null
    })

    // Check llama-server state on mount
    window.electronAPI.getLlamaCppInfo().then((info: any) => {
      if (info?.status) {
        llamaCppStatus = info.status
      }
      if (info?.binaryPath || info?.status) {
        llamaCppInfo = info
      }
    })

    return () => {
      window.removeEventListener('spark-tabs:new', handleNewTab)
      window.removeEventListener('spark-tabs:switch', handleSwitchTab)
      window.removeEventListener('spark-tabs:close', handleCloseTab)
      window.removeEventListener('spark-tabs:split', handleSplitTab)
      window.removeEventListener('spark-tabs:split-active', handleSplitActive)
    }
  })

  const toggleOpenTerminal = async () => {
    if (openTerminalStatus === 'starting') return
    if (openTerminalStatus === 'started') {
      openTerminalStatus = 'stopping'
      await window.electronAPI.stopOpenTerminal()
      openTerminalStatus = null
      openTerminalInfo = null
    } else {
      openTerminalStatus = 'starting'
      const result = await window.electronAPI.startOpenTerminal()
      if (result) {
        openTerminalInfo = { ...result, status: 'started' }
        openTerminalStatus = 'started'
        publishDesktopLocalTerminal(openTerminalInfo)
      } else {
        openTerminalStatus = 'failed'
      }
    }
  }

  const toggleLlamaCpp = async () => {
    if (llamaCppStatus === 'starting' || llamaCppStatus === 'setting-up') return
    if (llamaCppStatus === 'started') {
      llamaCppStatus = 'stopping'
      await window.electronAPI.stopLlamaCpp()
      llamaCppStatus = null
      llamaCppInfo = null
    } else {
      llamaCppStatus = 'starting'
      const result = await window.electronAPI.startLlamaCpp()
      if (result) {
        llamaCppInfo = result
        llamaCppStatus = 'started'
      } else {
        llamaCppStatus = 'failed'
      }
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="workspace-frame h-full w-full flex flex-col bg-[#f5f5f7] dark:bg-[#0a0a0a] text-[#1d1d1f] dark:text-[#fafafa]"
  in:fade={{ duration: 200 }}
>
  <div class="flex-1 min-h-0 flex">
    {#if sidebarOpen}
      <Sidebar
        {activeConnectionId}
        {connectingId}
        {localConn}
        {localInstalled}
        {remoteConnections}
        {serverStatus}
        {serverReachable}
        bind:settingsOpen
        onConnect={connect}
        onDisconnect={disconnect}
        onAddView={() => {
          if (APP_PROFILE.features.allowUserRemoteOpenWebUI) showAddConnectionModal = true
        }}
        {onOpenSettings}
        onRename={async (id, name) => {
          await window.electronAPI.updateConnection(id, { name })
          connections.set(await window.electronAPI.getConnections())
        }}
        onRemove={remove}
        openGithub={openOfficialWebsite}
      />
    {/if}

    <Content
      {sidebarOpen}
      bind:view
      {activeTabId}
      {activeConnectionId}
      {connectingId}
      {browserTabs}
      {splitTabIds}
      {localConn}
      {localInstalled}
      {remoteConnections}
      bind:installPhase
      bind:installError
      bind:installStatus
      bind:toastVisible
      bind:url
      bind:connecting
      bind:error
      bind:showAddConnectionModal
      bind:autoInstall
      onStartInstall={startInstall}
      onAddConnection={addConnection}
      onOpenNewTab={(connectionId, url, title) => createTab(connectionId, url, title)}
      onUpdateTab={updateTab}
      onSplitTab={splitTab}
      onUnsplitTab={unsplitTab}
      onSetView={(v) => {
        view = v
      }}
    />
  </div>

  {#if activeLog}
    <LogPanel
      {activeLog}
      serviceReady={activeLog === 'server'
        ? serverStatus === 'started'
        : activeLog === 'open-terminal'
          ? openTerminalStatus === 'started'
          : llamaCppStatus === 'started'}
      statusText={activeLog === 'server'
        ? serverStatus === 'starting'
          ? $i18n.t('main.install.startingServer')
          : serverStatus === 'running' && !serverReachable
            ? $i18n.t('main.install.waitingForServer')
            : installStatus || ''
        : activeLog === 'open-terminal'
          ? openTerminalStatus === 'stopping'
            ? 'Stopping Open Terminal…'
            : openTerminalStatus === 'starting'
              ? 'Starting Open Terminal…'
              : ''
          : llamaCppStatus === 'stopping'
            ? 'Stopping llama-server…'
            : llamaCppSetupStatus ||
              (llamaCppStatus === 'starting'
                ? 'Starting llama-server…'
                : llamaCppStatus === 'setting-up'
                  ? 'Setting up llama.cpp…'
                  : '')}
      connectPty={getConnectPty(activeLog)}
      disconnectPty={getDisconnectPty(activeLog)}
      readonly={activeLog !== 'server'}
      onWrite={getOnWrite(activeLog)}
      onResize={getOnResize(activeLog)}
      onStop={activeLog === 'open-terminal'
        ? toggleOpenTerminal
        : activeLog === 'llama-server'
          ? toggleLlamaCpp
          : undefined}
      onClose={() => {
        activeLog = null
        showingLogs = false
      }}
    />
  {/if}
</div>
