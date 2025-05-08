<template>
  <div class="docker-page">
    <h1>Docker Management</h1>
    <p>Manage your Docker containers and images across your SSH connections.</p>

    <div v-if="fetchError" class="error-message-container">
      <div class="error-message-content">
        <span>{{ fetchError }}</span>
        <button @click="clearFetchError" class="dismiss-error-button" title="Dismiss">×</button>
      </div>
    </div>

    <div class="ssh-connections">
      <h2>Select SSH Connection</h2>
      <div v-if="isLoading" class="loading">Loading SSH connections...</div>
      <select v-else v-model="selectedCredentialId" @change="fetchDockerInfo">
        <option value="">Select a connection</option>
        <option v-for="cred in credentials" :key="cred.id" :value="cred.id">
          {{ cred.name }} ({{ cred.username }}@{{ cred.host }}:{{ cred.port }})
        </option>
      </select>
    </div>

    <!-- Bouton Créer un conteneur -->
    <div v-if="selectedCredentialId" class="create-container-button-area">
      <button @click="showCreateContainerModal = true" class="create-button">
        Create Container
      </button>
    </div>

    <div v-if="selectedCredentialId && !isDockerLoading" class="docker-info">
      <div class="pb-4">
        <h2>Containers</h2>
        <label class="pb-4">
          <input type="checkbox" v-model="showOnlyRunning" />
          Show only running containers
        </label>
      </div>
      <div v-if="filteredContainers.length === 0" class="no-containers">
        {{ showOnlyRunning ? 'No running containers found' : 'No containers found' }}
      </div>
      <div v-else class="containers-grid">
        <div v-for="container in filteredContainers" :key="container.Id" class="container-card">
          <div class="container-header">
            <h3>{{ container.Names[0].replace('/', '') }}</h3>
            <span :class="container.State === 'running' ? 'status-running' : 'status-stopped'">
              {{ container.State }}
            </span>
          </div>
          <div class="container-details">
            <p><strong>Image:</strong> {{ container.Image }}</p>
            <p><strong>Status:</strong> {{ container.Status }}</p>
            <p><strong>Ports:</strong> {{ container.Ports.map(p => p.PublicPort).join(', ') || 'None' }}</p>
          </div>
          <div class="container-actions">
            <button 
              v-if="container.State !== 'running'" 
              @click="startContainer(container)" 
              :disabled="actionInProgressContainerId === container.Id && currentAction === 'start'"
              class="action-button start-button">
              {{ (actionInProgressContainerId === container.Id && currentAction === 'start') ? 'Starting...' : 'Start' }}
            </button>
            <button 
              v-if="container.State === 'running'" 
              @click="stopContainer(container)" 
              :disabled="actionInProgressContainerId === container.Id && currentAction === 'stop'"
              class="action-button stop-button">
              {{ (actionInProgressContainerId === container.Id && currentAction === 'stop') ? 'Stopping...' : 'Stop' }}
            </button>
            <button 
              v-if="container.State === 'running'" 
              @click="openShell(container)" 
              :disabled="actionInProgressContainerId === container.Id"
              class="shell-button">
              Open Shell
            </button>
            <button 
              @click="openLogsModal(container)"
              :disabled="actionInProgressContainerId === container.Id"
              class="action-button logs-button">
              View Logs
            </button>
            <button 
              @click="confirmDeleteContainer(container)"
              :disabled="actionInProgressContainerId === container.Id"
              class="action-button delete-button" title="Delete Container">
              &#x1F5D1;
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="isDockerLoading" class="loading">Loading Docker information...</div>

    <div v-if="selectedCredentialId && !isImagesLoading" class="docker-info images-section">
      <h2>Images</h2>
      <div v-if="images.length === 0" class="no-images">No images found.</div>
      <div v-else class="images-grid">
        <div v-for="image in images" :key="image.Id" class="image-card">
          <div class="image-header">
            <h3>{{ image.RepoTags && image.RepoTags.length > 0 ? image.RepoTags[0] : 'Untagged' }}</h3>
          </div>
          <div class="image-details">
            <p><strong>ID:</strong> {{ image.Id.substring(0, 12) }}</p>
            <p><strong>Size:</strong> {{ formatSize(image.Size) }}</p>
            <p><strong>Created:</strong> {{ formatDate(image.Created) }}</p>
          </div>
          <div class="image-actions">
            <button 
              @click="confirmDeleteImage(image)"
              :disabled="actionInProgressImageId === image.Id" 
              class="action-button delete-button" title="Delete Image">
              &#x1F5D1;
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Terminal Modal -->
    <div v-if="showTerminal" class="terminal-modal" @click.self="closeShell">
      <div class="terminal-container" ref="terminalContainer">
        <div class="terminal-header">
          <h3>Terminal: {{ currentContainer?.Names[0].replace('/', '') }}</h3>
          <button @click="closeShell" class="close-button">×</button>
        </div>
        <div class="terminal" ref="terminal"></div>
      </div>
    </div>
    <!-- Logs Modal -->
    <div v-if="showLogsModal" class="logs-modal" @click.self="closeLogsModal">
      <div class="logs-container">
        <div class="logs-header">
          <h3>Logs: {{ currentContainerForLogs?.Names[0].replace('/', '') }}</h3>
          <button @click="closeLogsModal" class="close-button">×</button>
        </div>
        <pre class="logs-content" ref="logsContentRef">{{ currentLogs }}</pre>
      </div>
    </div>

    <!-- Modal de création de conteneur -->
    <div v-if="showCreateContainerModal" class="modal-overlay" @click.self="closeCreateContainerModal">
      <div class="create-container-modal">
        <div class="modal-header">
          <h3>Create New Container</h3>
          <button @click="closeCreateContainerModal" class="close-button">×</button>
        </div>
        
        <div class="modal-tabs">
          <button 
            :class="{ 'active-tab': createContainerTab === 'docker-run' }" 
            @click="createContainerTab = 'docker-run'"
          >
            Docker Run
          </button>
          <button 
            :class="{ 'active-tab': createContainerTab === 'compose' }" 
            @click="createContainerTab = 'compose'"
          >
            Docker Compose
          </button>
        </div>

        <!-- Tab Docker Run -->
        <div v-show="createContainerTab === 'docker-run'" class="tab-content">
          <div class="docker-run-input">
            <label>Enter Docker Run Command:</label>
            <input 
              v-model="dockerRunCommand" 
              type="text" 
              placeholder="docker run -p 8080:80 -v /local/path:/container/path -e ENV=value nginx"
              class="docker-run-command"
            />
            <button @click="parseDockerRun" class="parse-button" :disabled="!dockerRunCommand">Parse</button>
          </div>

          <div class="editor-area">
            <label>Container Configuration (JSON):</label>
            <div class="editor-controls">
              <button @click="applyContainerConfig" class="apply-button" :disabled="isCreatingContainer">
                {{ isCreatingContainer ? 'Creating...' : 'Create Container' }}
              </button>
              <label>
                <input type="checkbox" v-model="startContainerAfterCreation"> 
                Start after creation
              </label>
            </div>
            <textarea 
              v-model="containerConfig" 
              class="config-editor" 
              rows="15"
              placeholder="Container configuration will appear here after parsing, or you can edit manually..."
            ></textarea>
          </div>
        </div>

        <!-- Tab Docker Compose -->
        <div v-show="createContainerTab === 'compose'" class="tab-content">
          <div class="editor-area">
            <label>Docker Compose File (YAML):</label>
            <div class="editor-controls">
              <button @click="applyDockerCompose" class="apply-button" :disabled="isCreatingContainer">
                {{ isCreatingContainer ? 'Creating...' : 'Apply Docker Compose' }}
              </button>
            </div>
            <textarea 
              v-model="dockerComposeConfig" 
              class="config-editor" 
              rows="20"
              placeholder="version: '3'
services:
  web:
    image: nginx
    ports:
      - '8080:80'
    volumes:
      - ./html:/usr/share/nginx/html"
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount, nextTick } from 'vue';
import { app_url } from '../main';
import { io, Socket } from 'socket.io-client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface SshCredential {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
}

interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  Status: string;
  State: string;
  Ports: { PublicPort?: number }[];
}

interface DockerImage {
  Id: string;
  RepoTags: string[];
  Size: number;
  Created: number;
}

const credentials = ref<SshCredential[]>([]);
const selectedCredentialId = ref<string>('');
const containers = ref<DockerContainer[]>([]);
const images = ref<DockerImage[]>([]);
const isLoading = ref(true);
const isDockerLoading = ref(false);
const isImagesLoading = ref(false);
const fetchError = ref<string | null>(null);
const showOnlyRunning = ref(true); // Filtre activé par défaut

// Terminal-related refs
const showTerminal = ref(false);
const terminal = ref<HTMLElement | null>(null);
const terminalContainer = ref<HTMLElement | null>(null);
const currentContainer = ref<DockerContainer | null>(null);
const xtermInstance = ref<Terminal | null>(null);
const fitAddon = ref<FitAddon | null>(null);
const socket = ref<Socket | null>(null);

const actionInProgressContainerId = ref<string | null>(null);
const currentAction = ref<'start' | 'stop' | null>(null);

// Logs Modal Refs
const showLogsModal = ref(false);
const currentContainerForLogs = ref<DockerContainer | null>(null);
const currentLogs = ref<string>('');
const logsSocket = ref<Socket | null>(null);
const logsContentRef = ref<HTMLElement | null>(null);

const actionInProgressImageId = ref<string | null>(null);

// Références pour la création de conteneur
const showCreateContainerModal = ref(false);
const createContainerTab = ref<'docker-run' | 'compose'>('docker-run');
const dockerRunCommand = ref('');
const containerConfig = ref('');
const dockerComposeConfig = ref('');
const startContainerAfterCreation = ref(true);
const isCreatingContainer = ref(false);

const filteredContainers = computed(() => {
  if (showOnlyRunning.value) {
    return containers.value.filter(container => container.State === 'running');
  }
  return containers.value;
});

async function fetchCredentials() {
  isLoading.value = true;
  fetchError.value = null;
  try {
    const response = await fetch(`${app_url}/api/ssh-credentials`, {
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

async function fetchDockerInfo() {
  if (!selectedCredentialId.value) return;

  isDockerLoading.value = true;
  isImagesLoading.value = true;
  try {
    await Promise.all([fetchDockerImages(), fetchDockerContainers()]);
  } catch (error: any) {
    console.error('Error fetching Docker info:', error);
    fetchError.value = error.message || 'Could not load Docker information.';
  } finally {
    isDockerLoading.value = false;
    isImagesLoading.value = false;
  }
}

async function fetchDockerImages() {
  if (!selectedCredentialId.value) return;

  isImagesLoading.value = true;
  try {
    const response = await fetch(`${app_url}/api/docker/images/${selectedCredentialId.value}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch Docker images: ${response.statusText}`);
    }
    images.value = await response.json();
  } catch (error: any) {
    console.error('Error fetching Docker images:', error);
    fetchError.value = error.message || 'Could not load Docker images.';
  } finally {
    isImagesLoading.value = false;
  }
}

async function fetchDockerContainers() {
  if (!selectedCredentialId.value) return;

  isDockerLoading.value = true;
  try {
    const response = await fetch(`${app_url}/api/docker/containers/${selectedCredentialId.value}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch Docker containers: ${response.statusText}`);
    }
    containers.value = await response.json();
  } catch (error: any) {
    console.error('Error fetching Docker containers:', error);
    fetchError.value = error.message || 'Could not load Docker containers.';
  } finally {
    isDockerLoading.value = false;
  }
}

function formatSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Byte';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

function openShell(container: DockerContainer) {
  currentContainer.value = container;
  showTerminal.value = true;
  
  // Initialize terminal after Vue has updated the DOM
  setTimeout(() => {
    initTerminal(container);
  }, 100);
}

function initTerminal(container: DockerContainer) {
  if (!terminal.value) return;
  
  // Clean up any existing terminal
  if (xtermInstance.value) {
    xtermInstance.value.dispose();
  }
  if (socket.value) {
    socket.value.disconnect();
  }
  
  // Create new terminal instance
  xtermInstance.value = new Terminal({
    cursorBlink: true,
    theme: {
      background: '#1e1e1e',
      foreground: '#cccccc'
    },
    fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
    fontSize: 14
  });
  
  fitAddon.value = new FitAddon();
  xtermInstance.value.loadAddon(fitAddon.value);
  
  // Open terminal and connect to WebSocket
  xtermInstance.value.open(terminal.value);
  fitAddon.value.fit();
  
  // Connect to the shell WebSocket
  socket.value = io(`${app_url}/docker-shell`, {
    query: {
      credentialId: selectedCredentialId.value,
      containerId: container.Id
    },
    withCredentials: true
  });
  
  // Handle WebSocket events
  socket.value.on('connect', () => {
    console.log('Connected to Docker shell WebSocket');
    // Ne pas envoyer shell-init ici directement
  });

  socket.value.on('container-ready-for-shell-init', () => {
    console.log('[DockerPage] Received container-ready-for-shell-init');
    if (xtermInstance.value) {
      console.log('Sending shell-init event with terminal dimensions');
      socket.value!.emit('shell-init', { 
        cols: xtermInstance.value.cols || 80, 
        rows: xtermInstance.value.rows || 24 
      });
    }
  });
  
  socket.value.on('ready', () => {
    console.log('Shell is ready');
    // Hide spinner or loading indicator if you have one
  });
  
  socket.value.on('output', (data) => {
    xtermInstance.value!.write(data);
  });
  
  socket.value.on('error', (msg) => {
    xtermInstance.value!.write(`\r\nERROR: ${msg}\r\n`);
    setTimeout(() => {
      closeShell();
    }, 2000);
  });
  
  socket.value.on('exit', () => {
    xtermInstance.value!.write('\r\nConnection closed.\r\n');
    setTimeout(() => {
      closeShell();
    }, 2000);
  });
  
  // Send terminal input to server
  xtermInstance.value.onData((data) => {
    if (socket.value && socket.value.connected) {
      socket.value.emit('input', data);
    }
  });
  
  // Handle resize events
  window.addEventListener('resize', handleResize);
}

function handleResize() {
  if (fitAddon.value && xtermInstance.value && showTerminal.value) {
    fitAddon.value.fit();
    
    if (socket.value && socket.value.connected && xtermInstance.value) {
      socket.value.emit('resize', { 
        cols: xtermInstance.value.cols || 80, 
        rows: xtermInstance.value.rows || 24 
      });
    }
  }
}

function closeShell() {
  showTerminal.value = false;
  currentContainer.value = null;
  
  if (socket.value) {
    socket.value.disconnect();
    socket.value = null;
  }
  
  window.removeEventListener('resize', handleResize);
}

async function startContainer(container: DockerContainer) {
  if (actionInProgressContainerId.value) return; // Prevent multiple actions
  actionInProgressContainerId.value = container.Id;
  currentAction.value = 'start';
  try {
    const response = await fetch(`${app_url}/api/docker/containers/${selectedCredentialId.value}/${container.Id}/start`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to start container');
    }
    await fetchDockerContainers(); // Refresh the list
  } catch (error: any) {
    console.error('Error starting container:', error);
    fetchError.value = error.message || 'Could not start container.'; // Show error to user
  } finally {
    actionInProgressContainerId.value = null;
    currentAction.value = null;
  }
}

async function stopContainer(container: DockerContainer) {
  if (actionInProgressContainerId.value) return; // Prevent multiple actions
  actionInProgressContainerId.value = container.Id;
  currentAction.value = 'stop';
  try {
    const response = await fetch(`${app_url}/api/docker/containers/${selectedCredentialId.value}/${container.Id}/stop`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to stop container');
    }
    await fetchDockerContainers(); // Refresh the list
  } catch (error: any) {
    console.error('Error stopping container:', error);
    fetchError.value = error.message || 'Could not stop container.'; // Show error to user
  } finally {
    actionInProgressContainerId.value = null;
    currentAction.value = null;
  }
}

function openLogsModal(container: DockerContainer) {
  currentContainerForLogs.value = container;
  currentLogs.value = 'Fetching logs...'; // Initial message
  showLogsModal.value = true;
  connectToLogsWebSocket(container);
}

function connectToLogsWebSocket(container: DockerContainer) {
  if (logsSocket.value) {
    logsSocket.value.disconnect();
  }

  logsSocket.value = io(`${app_url}/docker-logs`, {
    query: {
      credentialId: selectedCredentialId.value,
      containerId: container.Id,
    },
    withCredentials: true,
  });

  logsSocket.value.on('connect', () => {
    console.log(`[DockerPage] Connected to logs WebSocket for ${container.Id}`);
    currentLogs.value = ''; // Clear initial message once connected
  });

  logsSocket.value.on('log', (logLine: string) => {
    currentLogs.value += logLine;
    // Auto-scroll to bottom
    nextTick(() => {
      if (logsContentRef.value) {
        logsContentRef.value.scrollTop = logsContentRef.value.scrollHeight;
      }
    });
  });

  logsSocket.value.on('info', (infoMsg: string) => {
    currentLogs.value += `\n--- ${infoMsg} ---\n`;
  });

  logsSocket.value.on('error', (errorMsg: string) => {
    console.error('[DockerPage] Logs WebSocket error:', errorMsg);
    currentLogs.value += `\n--- ERROR: ${errorMsg} ---\n`;
    // Optionally close modal or try to reconnect after a delay
  });

  logsSocket.value.on('disconnect', (reason: string) => {
    console.log(`[DockerPage] Disconnected from logs WebSocket: ${reason}`);
    if (reason !== 'io client disconnect') { // Avoid adding message if manually disconnected
        currentLogs.value += '\n--- Log stream disconnected. ---\n';
    }
  });
}

function closeLogsModal() {
  showLogsModal.value = false;
  currentContainerForLogs.value = null;
  if (logsSocket.value) {
    logsSocket.value.disconnect();
    logsSocket.value = null;
  }
  currentLogs.value = ''; // Clear logs
}

function confirmDeleteContainer(container: DockerContainer) {
  if (confirm(`Are you sure you want to delete container "${container.Names[0].replace('/', '')}"? This action cannot be undone.`)) {
    deleteContainer(container);
  }
}

async function deleteContainer(container: DockerContainer) {
  if (actionInProgressContainerId.value) return;
  actionInProgressContainerId.value = container.Id;
  currentAction.value = null; // ou un nouveau type 'delete' si nécessaire pour le texte du bouton
  try {
    const response = await fetch(`${app_url}/api/docker/containers/${selectedCredentialId.value}/${container.Id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete container');
    }
    await fetchDockerContainers(); // Rafraîchir la liste des conteneurs
    // Afficher un message de succès si souhaité
  } catch (error: any) {
    console.error('Error deleting container:', error);
    fetchError.value = error.message || 'Could not delete container.';
  } finally {
    actionInProgressContainerId.value = null;
  }
}

function confirmDeleteImage(image: DockerImage) {
  const imageName = image.RepoTags && image.RepoTags.length > 0 ? image.RepoTags[0] : image.Id.substring(0,12);
  if (confirm(`Are you sure you want to delete image "${imageName}"? This action cannot be undone.`)) {
    deleteImage(image);
  }
}

async function deleteImage(image: DockerImage) {
  if (actionInProgressImageId.value) return;
  actionInProgressImageId.value = image.Id;
  try {
    const response = await fetch(`${app_url}/api/docker/images/${selectedCredentialId.value}/${image.Id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete image');
    }
    await fetchDockerImages(); // Rafraîchir la liste des images
    // Afficher un message de succès si souhaité
  } catch (error: any) {
    console.error('Error deleting image:', error);
    fetchError.value = error.message || 'Could not delete image.';
  } finally {
    actionInProgressImageId.value = null;
  }
}

function clearFetchError() {
  fetchError.value = null;
}

// Fonctions de création de conteneur
function closeCreateContainerModal() {
  showCreateContainerModal.value = false;
  dockerRunCommand.value = '';
  containerConfig.value = '';
  dockerComposeConfig.value = '';
  isCreatingContainer.value = false;
}

async function parseDockerRun() {
  fetchError.value = null;
  if (!dockerRunCommand.value) return;

  try {
    const response = await fetch(`${app_url}/api/docker/containers/parse-docker-run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ command: dockerRunCommand.value })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to parse docker run command');
    }

    const data = await response.json();
    // Formater joliment l'objet JSON pour l'affichage
    containerConfig.value = JSON.stringify(data.containerConfig, null, 2);
  } catch (error: any) {
    console.error('Error parsing docker run command:', error);
    fetchError.value = error.message || 'Failed to parse docker run command';
  }
}

async function applyContainerConfig() {
  fetchError.value = null;
  if (!containerConfig.value) return;

  isCreatingContainer.value = true;
  try {
    let configObj;
    try {
      configObj = JSON.parse(containerConfig.value);
    } catch (parseError) {
      throw new Error('Invalid JSON configuration. Please check the syntax.');
    }

    const response = await fetch(`${app_url}/api/docker/containers/${selectedCredentialId.value}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        containerConfig: configObj,
        start: startContainerAfterCreation.value
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create container');
    }

    await fetchDockerContainers(); // Rafraîchir la liste des conteneurs
    closeCreateContainerModal(); // Fermer la modal après succès
    // Message de succès ?
  } catch (error: any) {
    console.error('Error creating container:', error);
    fetchError.value = error.message || 'Failed to create container';
  } finally {
    isCreatingContainer.value = false;
  }
}

async function applyDockerCompose() {
  fetchError.value = null;
  if (!dockerComposeConfig.value || !selectedCredentialId.value) return;

  isCreatingContainer.value = true;
  try {
    const response = await fetch(`${app_url}/api/docker/containers/${selectedCredentialId.value}/compose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        composeConfig: dockerComposeConfig.value
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to apply docker-compose');
    }

    await fetchDockerContainers(); // Rafraîchir la liste des conteneurs
    closeCreateContainerModal(); // Fermer la modal après succès
    // Message de succès ?
  } catch (error: any) {
    console.error('Error applying docker-compose:', error);
    fetchError.value = error.message || 'Failed to apply docker-compose configuration';
  } finally {
    isCreatingContainer.value = false;
  }
}

onMounted(() => {
  fetchCredentials();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  
  if (socket.value) {
    socket.value.disconnect();
  }
  
  if (xtermInstance.value) {
    xtermInstance.value.dispose();
  }
  if (logsSocket.value) {
    logsSocket.value.disconnect();
  }
});
</script>

<style scoped>
.docker-page {
  padding: 20px;
  color: #cccccc;
  background-color: #1e1e1e;
  height: calc(100vh - 90px);
  overflow-y: auto;
}

h1, h2 {
  color: #ffffff;
}

.ssh-connections {
  margin-bottom: 20px;
}

select {
  width: 100%;
  padding: 10px;
  background-color: #252526;
  color: #cccccc;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  font-size: 1em;
}

.loading, .no-containers, .no-images {
  text-align: center;
  padding: 20px;
  color: #888888;
}

.error-message {
  color: #ff6666;
  padding: 10px;
}

.filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.filter-toggle {
  /* display: flex; */
  align-items: center;
  gap: 8px;
  
  cursor: pointer;
}

.filter-toggle input {
  cursor: pointer;
}

.containers-grid, .images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.container-card, .image-card {
  background-color: #252526;
  border-radius: 8px;
  padding: 15px;
  transition: transform 0.2s;
}

.container-card:hover, .image-card:hover {
  transform: translateY(-3px);
}

.container-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.container-header h3, .image-header h3 {
  margin: 0;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-running {
  color: #4caf50;
}

.status-stopped {
  color: #f44336;
}

.container-details p, .image-details p {
  margin: 5px 0;
  color: #aaaaaa;
}

.container-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
  gap: 8px; /* Add gap between buttons */
}

.action-button, .shell-button {
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.2s;
}

.start-button {
  background-color: #28a745; /* Green */
  color: white;
}

.start-button:hover {
  background-color: #218838;
}

.stop-button {
  background-color: #dc3545; /* Red */
  color: white;
}

.stop-button:hover {
  background-color: #c82333;
}

.shell-button {
  background-color: #0e639c;
  color: white;
}

.shell-button:hover {
  background-color: #1177bb;
}

.action-button:disabled, .shell-button:disabled {
  background-color: #555555;
  color: #888888;
  cursor: not-allowed;
}

/* Terminal modal styles */
.terminal-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1002;
}

.terminal-container {
  width: 80%;
  height: 70%;
  background-color: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

.terminal-header {
  background-color: #252526;
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #333;
}

.terminal-header h3 {
  margin: 0;
  color: #ffffff;
}

.close-button {
  background: none;
  border: none;
  color: #cccccc;
  font-size: 1.5em;
  cursor: pointer;
}

.close-button:hover {
  color: #ffffff;
}

.terminal {
  flex: 1;
  padding: 5px;
  overflow: hidden;
}

.pb-4 {
  padding-bottom: 1rem;
}

.logs-button {
  background-color: #17a2b8; /* Teal */
  color: white;
}

.logs-button:hover {
  background-color: #138496;
}

/* Logs Modal Styles */
.logs-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1002; /* Ensure it's above other content */
}

.logs-container {
  width: 80%;
  max-width: 900px;
  height: 70%;
  max-height: 80vh;
  background-color: #1e1e1e; /* Dark background for logs */
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

.logs-header {
  background-color: #252526;
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #333;
}

.logs-header h3 {
  margin: 0;
  color: #ffffff;
}

.logs-content {
  flex: 1;
  background-color: #111; /* Slightly different background for log area */
  color: #cccccc;
  padding: 10px;
  overflow-y: auto; /* Enable vertical scrolling */
  white-space: pre-wrap; /* Preserve whitespace and wrap lines */
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 0.9em;
  border-radius: 0 0 8px 8px;
}

.delete-button {
  background-color: transparent; /* Rendre le fond transparent */
  color: #ff6b6b; /* Couleur rouge pour l'icône */
  padding: 4px 6px; /* Ajuster le padding */
  font-size: 1.2em; /* Augmenter légèrement la taille de l'icône */
  line-height: 1;
  border: 1px solid transparent; /* Optionnel: bordure au survol */
}

.delete-button:hover {
  color: #e74c3c; /* Rouge plus foncé au survol */
  background-color: rgba(255, 107, 107, 0.1); /* Léger fond rouge au survol */
  border-color: rgba(255, 107, 107, 0.3); /* Bordure au survol */
}

.delete-button:disabled {
  color: #555555;
  background-color: transparent;
  cursor: not-allowed;
}

.image-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

.images-section {
  margin-top: 30px; /* Ajouter un espace au-dessus de la section des images */
}

.error-message-container {
  background-color: #ffdddd; /* Rouge clair */
  border: 1px solid #ffaaaa;
  color: #d8000c; /* Rouge foncé pour le texte */
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 8px;
  position: sticky; /* Pour qu'il reste visible en haut lors du défilement */
  top: 10px;
  z-index: 1001; /* Au-dessus des autres éléments de la page mais potentiellement sous les modales */
}

.error-message-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dismiss-error-button {
  background: none;
  border: none;
  color: #d8000c;
  font-size: 1.5em;
  font-weight: bold;
  cursor: pointer;
  padding: 0 5px;
}

.dismiss-error-button:hover {
  color: #000;
}

/* Ajustement pour que la modale de logs soit au-dessus du message d'erreur */
.logs-modal, .terminal-modal {
  z-index: 1002; 
}

.create-container-button-area {
  margin: 20px 0;
  display: flex;
  justify-content: flex-end;
}

.create-button {
  background-color: #4CAF50; /* Vert */
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.95em;
  display: flex;
  align-items: center;
  gap: 8px;
}

.create-button:hover {
  background-color: #45a049;
}

/* Modal de création de conteneur */
.create-container-modal {
  width: 80%;
  max-width: 900px;
  background-color: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.modal-header {
  background-color: #252526;
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #333;
}

.modal-header h3 {
  margin: 0;
  color: #ffffff;
}

.modal-tabs {
  display: flex;
  background-color: #252526;
  padding: 0 15px;
  border-bottom: 1px solid #333;
}

.modal-tabs button {
  background: none;
  border: none;
  color: #ccc;
  padding: 10px 20px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin: 0 5px;
}

.modal-tabs button:hover {
  color: #fff;
}

.modal-tabs button.active-tab {
  color: #fff;
  border-bottom: 2px solid #0e639c;
}

.tab-content {
  padding: 15px;
  flex: 1;
  overflow-y: auto;
}

.docker-run-input {
  margin-bottom: 15px;
}

.docker-run-input label {
  display: block;
  margin-bottom: 5px;
  color: #ccc;
}

.docker-run-command {
  width: 85%;
  padding: 8px 10px;
  border: 1px solid #444;
  background-color: #252526;
  color: #fff;
  border-radius: 4px;
  font-family: monospace;
}

.parse-button {
  margin-left: 10px;
  padding: 8px 12px;
  background-color: #0e639c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.parse-button:hover {
  background-color: #1177bb;
}

.parse-button:disabled {
  background-color: #555;
  cursor: not-allowed;
}

.editor-area {
  display: flex;
  flex-direction: column;
}

.editor-area label {
  margin-bottom: 5px;
  color: #ccc;
}

.config-editor {
  padding: 10px;
  background-color: #1e1e1e;
  color: #ccc;
  border: 1px solid #444;
  border-radius: 4px;
  font-family: monospace;
  resize: vertical;
  flex: 1;
}

.editor-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.editor-controls label {
  display: flex;
  align-items: center;
  gap: 5px;
}

.apply-button {
  padding: 8px 16px;
  background-color: #4CAF50; /* Vert */
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.apply-button:hover {
  background-color: #45a049;
}

.apply-button:disabled {
  background-color: #555;
  cursor: not-allowed;
}
</style> 