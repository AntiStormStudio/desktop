import { mount } from 'svelte'
import { APP_PROFILE } from './lib/profile'
import VoiceInput from './components/VoiceInput.svelte'

document.title = `${APP_PROFILE.brand.name} - Voice Input`
const app = mount(VoiceInput, {
  target: document.getElementById('app')!
})

export default app
