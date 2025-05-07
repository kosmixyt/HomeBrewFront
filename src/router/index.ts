import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'; // Modified import
import HomeView from '../views/HomeView.vue';
import TerminalView from '../components/TerminalView.vue'; // Import TerminalView

const routes: Array<RouteRecordRaw> = [ // Define routes with RouteRecordRaw type
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/ssh-terminal', // New route for the terminal
    name: 'sshTerminal',
    component: TerminalView,
    props: route => ({ sshSessionId: route.query.id }), // Pass query.id as sshSessionId prop
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes, // Use the defined routes array
});

export default router;
