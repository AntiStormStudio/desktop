import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const loadEnvFile = (file) => {
  if (!fs.existsSync(file)) return
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = value
  }
}

loadEnvFile(path.join(root, '.env'))

const profilePath = path.resolve(root, process.env.DESKTOP_PROFILE ?? 'profiles/default.json')

const envBool = (name, fallback) => {
  const value = process.env[name]
  if (value == null || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}
const envString = (name, fallback) => process.env[name] ?? fallback
const envList = (name, fallback) => {
  const value = process.env[name]
  if (value == null) return fallback
  if (value.trim() === '') return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const profile = readJson(profilePath)

profile.brand.name = envString('DESKTOP_BRAND_NAME', profile.brand.name)
profile.brand.desktopName = envString('DESKTOP_BRAND_DESKTOP_NAME', profile.brand.desktopName)
profile.brand.serviceName = envString('DESKTOP_SERVICE_NAME', profile.brand.serviceName)
profile.brand.description = envString('DESKTOP_DESCRIPTION', profile.brand.description)
profile.brand.author = envString('DESKTOP_AUTHOR', profile.brand.author)
profile.brand.homepage = envString('DESKTOP_HOMEPAGE', profile.brand.homepage)
profile.brand.packageName = envString('DESKTOP_PACKAGE_NAME', profile.brand.packageName)
profile.brand.appId = envString('DESKTOP_APP_ID', profile.brand.appId)
profile.brand.executableName = envString('DESKTOP_EXECUTABLE_NAME', profile.brand.executableName)
profile.brand.linuxMaintainer = envString('DESKTOP_LINUX_MAINTAINER', profile.brand.linuxMaintainer)
profile.brand.githubOwner = envString('DESKTOP_GITHUB_OWNER', profile.brand.githubOwner)
profile.brand.githubRepo = envString('DESKTOP_GITHUB_REPO', profile.brand.githubRepo)

profile.features.allowLocalOpenWebUIInstall = envBool(
  'DESKTOP_ALLOW_LOCAL_OPENWEBUI_INSTALL',
  profile.features.allowLocalOpenWebUIInstall
)
profile.features.allowUserRemoteOpenWebUI = envBool(
  'DESKTOP_ALLOW_USER_REMOTE_OPENWEBUI',
  profile.features.allowUserRemoteOpenWebUI
)
profile.features.defaultRemoteOpenWebUI = envString(
  'DESKTOP_DEFAULT_REMOTE_OPENWEBUI',
  profile.features.defaultRemoteOpenWebUI
)
profile.features.defaultLandingMode = envString(
  'DESKTOP_DEFAULT_LANDING_MODE',
  profile.features.defaultLandingMode
)
profile.features.allowRemotePasskeys = envBool(
  'DESKTOP_ALLOW_REMOTE_PASSKEYS',
  profile.features.allowRemotePasskeys
)
profile.features.allowRemoteDesktopBridge = envBool(
  'DESKTOP_ALLOW_REMOTE_DESKTOP_BRIDGE',
  profile.features.allowRemoteDesktopBridge
)
profile.features.allowRemoteNativeApi = envBool(
  'DESKTOP_ALLOW_REMOTE_NATIVE_API',
  profile.features.allowRemoteNativeApi
)
profile.features.allowRemoteLocalResources = envBool(
  'DESKTOP_ALLOW_REMOTE_LOCAL_RESOURCES',
  profile.features.allowRemoteLocalResources
)

profile.remotePermissions.allowed = envList(
  'DESKTOP_REMOTE_PERMISSIONS_ALLOWED',
  profile.remotePermissions.allowed
)
profile.auth.allowExternalAuthOriginsInWebview = envBool(
  'DESKTOP_AUTH_ALLOW_EXTERNAL_ORIGINS_IN_WEBVIEW',
  profile.auth.allowExternalAuthOriginsInWebview
)
profile.auth.allowedAuthOrigins = envList(
  'DESKTOP_AUTH_ALLOWED_ORIGINS',
  profile.auth.allowedAuthOrigins
)
profile.desktopBridge.allowedCapabilities = envList(
  'DESKTOP_DESKTOP_BRIDGE_ALLOWED_CAPABILITIES',
  profile.desktopBridge.allowedCapabilities
)

profile.updates.provider = envString('DESKTOP_UPDATE_PROVIDER', profile.updates.provider)
profile.updates.owner = envString('DESKTOP_UPDATE_OWNER', profile.updates.owner)
profile.updates.repo = envString('DESKTOP_UPDATE_REPO', profile.updates.repo)
profile.updates.url = envString('DESKTOP_UPDATE_URL', profile.updates.url)
profile.updates.updaterCacheDirName = envString(
  'DESKTOP_UPDATE_CACHE_DIR',
  profile.updates.updaterCacheDirName
)

profile.assets = profile.assets ?? {}
profile.assets.iconDir = envString('DESKTOP_ICON_DIR', profile.assets.iconDir ?? '')
profile.assets.iconPng = envString('DESKTOP_ICON_PNG', profile.assets.iconPng ?? 'icon.png')
profile.assets.iconIco = envString('DESKTOP_ICON_ICO', profile.assets.iconIco ?? 'icon.ico')
profile.assets.trayPng = envString(
  'DESKTOP_TRAY_PNG',
  profile.assets.trayPng ?? profile.assets.iconPng
)
profile.assets.splashLightPng = envString(
  'DESKTOP_SPLASH_LIGHT_PNG',
  profile.assets.splashLightPng ?? profile.assets.iconPng
)
profile.assets.splashDarkPng = envString(
  'DESKTOP_SPLASH_DARK_PNG',
  profile.assets.splashDarkPng ?? profile.assets.splashLightPng
)

const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, data)
}

const copyIfExists = (from, to) => {
  if (!from || !fs.existsSync(from)) return false
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  return true
}

const commandExists = (command) => {
  try {
    execFileSync('/bin/sh', ['-c', `command -v ${command}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const syncBrandAssets = () => {
  if (!profile.assets.iconDir) return
  const iconDir = path.resolve(root, profile.assets.iconDir)
  if (!fs.existsSync(iconDir)) {
    console.warn(`Brand icon directory not found: ${iconDir}`)
    return
  }

  const png = path.join(iconDir, profile.assets.iconPng)
  const ico = path.join(iconDir, profile.assets.iconIco)
  const tray = path.join(iconDir, profile.assets.trayPng)
  const splashLight = path.join(iconDir, profile.assets.splashLightPng)
  const splashDark = path.join(iconDir, profile.assets.splashDarkPng)

  copyIfExists(png, path.join(root, 'resources/icon.png'))
  copyIfExists(png, path.join(root, 'build/icon.png'))
  copyIfExists(ico, path.join(root, 'build/icon.ico'))
  copyIfExists(tray, path.join(root, 'resources/tray.png'))
  copyIfExists(splashLight, path.join(root, 'src/renderer/src/lib/assets/images/splash.png'))
  copyIfExists(splashDark, path.join(root, 'src/renderer/src/lib/assets/images/splash-dark.png'))

  if (fs.existsSync(png) && commandExists('iconutil') && commandExists('sips')) {
    const iconset = path.join(root, 'build/icon.iconset')
    fs.rmSync(iconset, { recursive: true, force: true })
    fs.mkdirSync(iconset, { recursive: true })
    const sizes = [
      ['icon_16x16.png', 16],
      ['icon_16x16@2x.png', 32],
      ['icon_32x32.png', 32],
      ['icon_32x32@2x.png', 64],
      ['icon_128x128.png', 128],
      ['icon_128x128@2x.png', 256],
      ['icon_256x256.png', 256],
      ['icon_256x256@2x.png', 512],
      ['icon_512x512.png', 512],
      ['icon_512x512@2x.png', 1024]
    ]
    for (const [name, size] of sizes) {
      execFileSync(
        'sips',
        ['-z', String(size), String(size), png, '--out', path.join(iconset, name)],
        {
          stdio: 'ignore'
        }
      )
    }
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(root, 'build/icon.icns')], {
      stdio: 'ignore'
    })
    fs.rmSync(iconset, { recursive: true, force: true })
  }
}

syncBrandAssets()

const htmlEscape = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const replaceHtmlTitle = (file, title) => {
  if (!fs.existsSync(file)) return
  const html = fs.readFileSync(file, 'utf8')
  fs.writeFileSync(file, html.replace(/<title>.*?<\/title>/, `<title>${htmlEscape(title)}</title>`))
}

replaceHtmlTitle(path.join(root, 'src/renderer/index.html'), profile.brand.name)
replaceHtmlTitle(
  path.join(root, 'src/renderer/spotlight.html'),
  `${profile.brand.name} - Spotlight`
)
replaceHtmlTitle(
  path.join(root, 'src/renderer/voice-input.html'),
  `${profile.brand.name} - Voice Input`
)

write(
  path.join(root, 'src/shared/profile.ts'),
  `// Generated by scripts/generate-profile.mjs. Edit profiles/*.json or env vars instead.\n` +
    `export const APP_PROFILE = ${JSON.stringify(profile, null, 2)} as const\n\n` +
    `export type AppProfile = typeof APP_PROFILE\n`
)

const publishYaml =
  profile.updates.provider === 'generic'
    ? `publish:\n  provider: generic\n  url: ${JSON.stringify(profile.updates.url || 'https://example.com/updates/')}\n`
    : `publish:\n  provider: github\n  owner: ${JSON.stringify(profile.updates.owner)}\n  repo: ${JSON.stringify(profile.updates.repo)}\n`

const yamlValue = (value) => JSON.stringify(String(value ?? ''))
const packageName = profile.brand.packageName || profile.brand.executableName || 'desktop'

write(
  path.join(root, 'electron-builder.generated.yml'),
  `appId: ${yamlValue(profile.brand.appId)}\n` +
    `productName: ${yamlValue(profile.brand.desktopName)}\n` +
    `protocols:\n` +
    `  - name: ${yamlValue(profile.brand.desktopName)}\n` +
    `    schemes:\n` +
    `      - spal\n` +
    `directories:\n  buildResources: build\n` +
    `extraMetadata:\n` +
    `  name: ${yamlValue(packageName)}\n` +
    `  productName: ${yamlValue(profile.brand.desktopName)}\n` +
    `  description: ${yamlValue(profile.brand.description)}\n` +
    `  author: ${yamlValue(profile.brand.author)}\n` +
    `  homepage: ${yamlValue(profile.brand.homepage)}\n` +
    `files:\n` +
    `  - '!**/.vscode/*'\n` +
    `  - '!src/*'\n` +
    `  - '!electron.vite.config.{js,ts,mjs,cjs}'\n` +
    `  - '!svelte.config.mjs'\n` +
    `  - '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,README.md}'\n` +
    `  - '!{.env,.env.*,.npmrc,pnpm-lock.yaml}'\n` +
    `  - '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}'\n` +
    `extraResources:\n` +
    `  - from: CHANGELOG.md\n    to: CHANGELOG.md\n` +
    `asarUnpack:\n  - resources/**\n  - node_modules/node-pty/**\n` +
    `win:\n  executableName: ${yamlValue(profile.brand.executableName)}\n` +
    `nsis:\n  artifactName: ${yamlValue(`${packageName}-\${arch}-setup.\${ext}`)}\n  shortcutName: \${productName}\n  uninstallDisplayName: \${productName}\n  createDesktopShortcut: always\n` +
    `mac:\n  target:\n    - target: dmg\n    - target: zip\n      arch:\n        - x64\n        - arm64\n  artifactName: ${yamlValue(`${packageName}-\${arch}-mac.\${ext}`)}\n  entitlements: build/entitlements.mac.plist\n  entitlementsInherit: build/entitlements.mac.plist\n  extendInfo:\n    - NSCameraUsageDescription: Application requests access to the device's camera.\n    - NSMicrophoneUsageDescription: Application requests access to the device's microphone.\n    - NSDocumentsFolderUsageDescription: Application requests access to the user's Documents folder.\n    - NSDownloadsFolderUsageDescription: Application requests access to the user's Downloads folder.\n` +
    `dmg:\n  background: build/dmg-background.png\n  artifactName: ${yamlValue(`${packageName}-\${arch}.\${ext}`)}\n  title: \${productName}\n  contents:\n    - x: 225\n      y: 250\n      type: file\n    - x: 400\n      y: 240\n      type: link\n      path: /Applications\n` +
    `linux:\n  target:\n    - AppImage\n    - snap\n    - deb\n    - flatpak\n  maintainer: ${yamlValue(profile.brand.linuxMaintainer)}\n  category: Utility\n` +
    `deb:\n  artifactName: ${yamlValue(`${packageName}_\${arch}.\${ext}`)}\n` +
    `snap:\n  artifactName: ${yamlValue(`${packageName}_\${arch}.\${ext}`)}\n` +
    `appImage:\n  artifactName: ${yamlValue(`${packageName}_\${arch}.\${ext}`)}\n` +
    `flatpak:\n  base: org.electronjs.Electron2.BaseApp\n  baseVersion: '23.08'\n  runtime: org.freedesktop.Platform\n  runtimeVersion: '23.08'\n  sdk: org.freedesktop.Sdk\n  artifactName: ${yamlValue(`${packageName}.flatpak`)}\n  finishArgs:\n    - --share=ipc\n    - --socket=x11\n    - --socket=wayland\n    - --socket=pulseaudio\n    - --share=network\n    - --device=dri\n    - --filesystem=home\n    - --talk-name=org.freedesktop.Notifications\n    - --talk-name=org.freedesktop.portal.Desktop\n` +
    `npmRebuild: true\n` +
    publishYaml
)

const devUpdateYaml =
  profile.updates.provider === 'generic'
    ? `provider: generic\nurl: ${JSON.stringify(profile.updates.url || 'https://example.com/updates/')}\n`
    : `provider: github\nowner: ${JSON.stringify(profile.updates.owner)}\nrepo: ${JSON.stringify(profile.updates.repo)}\n`

write(
  path.join(root, 'dev-app-update.yml'),
  devUpdateYaml + `updaterCacheDirName: ${profile.updates.updaterCacheDirName}\n`
)

console.log(`Generated desktop profile from ${path.relative(root, profilePath)}`)
