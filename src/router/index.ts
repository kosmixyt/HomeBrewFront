import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import HomePage from '../views/HomePage.vue'; // Import HomePage
// import SshPage from '../ssh/views/SshPage.vue'; // Update path for SshPage
import TerminalView from '../components/TerminalView.vue'; // Import TerminalView
import SshPage from '@/views/SshPage.vue';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'home',
    component: HomePage, // Set HomePage as the root route
  },
  {
    path: '/ssh',
    name: 'ssh',
    component: SshPage, // Use SshPage for SSH-related features
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
