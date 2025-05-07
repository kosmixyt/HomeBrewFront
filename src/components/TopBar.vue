<template>
  <div class="top-bar">
    <div class="left-section">
      <button @click="openAddConnectionModal" class="add-connection-button">Add Connection</button>
    </div>
    <div class="right-section">
      <div v-if="loading">
        <span>Loading user status...</span>
      </div>
      <div v-else-if="user">
        <span>Welcome, {{ user.name || user.email }}!</span>
      </div>
      <div v-else>
        <span>You are not logged in.</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
}

const user = ref<UserProfile | null>(null);
const loading = ref(true);

const emit = defineEmits(['open-add-connection-modal']);

function openAddConnectionModal() {
  emit('open-add-connection-modal');
}

onMounted(async () => {
  try {
    const response = await fetch('http://localhost:3000/users/profile', {
      credentials: 'include',
    });
    if (response.ok) {
      user.value = await response.json();
    } else {
      user.value = null;
      if (response.status === 401 || response.status === 404) {
        window.location.href = 'http://localhost:3000/auth/signin';
      } else {
        console.warn('Failed to fetch user profile:', response.status, await response.text());
      }
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    user.value = null;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #333333;
  color: #cccccc;
  padding: 12px 25px;
  width: 100%;
  box-sizing: border-box;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  height: 50px;
  border-bottom: 1px solid #1e1e1e;
}

.left-section {
  display: flex;
  align-items: center;
}

.add-connection-button {
  background-color: #0e639c;
  color: white;
  padding: 6px 12px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.2s;
}

.add-connection-button:hover {
  background-color: #1177bb;
}

.right-section {
  text-align: right;
}

.right-section span {
  color: #cccccc;
}
</style>
