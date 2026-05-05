#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BUILD_MAC="${BUILD_MAC:-1}"
BUILD_WIN="${BUILD_WIN:-1}"
CLEAN_DIST="${CLEAN_DIST:-0}"
MAC_ARCHES="${MAC_ARCHES:-x64 arm64}"
WIN_ARCHES="${WIN_ARCHES:-x64 arm64}"
read -r -a MAC_ARCH_LIST <<< "$MAC_ARCHES"
read -r -a WIN_ARCH_LIST <<< "$WIN_ARCHES"

log() {
  printf '\n==> %s\n' "$*"
}

run_builder() {
  npx electron-builder --config electron-builder.generated.yml "$@"
}

if [[ "$CLEAN_DIST" == "1" ]]; then
  log "Cleaning dist"
  rm -rf dist
fi

log "Building renderer/main/preload once"
npm run build

if [[ "$BUILD_MAC" == "1" ]]; then
  log "Packaging macOS (${MAC_ARCHES})"
  # Explicit targets override the generated config so both macOS arches get dmg and zip artifacts.
  # macOS packaging only works on macOS hosts.
  mac_flags=()
  for arch in "${MAC_ARCH_LIST[@]}"; do
    mac_flags+=("--${arch}")
  done
  run_builder --mac dmg zip "${mac_flags[@]}"
fi

if [[ "$BUILD_WIN" == "1" ]]; then
  log "Packaging Windows (${WIN_ARCHES})"
  # NSIS is the configured Windows installer target.
  win_flags=()
  for arch in "${WIN_ARCH_LIST[@]}"; do
    win_flags+=("--${arch}")
  done
  run_builder --win nsis "${win_flags[@]}"
fi

log "Artifacts"
find dist -maxdepth 1 -type f \
  \( -name '*.dmg' -o -name '*.zip' -o -name '*.exe' -o -name 'latest*.yml' \) \
  -print | sort
