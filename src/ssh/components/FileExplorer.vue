<template>
  <div class="file-explorer" @click="hideContextMenu">
    <div class="file-explorer-header">
      <span>File Manager</span>
      <button class="close-button" @click="$emit('close')">×</button>
    </div>
    <div 
      class="drag-drop-area" 
      :class="{ 'drag-over': isDragOver }" 
      @dragover.prevent="handleDragOver" 
      @dragleave="handleDragLeave" 
      @drop="handleDrop"
    >
      <span v-if="!isDragOver">Drag & drop files here to upload</span>
      <span v-else>Drop files to upload</span>
    </div>
    <div class="path-bar">
      <button @click="goUp" :disabled="currentPath === '.' || isLoading" title="Go up a directory">
        &uarr; <!-- Up arrow -->
      </button>
      <input 
        type="text" 
        v-model="editablePath" 
        @keyup.enter="navigateToEditablePath"
        :disabled="isLoading"
        class="path-input"
        placeholder="Enter path and press Enter"
      />
      <button @click="navigateToEditablePath" :disabled="isLoading || editablePath === currentPath" title="Go to path">
        &rarr; <!-- Right arrow / Go icon -->
      </button>
    </div>
    <div v-if="isLoading" class="loading-message">Loading files...</div>
    <div v-else-if="error" class="error-message">{{ error }}</div>
    <ul v-else-if="files.length > 0" class="file-list" @contextmenu.prevent>
      <li 
        v-for="file in files" 
        :key="file.name" 
        @click="handleItemClick(file)"
        @contextmenu.prevent="showContextMenu(file, $event)"
        @dragstart="handleItemDragStart(file, $event)"
        draggable="true"
        :class="{ 'directory': file.isDirectory, 'file': file.isFile }"
        :title="`${file.name}\nSize: ${file.size} bytes\nModified: ${new Date(file.modifiedDate).toLocaleString()}`"
      >
        <span class="file-icon">{{ file.isDirectory ? '&#128193;' : '&#128196;' }}</span>
        <span class="file-name">{{ file.name }}</span>
      </li>
    </ul>
    <div v-else class="empty-directory-message">Directory is empty.</div>

    <!-- Hidden file input for uploads -->
    <input type="file" ref="fileUploadInputRef" @change="handleFileUploadAttempt" style="display: none;" />

    <!-- Context Menu -->
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      @click.stop
    >
      <ul class="context-menu-list">
        <template v-if="contextMenu.item">
          <li v-if="contextMenu.item.isFile" @click="downloadContextAction">Download</li>
          <template v-if="contextMenu.item.isDirectory">
            <li @click="uploadContextAction">Upload here</li>
            <li @click="openTerminalContextAction">Open terminal here</li>
          </template>
        </template>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';

interface FileItem {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymLink: boolean;
  size: number;
  permissionsOctal: string;
  modifiedDate: string;
  longname: string;
}

const props = defineProps<{
  sshSessionId: string | null;
}>();

const emit = defineEmits(['open-terminal', 'file-dragged', 'close']);

const files = ref<FileItem[]>([]);
const currentPath = ref<string>('.');
const editablePath = ref<string>('.');
const isLoading = ref(false);
const error = ref<string | null>(null);

const API_BASE_URL = 'http://localhost:3000/api/sftp';

// Context Menu State
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  item: null as FileItem | null,
});

// File Upload State
const fileUploadInputRef = ref<HTMLInputElement | null>(null);
const uploadTargetDirectoryPath = ref<string>('');

const isDragOver = ref(false);

async function fetchFiles(sessionId: string, path: string) {
  if (!sessionId) return;
  isLoading.value = true;
  error.value = null;
  try {
    const response = await fetch(`${API_BASE_URL}/${sessionId}/list?path=${encodeURIComponent(path)}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to list files: ${response.statusText}`);
    }
    files.value = await response.json();
    currentPath.value = path;
    editablePath.value = path;
    hideContextMenu();
  } catch (err: any) {
    console.error('Error fetching files:', err);
    error.value = err.message || 'Could not load file list.';
    files.value = [];
  } finally {
    isLoading.value = false;
  }
}

function handleItemClick(item: FileItem) {
  if (item.isDirectory) {
    const newPath = currentPath.value === '.' ? item.name : `${currentPath.value}/${item.name}`;
    if (props.sshSessionId) {
      fetchFiles(props.sshSessionId, newPath);
    }
  } else {
    console.log('File clicked:', item.name);
  }
}

function handleItemDragStart(item: FileItem, event: DragEvent) {
  const filePath = currentPath.value === '.' ? item.name : `${currentPath.value}/${item.name}`;
  event.dataTransfer?.setData('text/plain', filePath);
  emit('file-dragged', filePath);
}

function goUp() {
  if (currentPath.value === '.' || isLoading.value) return;

  const parts = currentPath.value.split('/');
  parts.pop(); 
  const newPath = parts.length > 0 ? parts.join('/') : '.';
  if (props.sshSessionId) {
    fetchFiles(props.sshSessionId, newPath);
  }
}

function navigateToEditablePath() {
  if (isLoading.value || !props.sshSessionId || editablePath.value === currentPath.value) {
    return;
  }
  fetchFiles(props.sshSessionId, editablePath.value.trim() || '.');
}

function showContextMenu(item: FileItem, event: MouseEvent) {
  contextMenu.value.item = item;
  contextMenu.value.x = event.clientX;
  contextMenu.value.y = event.clientY;
  contextMenu.value.visible = true;
}

function hideContextMenu() {
  contextMenu.value.visible = false;
  contextMenu.value.item = null;
}

async function downloadContextAction() {
  if (!contextMenu.value.item || !props.sshSessionId) return;
  const item = contextMenu.value.item;
  const filePath = currentPath.value === '.' ? item.name : `${currentPath.value}/${item.name}`;
  
  const downloadUrl = `${API_BASE_URL}/${props.sshSessionId}/download?path=${encodeURIComponent(filePath)}`;
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = item.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  hideContextMenu();
}

function uploadContextAction() {
  if (!contextMenu.value.item || !contextMenu.value.item.isDirectory) return;
  uploadTargetDirectoryPath.value = currentPath.value === '.' ? contextMenu.value.item.name : `${currentPath.value}/${contextMenu.value.item.name}`;
  fileUploadInputRef.value?.click();
  hideContextMenu();
}

async function openTerminalContextAction() {
  if (!contextMenu.value.item || !contextMenu.value.item.isDirectory || !props.sshSessionId) return;
  const dirPath = currentPath.value === '.' ? contextMenu.value.item.name : `${currentPath.value}/${contextMenu.value.item.name}`;
  
  try {
    const response = await fetch(`${API_BASE_URL}/${props.sshSessionId}/validate-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', },
      credentials: 'include',
      body: JSON.stringify({ path: dirPath }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Path validation failed: ${response.statusText}`);
    }
    const result = await response.json();
    emit('open-terminal', result.path);
  } catch (err: any) {
    console.error('Error validating path for terminal:', err);
    error.value = `Could not open terminal at "${dirPath}": ${err.message}`;
  }
  hideContextMenu();
}

function handleFileUploadAttempt(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0 && props.sshSessionId) {
    const file = input.files[0];
    performUpload(props.sshSessionId, file, uploadTargetDirectoryPath.value);
  }
  input.value = '';
}

async function performUpload(sessionId: string, file: File, remoteDir: string) {
  isLoading.value = true;
  error.value = null;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', remoteDir);

  try {
    const response = await fetch(`${API_BASE_URL}/${sessionId}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
    }
    if (remoteDir === currentPath.value || remoteDir.startsWith(currentPath.value + '/')) {
      fetchFiles(sessionId, currentPath.value);
    }
  } catch (err: any) {
    console.error('Error uploading file:', err);
    error.value = err.message || 'Could not upload file.';
  } finally {
    isLoading.value = false;
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragOver.value = true;
}

function handleDragLeave() {
  isDragOver.value = false;
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  isDragOver.value = false;

  if (!props.sshSessionId) {
    console.error('No SSH session ID available for file upload.');
    return;
  }

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    for (const file of files) {
      performUpload(props.sshSessionId, file, currentPath.value);
    }
  }
}

watch(() => props.sshSessionId, (newSessionId, oldSessionId) => {
  const initialPath = '.';
  currentPath.value = initialPath; 
  editablePath.value = initialPath;
  files.value = []; 
  if (newSessionId) {
    fetchFiles(newSessionId, initialPath);
  }
  hideContextMenu();
}, { immediate: true });

watch(currentPath, (newPath) => {
  if (editablePath.value !== newPath) {
    editablePath.value = newPath;
  }
  hideContextMenu();
});

onMounted(() => {
  document.addEventListener('click', handleClickOutsideContextMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutsideContextMenu);
});

function handleClickOutsideContextMenu(event: MouseEvent) {
  if (contextMenu.value.visible) {
    hideContextMenu();
  }
}

defineExpose({
  refresh: () => {
    if (props.sshSessionId) fetchFiles(props.sshSessionId, currentPath.value);
  }
});

</script>

<style scoped>
.file-explorer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #252526;
  color: #cccccc;
  font-size: 0.9em;
  overflow: hidden;
  position: relative;
}

.file-explorer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 10px;
  background-color: #333333;
  border-bottom: 1px solid #3c3c3c;
}

.close-button {
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  font-size: 1.2em;
}

.close-button:hover {
  color: #ff6666;
}

.path-bar {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  background-color: #333333;
  border-bottom: 1px solid #3c3c3c;
  flex-shrink: 0;
}

.path-bar button {
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  font-size: 1.2em;
  margin-right: 8px;
  padding: 2px 5px;
  flex-shrink: 0;
}
.path-bar button:last-child {
  margin-right: 0;
  margin-left: 8px;
}
.path-bar button:disabled {
  color: #666666;
  cursor: not-allowed;
}
.path-bar button:hover:not(:disabled) {
  background-color: #4f4f52;
  border-radius: 3px;
}

.path-input {
  flex-grow: 1;
  background-color: #3c3c3c;
  color: #cccccc;
  border: 1px solid #2a2a2a;
  padding: 4px 6px;
  border-radius: 3px;
  font-size: 0.9em;
  min-width: 100px;
}
.path-input:disabled {
  background-color: #4a4a4a;
  color: #888888;
}

.loading-message,
.error-message,
.empty-directory-message {
  padding: 15px;
  text-align: center;
  color: #888888;
}

.error-message {
  color: #ff6666;
}

.file-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  flex-grow: 1;
}

.file-list li {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  cursor: pointer;
  border-bottom: 1px solid #303030;
  transition: background-color 0.1s ease-in-out;
}

.file-list li:hover {
  background-color: #37373d;
}

.file-list li:last-child {
  border-bottom: none;
}

.file-icon {
  margin-right: 8px;
  width: 20px;
  text-align: center;
}

.file-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.directory .file-name {
  font-weight: bold;
}

.context-menu {
  position: fixed;
  background-color: #2d2d30;
  border: 1px solid #3c3c3c;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
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

.drag-drop-area {
  text-align: center;
  padding: 10px;
  margin: 10px 0;
  border: 2px dashed #555;
  border-radius: 5px;
  color: #cccccc;
  background-color: #2d2d2d;
  transition: background-color 0.2s, border-color 0.2s;
}

.drag-drop-area.drag-over {
  background-color: #3c3c3c;
  border-color: #007acc;
  color: #ffffff;
}
</style>