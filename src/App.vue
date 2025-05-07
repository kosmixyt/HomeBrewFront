<script setup lang="ts">
import TopBar from './components/TopBar.vue';
import { RouterView, useRoute } from 'vue-router';
import { ref, computed } from 'vue';

const showAddConnectionModal = ref(false); // Track modal visibility
console.log('showAddConnectionModal:', showAddConnectionModal.value);

const route = useRoute();
const isSshPage = computed(() => route.name === 'ssh'); // Adjust 'SshPage' to match your route name
</script>

<template>
  <TopBar 
    :show-add-connection="isSshPage" 
    @open-add-connection-modal="showAddConnectionModal = true; console.log('open connection modal')" 
  />
  <div style="margin-top: 50px;">
  <RouterView v-model:show-add-connection-modal="showAddConnectionModal" />
  </div>
</template>

<style scoped>
/* No additional styles needed */
</style>
