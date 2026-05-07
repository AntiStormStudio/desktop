<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { connections, config, appInfo } from '../stores'
  import { tooltip } from '../actions/tooltip'
  import i18n from '../i18n'
  import Connections from './Main/Connections.svelte'
  import Settings from './Main/Settings.svelte'

  type BrowserTab = {
    id: string
    connectionId: string
    title: string
    initialUrl: string
    url: string
  }

  let visible = $state(false)
  let settingsOpen = $state(false)
  let settingsTab = $state('general')
  let settingsRequestId = $state(0)
  let sidebarOpen = $state(true)
  let activeConnectionName = $state('')
  let activeTabId = $state('')
  let browserTabs = $state<BrowserTab[]>([])
  let draggingTabId = $state('')
  let cleanupDataListener: (() => void) | null = null
  let cleanupWindowStateListener: (() => void) | null = null
  let windowMaximized = $state(false)

  const activeTab = $derived(browserTabs.find((tab) => tab.id === activeTabId) ?? null)

  onMount(async () => {
    connections.set(await window.electronAPI.getConnections())
    const cfg = await window.electronAPI.getConfig()
    config.set(cfg)
    sidebarOpen = cfg?.showSidebar ?? true
    cleanupDataListener = window.electronAPI.onData((data: any) => {
      if (data.type === 'settings:open') {
        settingsTab = data.data?.tab ?? 'general'
        settingsRequestId += 1
        settingsOpen = true
      }
    })
    if ($appInfo?.platform === 'win32') {
      const windowState = window.electronAPI.getWindowState?.()
      windowState?.then((state: any) => {
        windowMaximized = Boolean(state?.isMaximized)
      })
      cleanupWindowStateListener = window.electronAPI.onWindowState?.((state: any) => {
        windowMaximized = Boolean(state?.isMaximized)
      })
    }
    setTimeout(() => {
      visible = true
    }, 50)
  })

  onDestroy(() => {
    cleanupDataListener?.()
    cleanupWindowStateListener?.()
  })

  const toggleSidebar = () => {
    sidebarOpen = !sidebarOpen
    window.electronAPI.setConfig({ showSidebar: sidebarOpen })
  }

  const getActiveWebview = () =>
    activeTabId ? (document.querySelector(`webview[data-tab-id="${activeTabId}"]`) as any) : null

  const sendTabCommand = (type: string, detail: Record<string, any> = {}) => {
    window.dispatchEvent(new CustomEvent(type, { detail }))
  }

  const reorderTab = (dragId: string, targetId: string) => {
    if (!dragId || dragId === targetId) return
    const from = browserTabs.findIndex((tab) => tab.id === dragId)
    const to = browserTabs.findIndex((tab) => tab.id === targetId)
    if (from === -1 || to === -1) return
    const next = [...browserTabs]
    const [tab] = next.splice(from, 1)
    next.splice(to, 0, tab)
    browserTabs = next
  }

  const detachTab = async (tab: BrowserTab) => {
    await window.electronAPI.detachTab?.({
      connectionId: tab.connectionId,
      url: tab.url,
      title: tab.title
    })
    sendTabCommand('spark-tabs:close', { tabId: tab.id })
  }

  const refreshTab = (tabId: string) => {
    const wv = document.querySelector(`webview[data-tab-id="${tabId}"]`) as any
    wv?.reload?.()
  }
</script>

{#if visible}
  <div
    class="main-frame h-full w-full flex flex-col bg-[#f5f5f7] dark:bg-[#0a0a0a] text-[#1d1d1f] dark:text-[#fafafa] relative"
    in:fade={{ duration: 200 }}
  >
    <!-- Persistent top bar -->
    <div
      class="top-chrome flex items-center shrink-0 drag-region bg-[#f5f5f7]/95 dark:bg-[#0a0a0a]/95 h-10"
    >
      <div
        class="flex items-center gap-2 {$appInfo?.platform === 'darwin'
          ? 'pl-25'
          : 'pl-3'} pr-2 shrink-0 translate-y-[0.5px]"
      >
        <button
          class="opacity-65 hover:opacity-100 transition bg-transparent border-none text-[#1d1d1f] dark:text-[#fafafa] no-drag h-7 w-7 flex items-center justify-center rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          onclick={toggleSidebar}
          aria-label={sidebarOpen
            ? $i18n.t('sidebar.tooltip.closeSidebar')
            : $i18n.t('sidebar.tooltip.openSidebar')}
          use:tooltip={sidebarOpen
            ? $i18n.t('sidebar.tooltip.closeSidebar')
            : $i18n.t('sidebar.tooltip.openSidebar')}
        >
          <svg
            class="w-[15px] h-[15px]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3.75 3.75h16.5v16.5H3.75V3.75zM9 3.75v16.5"
            />
          </svg>
        </button>

        {#if activeTab}
          <button
            class="opacity-40 hover:opacity-80 transition bg-transparent border-none text-[#1d1d1f] dark:text-[#fafafa] no-drag cursor-pointer h-7 w-7 flex items-center justify-center rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            onclick={() => {
              const wv = getActiveWebview()
              if (wv?.goBack) wv.goBack()
            }}
            aria-label={$i18n.t('common.back')}
            use:tooltip={$i18n.t('common.back')}
          >
            <svg
              class="w-[13px] h-[13px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
          <button
            class="opacity-40 hover:opacity-80 transition bg-transparent border-none text-[#1d1d1f] dark:text-[#fafafa] no-drag cursor-pointer h-7 w-7 flex items-center justify-center rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            onclick={() => {
              const wv = getActiveWebview()
              if (wv?.goForward) wv.goForward()
            }}
            aria-label={$i18n.t('common.forward')}
            use:tooltip={$i18n.t('common.forward')}
          >
            <svg
              class="w-[13px] h-[13px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        {/if}
      </div>

      <div class="flex-1 min-w-0 flex items-center self-stretch overflow-hidden">
        <div
          class="tab-strip flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar no-drag px-1"
        >
          {#if browserTabs.length > 0}
            {#each browserTabs as tab (tab.id)}
              <button
                draggable="true"
                data-active={tab.id === activeTabId}
                class="browser-tab group h-[26px] min-w-[132px] max-w-[220px] px-2 flex items-center gap-1.5 rounded-md border border-transparent text-left text-[#1d1d1f] dark:text-[#fafafa] transition {tab.id ===
                activeTabId
                  ? 'active-tab bg-white/85 dark:bg-white/[0.10]'
                  : 'bg-transparent opacity-55 hover:opacity-90 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}"
                onclick={() => sendTabCommand('spark-tabs:switch', { tabId: tab.id })}
                ondragstart={(e) => {
                  draggingTabId = tab.id
                  ;(window as any).__sparkTabDropHandled = false
                  e.dataTransfer?.setData('text/x-spark-tab-id', tab.id)
                  e.dataTransfer?.setData('text/plain', tab.title || tab.url)
                  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
                }}
                ondragover={(e) => {
                  e.preventDefault()
                  if (draggingTabId) reorderTab(draggingTabId, tab.id)
                }}
                ondragend={async (e) => {
                  const dragged = browserTabs.find((item) => item.id === draggingTabId)
                  const topBar = (e.currentTarget as HTMLElement).closest('.top-chrome')
                  const bounds = topBar?.getBoundingClientRect()
                  const outsideTopBar =
                    !!bounds &&
                    (e.clientY < bounds.top - 12 ||
                      e.clientY > bounds.bottom + 28 ||
                      e.clientX < bounds.left - 24 ||
                      e.clientX > bounds.right + 24)
                  const handledDrop = (window as any).__sparkTabDropHandled === true
                  ;(window as any).__sparkTabDropHandled = false
                  draggingTabId = ''
                  if (dragged && outsideTopBar && !handledDrop) await detachTab(dragged)
                }}
                title={tab.title || $i18n.t('app.name')}
              >
                <span class="tab-status-dot h-2 w-2 shrink-0 rounded-full bg-emerald-400/80"></span>
                <span class="tab-title min-w-0 flex-1 truncate text-[12px]">
                  {tab.title || activeConnectionName || $i18n.t('app.name')}
                </span>
                <span
                  role="button"
                  tabindex="0"
                  class="tab-action-button tab-refresh-button h-5 w-5 shrink-0 rounded flex items-center justify-center opacity-45 hover:opacity-90 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                  title={$i18n.t('common.refresh')}
                  aria-label={$i18n.t('common.refresh')}
                  onclick={(e) => {
                    e.stopPropagation()
                    refreshTab(tab.id)
                  }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      refreshTab(tab.id)
                    }
                  }}
                >
                  <svg
                    class="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M20.015 4.356v4.992m0 0h-4.992m4.993 0l-3.181-3.183a8.25 8.25 0 00-13.803 3.7"
                    />
                  </svg>
                </span>
                <span
                  role="button"
                  tabindex="0"
                  class="tab-close-button h-5 w-5 shrink-0 rounded flex items-center justify-center opacity-45 hover:opacity-90 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                  title={$i18n.t('common.close')}
                  aria-label={$i18n.t('common.close')}
                  onclick={(e) => {
                    e.stopPropagation()
                    sendTabCommand('spark-tabs:close', { tabId: tab.id })
                  }}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      sendTabCommand('spark-tabs:close', { tabId: tab.id })
                    }
                  }}
                >
                  <svg
                    class="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </button>
            {/each}
          {:else}
            <div class="h-8 px-3 flex items-center text-[12px] opacity-55">
              {$i18n.t('app.name')}
            </div>
          {/if}
          <button
            class="add-tab-button h-[26px] w-[26px] flex items-center justify-center rounded-md border-none bg-transparent text-[#1d1d1f] dark:text-[#fafafa] opacity-45 hover:opacity-90 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
            onclick={() => sendTabCommand('spark-tabs:new')}
            title={$i18n.t('tabs.new')}
            aria-label={$i18n.t('tabs.new')}
          >
            <svg
              class="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m7-7H5" />
            </svg>
          </button>
        </div>
      </div>
      <div class="pr-3 flex items-center shrink-0 translate-y-[0.5px]">
        {#if activeTab}
          <button
            class="opacity-40 hover:opacity-80 transition bg-transparent border-none text-[#1d1d1f] dark:text-[#fafafa] no-drag cursor-pointer h-7 w-7 flex items-center justify-center rounded-md hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            onclick={() => sendTabCommand('spark-tabs:split-active')}
            aria-label={$i18n.t('tabs.split')}
            use:tooltip={$i18n.t('tabs.split')}
          >
            <svg
              class="w-[14px] h-[14px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.7"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3.75 5.25A1.5 1.5 0 015.25 3.75h13.5a1.5 1.5 0 011.5 1.5v13.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V5.25zM12 3.75v16.5"
              />
            </svg>
          </button>
        {/if}
        {#if $appInfo?.platform === 'win32'}
          <div class="window-controls no-drag ml-1 flex items-center gap-0.5">
            <button
              class="window-control-button h-7 w-9 flex items-center justify-center rounded-md border-none bg-transparent text-[#1d1d1f] dark:text-[#fafafa] opacity-55 hover:opacity-90 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              onclick={() => window.electronAPI.minimizeWindow?.()}
              aria-label="Minimize"
              use:tooltip={'Minimize'}
            >
              <svg
                class="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path stroke-linecap="round" d="M6 12h12" />
              </svg>
            </button>
            <button
              class="window-control-button h-7 w-9 flex items-center justify-center rounded-md border-none bg-transparent text-[#1d1d1f] dark:text-[#fafafa] opacity-55 hover:opacity-90 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              onclick={async () => {
                const state = await window.electronAPI.toggleMaximizeWindow?.()
                windowMaximized = Boolean(state?.isMaximized)
              }}
              aria-label={windowMaximized ? 'Restore' : 'Maximize'}
              use:tooltip={windowMaximized ? 'Restore' : 'Maximize'}
            >
              {#if windowMaximized}
                <svg
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                >
                  <path stroke-linejoin="round" d="M8 8h9v9H8z" />
                  <path stroke-linejoin="round" d="M6 15H5V5h10v1" />
                </svg>
              {:else}
                <svg
                  class="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                >
                  <path stroke-linejoin="round" d="M6.5 6.5h11v11h-11z" />
                </svg>
              {/if}
            </button>
            <button
              class="window-control-button close-button h-7 w-9 flex items-center justify-center rounded-md border-none bg-transparent text-[#1d1d1f] dark:text-[#fafafa] opacity-55 hover:opacity-100 hover:bg-red-500 hover:text-white"
              onclick={() => window.electronAPI.closeWindow?.()}
              aria-label={$i18n.t('common.close')}
              use:tooltip={$i18n.t('common.close')}
            >
              <svg
                class="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 7l10 10M17 7L7 17" />
              </svg>
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Content area below top bar -->
    <div class="flex-1 min-h-0">
      <Connections
        {sidebarOpen}
        bind:activeConnectionName
        bind:browserTabs
        bind:activeTabId
        onOpenSettings={() => (settingsOpen = true)}
      />
    </div>

    {#if settingsOpen}
      <div
        class="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        in:fade={{ duration: 150 }}
        out:fade={{ duration: 100 }}
        onclick={() => (settingsOpen = false)}
        role="button"
        tabindex="-1"
      >
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="w-[calc(100%-32px)] h-[calc(100%-32px)] max-w-[900px] max-h-[600px] rounded-3xl overflow-hidden shadow-2xl border border-black/[0.08] dark:border-white/[0.08]"
          in:fade={{ duration: 150 }}
          onclick={(e) => e.stopPropagation()}
        >
          {#key settingsRequestId}
            <Settings initialTab={settingsTab} onClose={() => (settingsOpen = false)} />
          {/key}
        </div>
      </div>
    {/if}
  </div>
{/if}
