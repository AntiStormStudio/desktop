declare global {
  interface Window {
    sourcePickerAPI: {
      onSources: (callback: (sources: Array<{id: string, name: string, type: string, thumbnail: string | null}>) => void) => (() => void)
      select: (sourceId: string) => void
      cancel: () => void
    }
  }
}

const api = window.sourcePickerAPI

const styles = document.createElement('style')
styles.textContent = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    background: #1a1a2e;
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    user-select: none;
  }

  #app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 16px;
  }

  .header {
    text-align: center;
    margin-bottom: 12px;
  }

  .header h1 {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    letter-spacing: 0.3px;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;
  }

  .grid::-webkit-scrollbar {
    width: 6px;
  }

  .grid::-webkit-scrollbar-track {
    background: transparent;
  }

  .grid::-webkit-scrollbar-thumb {
    background: #3a3a5c;
    border-radius: 3px;
  }

  .card {
    background: #16213e;
    border: 2px solid #2a2a4a;
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
  }

  .card:hover {
    border-color: #4a4a7a;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .card.selected {
    border-color: #4a90d9;
    box-shadow: 0 0 0 1px #4a90d9, 0 4px 16px rgba(74, 144, 217, 0.25);
    transform: translateY(-1px);
  }

  .card-thumbnail {
    width: 100%;
    height: 140px;
    object-fit: cover;
    display: block;
    background: #0f0f23;
  }

  .card-thumbnail-placeholder {
    width: 100%;
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0f0f23;
    color: #4a4a6a;
    font-size: 13px;
  }

  .card-info {
    padding: 8px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .card-name {
    font-size: 12px;
    font-weight: 500;
    color: #c0c0d0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .card-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .card-badge.screen {
    background: rgba(74, 144, 217, 0.2);
    color: #6ab0f3;
  }

  .card-badge.window {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #2a2a4a;
  }

  .btn-cancel {
    background: #2a2a4a;
    color: #b0b0c0;
    border: 1px solid #3a3a5c;
    border-radius: 6px;
    padding: 6px 20px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .btn-cancel:hover {
    background: #3a3a5c;
    color: #e0e0e0;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: #5a5a7a;
    font-size: 14px;
  }
`
document.head.appendChild(styles)

const app = document.getElementById('app')!

let selectedId: string | null = null
let confirmTimer: ReturnType<typeof setTimeout> | null = null

function render(sources: Array<{id: string, name: string, type: string, thumbnail: string | null}>): void {
  app.innerHTML = ''

  const header = document.createElement('div')
  header.className = 'header'
  header.innerHTML = '<h1>Select a source to capture</h1>'
  app.appendChild(header)

  if (sources.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    empty.textContent = 'No sources available'
    app.appendChild(empty)
  } else {
    const grid = document.createElement('div')
    grid.className = 'grid'

    for (const source of sources) {
      const card = document.createElement('div')
      card.className = 'card'
      card.dataset.id = source.id

      if (source.thumbnail) {
        const img = document.createElement('img')
        img.className = 'card-thumbnail'
        img.src = source.thumbnail
        img.alt = source.name
        img.draggable = false
        card.appendChild(img)
      } else {
        const placeholder = document.createElement('div')
        placeholder.className = 'card-thumbnail-placeholder'
        placeholder.textContent = 'No preview'
        card.appendChild(placeholder)
      }

      const info = document.createElement('div')
      info.className = 'card-info'

      const name = document.createElement('span')
      name.className = 'card-name'
      name.textContent = source.name
      name.title = source.name
      info.appendChild(name)

      const badge = document.createElement('span')
      badge.className = `card-badge ${source.type === 'screen' ? 'screen' : 'window'}`
      badge.textContent = source.type === 'screen' ? 'Screen' : 'Window'
      info.appendChild(badge)

      card.appendChild(info)

      card.addEventListener('click', () => {
        if (confirmTimer) {
          clearTimeout(confirmTimer)
          confirmTimer = null
        }

        selectedId = source.id

        const cards = grid.querySelectorAll('.card')
        cards.forEach((c) => c.classList.remove('selected'))
        card.classList.add('selected')

        confirmTimer = setTimeout(() => {
          api.select(source.id)
        }, 300)
      })

      grid.appendChild(card)
    }

    app.appendChild(grid)
  }

  const footer = document.createElement('div')
  footer.className = 'footer'

  const cancelBtn = document.createElement('button')
  cancelBtn.className = 'btn-cancel'
  cancelBtn.textContent = 'Cancel'
  cancelBtn.addEventListener('click', () => {
    if (confirmTimer) {
      clearTimeout(confirmTimer)
      confirmTimer = null
    }
    api.cancel()
  })
  footer.appendChild(cancelBtn)

  app.appendChild(footer)
}

api.onSources((sources) => {
  render(sources)
})
