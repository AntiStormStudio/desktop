import log from 'electron-log'

type NetworkEnv = 'domestic' | 'international' | 'unknown'

let detectedEnv: NetworkEnv = 'unknown'
let detectionPromise: Promise<NetworkEnv> | null = null

// ─── Canary hosts for network environment detection ────

const CANARY = {
  domestic: ['https://pypi.tuna.tsinghua.edu.cn', 'https://mirrors.bfsu.edu.cn'],
  international: ['https://github.com', 'https://pypi.org']
}

// ─── Mirror source definitions ─────────────────────────

const MIRRORS: Record<string, Record<string, string[]>> = {
  pythonStandalone: {
    primary: ['https://github.com/astral-sh/python-build-standalone/releases/download'],
    domestic: [
      'https://ghproxy.net/https://github.com/astral-sh/python-build-standalone/releases/download',
      'https://gh-proxy.com/https://github.com/astral-sh/python-build-standalone/releases/download',
      'https://mirror.ghproxy.com/https://github.com/astral-sh/python-build-standalone/releases/download'
    ],
    international: [
      'https://github.com/astral-sh/python-build-standalone/releases/download'
    ]
  },
  pypiIndex: {
    primary: ['https://pypi.org/simple/'],
    domestic: [
      'https://pypi.tuna.tsinghua.edu.cn/simple/',
      'https://mirrors.bfsu.edu.cn/pypi/simple/',
      'https://mirrors.ustc.edu.cn/pypi/simple/',
      'https://mirrors.aliyun.com/pypi/simple/'
    ],
    international: ['https://pypi.org/simple/']
  },
  huggingface: {
    primary: ['https://huggingface.co'],
    domestic: [
      'https://hf-mirror.com',
      'https://huggingface.co'
    ],
    international: ['https://huggingface.co']
  },
  huggingfaceApi: {
    primary: ['https://huggingface.co/api'],
    domestic: [
      'https://hf-mirror.com/api',
      'https://huggingface.co/api'
    ],
    international: ['https://huggingface.co/api']
  },
  githubApi: {
    primary: ['https://api.github.com'],
    domestic: [
      'https://ghproxy.net/https://api.github.com',
      'https://gh-proxy.com/https://api.github.com',
      'https://mirror.ghproxy.com/https://api.github.com'
    ],
    international: ['https://api.github.com']
  },
  githubDownload: {
    primary: [],
    domestic: ['https://ghproxy.net/', 'https://gh-proxy.com/', 'https://mirror.ghproxy.com/'],
    international: ['']
  }
}

// ─── Network detection ──────────────────────────────────

const testUrl = async (url: string, timeoutMs = 3000): Promise<boolean> => {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    })
    clearTimeout(timer)
    return response.ok || response.status < 500
  } catch {
    return false
  }
}

const raceHosts = async (hosts: string[], timeoutMs = 3000): Promise<string | null> => {
  const results = await Promise.allSettled(
    hosts.map(async (host) => {
      const ok = await testUrl(host, timeoutMs)
      return ok ? host : null
    })
  )
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value
  }
  return null
}

const detectNetworkEnv = async (): Promise<NetworkEnv> => {
  log.info('[download-sources] Detecting network environment...')

  const domesticResult = await raceHosts(CANARY.domestic, 2500)
  const internationalResult = await raceHosts(CANARY.international, 2500)

  if (domesticResult && internationalResult) {
    // Both reachable — prefer domestic (faster in China)
    log.info('[download-sources] Both networks reachable, preferring domestic')
    return 'domestic'
  }
  if (domesticResult) {
    log.info('[download-sources] Domestic network detected')
    return 'domestic'
  }
  if (internationalResult) {
    log.info('[download-sources] International network detected')
    return 'international'
  }

  log.info('[download-sources] Network environment unknown, using international as fallback')
  return 'international'
}

const getNetworkEnv = async (): Promise<NetworkEnv> => {
  if (detectedEnv !== 'unknown') return detectedEnv
  if (detectionPromise) return detectionPromise

  detectionPromise = detectNetworkEnv().then((env) => {
    detectedEnv = env
    detectionPromise = null
    return env
  }).catch(() => {
    detectionPromise = null
    detectedEnv = 'international'
    return 'international' as NetworkEnv
  })

  return detectionPromise
}

// ─── URL resolution with fallback ───────────────────────

type MirrorType = 'pythonStandalone' | 'pypiIndex' | 'huggingface' | 'huggingfaceApi' | 'githubApi'

const getMirrors = async (type: MirrorType): Promise<string[]> => {
  const env = await getNetworkEnv()
  const def = MIRRORS[type]
  if (!def) return []

  if (env === 'domestic') {
    return [...def.domestic, ...def.primary]
  }
  return [...def.international, ...def.primary]
}

// ─── Public API ─────────────────────────────────────────

export const getNetworkEnvironment = getNetworkEnv

/**
 * Build a list of Python standalone download URLs with fallback mirrors.
 * @param filename - the tar.gz filename to append
 */
export const getPythonDownloadUrls = async (filename: string): Promise<string[]> => {
  const baseUrls = await getMirrors('pythonStandalone')
  return baseUrls.map((base) => `${base}/${filename}`)
}

/**
 * Get PyPI index URLs for pip/uv install commands.
 * Returns [primary, ...fallbacks] for the --index-url / --extra-index-url pattern.
 */
export const getPypiIndexUrls = async (): Promise<string[]> => {
  return getMirrors('pypiIndex')
}

/**
 * Build uv pip install args for PyPI mirror support.
 * When domestic, uses the first mirror as --index-url and rest as --extra-index-url.
 * When international, no extra args needed (defaults to pypi.org).
 */
export const getPypiInstallArgs = async (
  packageSpecifier: string,
  upgrade: boolean = true
): Promise<string[]> => {
  const env = await getNetworkEnv()
  if (env === 'international') {
    return upgrade ? [packageSpecifier, '-U'] : [packageSpecifier]
  }

  const mirrors = await getMirrors('pypiIndex')
  const args: string[] = ['--index-url', mirrors[0]]
  for (let i = 1; i < mirrors.length; i++) {
    args.push('--extra-index-url', mirrors[i])
  }
  args.push('--trusted-host', new URL(mirrors[0]).hostname)
  args.push(packageSpecifier)
  if (upgrade) args.push('-U')
  return args
}

/**
 * Get HuggingFace base URL (with mirror fallback).
 */
export const getHuggingFaceBaseUrl = async (): Promise<string> => {
  const mirrors = await getMirrors('huggingface')
  return mirrors[0]
}

/**
 * Get HuggingFace API base URL (with mirror fallback).
 */
export const getHuggingFaceApiBaseUrl = async (): Promise<string> => {
  const mirrors = await getMirrors('huggingfaceApi')
  return mirrors[0]
}

/**
 * Get GitHub API URL with optional proxy for domestic network.
 */
export const getGithubApiUrl = async (path: string): Promise<string> => {
  const env = await getNetworkEnv()
  if (env === 'domestic') {
    const mirrors = MIRRORS.githubApi
    // Try proxy URLs first
    return `${mirrors.domestic[0]}/${path.replace(/^https?:\/\/api\.github\.com\//, '')}`
  }
  return `https://api.github.com/${path.replace(/^https?:\/\/api\.github\.com\//, '')}`
}

/**
 * Transform a GitHub release download URL to go through a proxy mirror when needed.
 * Returns an array of URLs to try in order [primary, domestic mirror 1, domestic mirror 2, ...]
 */
export const getGithubDownloadUrls = async (url: string): Promise<string[]> => {
  const env = await getNetworkEnv()
  const urls: string[] = [url]

  if (env === 'domestic') {
    for (const proxy of MIRRORS.githubDownload.domestic) {
      urls.push(`${proxy}${url}`)
    }
  }

  return urls
}

/**
 * Download a file trying multiple URLs with fallback.
 */
export const downloadWithMirrors = async (
  urls: string[],
  downloadPath: string,
  onProgress?: (progress: number, downloaded: number, total: number) => void
): Promise<string> => {
  const fs = await import('fs')
  let lastError: Error | null = null

  for (const url of urls) {
    try {
      log.info(`[download-sources] Trying: ${url}`)
      const response = await fetch(url)
      if (!response || !response.ok) {
        throw new Error(`HTTP ${response?.status}`)
      }

      const totalSize = parseInt(response.headers.get('content-length') ?? '0', 10)
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response reader')

      const chunks: Buffer[] = []
      let downloadedSize = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(Buffer.from(value))
        downloadedSize += value.length
        if (onProgress && totalSize > 0) {
          onProgress((downloadedSize / totalSize) * 100, downloadedSize, totalSize)
        }
      }

      const buffer = Buffer.concat(chunks)
      fs.writeFileSync(downloadPath, buffer)
      log.info(`[download-sources] Downloaded successfully: ${downloadPath}`)
      return downloadPath
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      log.warn(`[download-sources] Mirror failed (${url}): ${lastError.message}`)
      try {
        if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath)
      } catch {}
    }
  }

  throw lastError || new Error('All download mirrors exhausted')
}

/**
 * Pre-warm the network detection (call early on startup).
 */
export const prewarmNetworkDetection = (): void => {
  getNetworkEnv()
}
