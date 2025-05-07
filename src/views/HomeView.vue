<template>
  <div class="ssh-manager" @click="hideContextMenu">
    <div class="connections-list">
      <h3>Your SSH Connections</h3>
      <div v-if="isLoading" class="loading">Loading connections...</div>
      <div v-else-if="fetchError" class="error-message">{{ fetchError }}</div>
      <ul v-else-if="credentials.length > 0">
        <li v-for="cred in credentials" :key="cred.id" class="connection-item"
          :class="{ 'selected': cred.id === props.selectedId }" @click="selectHost(cred.id)"
          @contextmenu.prevent="showContextMenu(cred, $event)">
          <div class="connection-info">
            <strong>{{ cred.name }}</strong>
            <span>{{ cred.username }}@{{ cred.host }}:{{ cred.port }}</span>
          </div>
          <div class="connection-actions">
            <button @click.stop="deleteConnection(cred.id)" class="delete-button" :disabled="isDeleting === cred.id"
              title="Delete">
              &#x1F5D1; <!-- Trash can icon -->
            </button>
          </div>
        </li>
      </ul>
      <div v-else class="no-connections-message">No SSH connections configured yet.</div>
    </div>

    <!-- Context Menu -->
    <div v-if="contextMenu.visible" class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }" @click.stop>
      <ul class="context-menu-list">
        <li @click="openFileManager">Open File Manager</li>
        <li @click="closeAllFileManagers">Close All File Managers</li>
        <li @click="closeAllTerminals">Close All Terminals</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineEmits, defineProps } from 'vue';

interface SshCredential {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
}

const props = defineProps<{
  selectedId?: string | null;
}>();

const emit = defineEmits(['host-selected', 'open-file-manager', 'close-all-file-managers', 'close-all-terminals']);

const credentials = ref<SshCredential[]>([]);
const isLoading = ref(true);
const fetchError = ref<string | null>(null);
const formError = ref<string | null>(null);
const isSubmitting = ref(false);
const isDeleting = ref<string | null>(null);

const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  connection: null as SshCredential | null,
});

const newConnection = ref({
  name: '',
  host: '',
  port: 22,
  username: '',
  password: '',
});

const API_BASE_URL = 'http://localhost:3000/api/ssh-credentials';

async function fetchCredentials() {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await fetch(API_BASE_URL, {
      credentials: 'include',
    });
    if (!response.ok) {
      if (response.status === 401) {
        fetchError.value = 'Unauthorized. Please log in.';
        return;
      }
      throw new Error(`Failed to fetch credentials: ${response.statusText}`);
    }
    credentials.value = await response.json();
  } catch (error: any) {
    console.error('Error fetching credentials:', error);
    fetchError.value = error.message || 'Could not load SSH connections.';
  } finally {
    isLoading.value = false;
  }
}

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
    await fetchCredentials();
  } catch (error: any) {
    console.error('Error adding connection:', error);
    formError.value = error.message || 'Could not add SSH connection.';
  } finally {
    isSubmitting.value = false;
  }
}

async function deleteConnection(id: string) {
  if (!confirm('Are you sure you want to delete this SSH connection?')) {
    return;
  }
  isDeleting.value = id;
  formError.value = null;
  try {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to delete connection: ${response.statusText}`);
    }
    await fetchCredentials();
  } catch (error: any) {
    console.error('Error deleting connection:', error);
    fetchError.value = error.message || 'Could not delete SSH connection.';
  } finally {
    isDeleting.value = null;
  }
}

function selectHost(credentialId: string) {
  emit('host-selected', credentialId);
}

function showContextMenu(connection: SshCredential, event: MouseEvent) {
  contextMenu.value.connection = connection;
  contextMenu.value.x = event.clientX;
  contextMenu.value.y = event.clientY;
  contextMenu.value.visible = true;
}

function hideContextMenu() {
  contextMenu.value.visible = false;
  contextMenu.value.connection = null;
}

function openFileManager() {
  if (contextMenu.value.connection) {
    emit('open-file-manager', contextMenu.value.connection.id);
  }
  hideContextMenu();
}

function closeAllFileManagers() {
  emit('close-all-file-managers');
  hideContextMenu();
}

function closeAllTerminals() {
  if (contextMenu.value.connection) {
    emit('close-all-terminals', contextMenu.value.connection.id);
  }
  hideContextMenu();
}

onMounted(() => {
  fetchCredentials();
});
</script>

<style scoped>
.ssh-manager {
  background-color: #252526;
  color: #cccccc;
  padding: 10px;
  height: 100%;
  /* Tries to fill its container (.sidebar-connections-section) */
  display: flex;
  flex-direction: column;
  /* overflow-y: hidden; -- Already set, good. Child .connections-list will scroll. */
}

.new-connection-form {
  /* This section should not grow, it has fixed content */
  flex-shrink: 0;
  background-color: transparent;
  padding: 0;
  margin-bottom: 15px;
  box-shadow: none;
}

.connections-list {
  flex-grow: 1;
  /* This allows the list to take available space and scroll */
  overflow-y: auto;
  background-color: transparent;
  padding: 0;
  margin-bottom: 0;
  /* No margin at the bottom of the scrolling list */
  box-shadow: none;
}

.new-connection-form h3,
.connections-list h3 {
  margin-top: 0;
  color: #cccccc;
  border-bottom: 1px solid #333333;
  padding-bottom: 8px;
  margin-bottom: 10px;
  font-size: 0.9em;
  text-transform: uppercase;
  font-weight: normal;
  padding-left: 5px;
  /* Indent like VSCode section headers */
}

.new-connection-form div {
  margin-bottom: 10px;
  padding: 0 5px;
}

.new-connection-form label {
  display: block;
  margin-bottom: 3px;
  font-weight: normal;
  color: #aaaaaa;
  font-size: 0.9em;
}

.new-connection-form input[type="text"],
.new-connection-form input[type="number"],
.new-connection-form input[type="password"] {
  width: calc(100% - 12px);
  padding: 6px;
  border: 1px solid #3c3c3c;
  border-radius: 3px;
  box-sizing: border-box;
  background-color: #3c3c3c;
  color: #cccccc;
  font-size: 0.9em;
}

button {
  background-color: #0e639c;
  color: white;
  padding: 6px 12px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.2s;
  margin-top: 5px;
  /* Space above button */
}

button:hover {
  background-color: #1177bb;
}

button:disabled {
  background-color: #555555;
  color: #888888;
  cursor: not-allowed;
}

.error-message {
  color: #ff6666;
  /* Brighter red for dark background */
  margin-top: 10px;
  font-size: 0.9em;
  padding: 0 5px;
}

.loading,
.no-connections-message {
  text-align: center;
  padding: 20px;
  color: #888888;
  font-size: 0.9em;
}

.connections-list ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.connection-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  /* Reduced padding */
  border-bottom: none;
  /* Remove individual borders, rely on hover/selection */
  cursor: pointer;
  transition: background-color 0.1s ease-in-out;
  border-radius: 3px;
  /* Slight rounding */
  margin: 1px 0;
  /* Minimal margin */
}

.connection-item:hover {
  background-color: #37373d;
  /* VSCode hover color */
}

.connection-item.selected {
  background-color: #094771;
  /* VSCode selected color (when focused) */
  color: white;
}

.connection-item.selected .connection-info strong,
.connection-item.selected .connection-info span {
  color: white;
}


.connection-info {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  /* Stack name and details */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.connection-info strong {
  color: #d4d4d4;
  /* Main text color for items */
  font-size: 0.95em;
  font-weight: normal;
}

.connection-info span {
  font-size: 0.8em;
  color: #9e9e9e;
  /* Subtler color for details */
}

.connection-actions {
  display: flex;
  align-items: center;
}

.connection-actions .delete-button {
  background-color: transparent;
  color: #cccccc;
  padding: 2px 4px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 1em;
  /* Adjust for icon size */
  line-height: 1;
  opacity: 0.6;
  /* Less prominent */
  margin-left: 8px;
}

.connection-item:hover .connection-actions .delete-button {
  opacity: 1;
  /* Show more clearly on hover */
  background-color: #4f4f52;
  /* Slight background on hover for button */
}

.connection-actions .delete-button:hover {
  color: #ff8787;
  /* Reddish tint on hover for delete */
  background-color: #5f4040 !important;
}

/* Remove old connect button style as click on item connects */
.connect-button {
  display: none;
}

.context-menu {
  position: fixed;
  background-color: #2d2d30;
  border: 1px solid #3c3c3c;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  min-width: 150px;
  border-radius: 4px;
}

.context-menu-list {
  list-style: none;
  padding: 5px 0;
  margin: 0;
}

.context-menu-list li {
  padding: 8px 15px;
  cursor: pointer;
  color: #cccccc;
  font-size: 0.9em;
}

.context-menu-list li:hover {
  background-color: #007acc;
  color: #ffffff;
}
</style>
