import { mount } from 'svelte'

import './app.css'
import { initI18n } from './lib/i18n'
import { APP_PROFILE } from './lib/profile'

import App from './App.svelte'

document.title = APP_PROFILE.brand.name
initI18n()

const app = mount(App, {
  target: document.getElementById('app')!
})

export default app
