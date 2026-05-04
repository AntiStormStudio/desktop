import { mount } from 'svelte'
import { APP_PROFILE } from './lib/profile'
import Spotlight from './components/Spotlight.svelte'

document.title = `${APP_PROFILE.brand.name} - Spotlight`
const app = mount(Spotlight, {
  target: document.getElementById('app')!
})

export default app
