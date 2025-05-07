<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal">
      <h3>Add New SSH Connection</h3>
      <form @submit.prevent="addConnection">
        <div>
          <label for="name">Name:</label>
          <input type="text" id="name" v-model="newConnection.name" required />
        </div>
        <div>
          <label for="host">Host:</label>
          <input type="text" id="host" v-model="newConnection.host" required />
        </div>
        <div>
          <label for="port">Port:</label>
          <input type="number" id="port" v-model.number="newConnection.port" required />
        </div>
        <div>
          <label for="username">Username:</label>
          <input type="text" id="username" v-model="newConnection.username" required />
        </div>
        <div>
          <label for="password">Password:</label>
          <input type="password" id="password" v-model="newConnection.password" />
        </div>
        <button type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Adding...' : 'Add Connection' }}
        </button>
        <p v-if="formError" class="error-message">{{ formError }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits(['close']);

const newConnection = ref({
  name: '',
  host: '',
  port: 22,
  username: '',
  password: '',
});

const isSubmitting = ref(false);
const formError = ref<string | null>(null);

const API_BASE_URL = 'http://localhost:3000/api/ssh-credentials';

async function addConnection() {
  isSubmitting.value = true;
  formError.value = null;
  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newConnection.value),
      credentials: 'include',
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Failed to add connection: ${response.statusText}`);
    }
    newConnection.value = { name: '', host: '', port: 22, username: '', password: '' };
    emit('close');
  } catch (error: any) {
    console.error('Error adding connection:', error);
    formError.value = error.message || 'Could not add SSH connection.';
  } finally {
    isSubmitting.value = false;
  }
}

function close() {
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background-color: #252526;
  color: #cccccc;
  padding: 20px;
  border-radius: 5px;
  width: 400px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}

.modal h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.2em;
}

.modal form div {
  margin-bottom: 10px;
}

.modal form label {
  display: block;
  margin-bottom: 5px;
  font-size: 0.9em;
}

.modal form input {
  width: calc(100% - 12px);
  padding: 6px;
  border: 1px solid #3c3c3c;
  border-radius: 3px;
  background-color: #3c3c3c;
  color: #cccccc;
  font-size: 0.9em;
}

.modal form button {
  background-color: #0e639c;
  color: white;
  padding: 6px 12px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.2s;
}

.modal form button:hover {
  background-color: #1177bb;
}

.modal form button:disabled {
  background-color: #555555;
  color: #888888;
  cursor: not-allowed;
}

.error-message {
  color: #ff6666;
  margin-top: 10px;
  font-size: 0.9em;
}
</style>
