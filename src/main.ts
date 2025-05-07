import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)

export const app_url = "http://localhost:3000"
app.use(router)

app.mount('#app')
