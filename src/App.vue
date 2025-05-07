<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import TopBar from './components/TopBar.vue' // Import the TopBar component
</script>

<template>
  <TopBar /> <!-- Add the TopBar component here -->
  <div class="" style="margin-top: 50px;">
    <RouterView />
  </div>
</template>
