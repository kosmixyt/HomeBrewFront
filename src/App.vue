<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import TopBar from './components/TopBar.vue';
import HomeView from './views/HomeView.vue';
import TerminalView from './components/TerminalView.vue';
import FileExplorer from './components/FileExplorer.vue';
import AddConnectionModal from './components/AddConnectionModal.vue'; // New modal component
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

interface TerminalTab {
  id: string;
  sshSessionId: string;
  name: string;
  initialPath?: string;
}

interface FileManagerInstance {
  id: string;
  sshSessionId: string;
}

const selectedSshSessionId = ref<string | null>(null); // Still used by HomeView selection
const sidebarWidth = ref(300);
const isResizing = ref(false);

const terminalTabs = ref<TerminalTab[]>([]);
const activeTerminalTabId = ref<string | null>(null);

const fileManagers = ref<FileManagerInstance[]>([]);

const activeTerminalTab = computed(() => {
  return terminalTabs.value.find(tab => tab.id === activeTerminalTabId.value) || null;
});

const showAddConnectionModal = ref(false);

const editingTabId = ref<string | null>(null); // Track which tab is being edited
const newTabName = ref<string>(''); // Temporary storage for the new tab name

const startEditingTab = (tabId: string, currentName: string) => {
  editingTabId.value = tabId;
  newTabName.value = currentName;
  nextTick(() => {
    const input = document.querySelector(`[data-tab-id="${tabId}"] input`) as HTMLInputElement;
    input?.focus();
    input?.select();
  });
};

const saveTabName = (tabId: string) => {
  const tab = terminalTabs.value.find(tab => tab.id === tabId);
  if (tab && newTabName.value.trim()) {
    tab.name = newTabName.value.trim();
  }
  editingTabId.value = null;
};

const cancelEditingTab = () => {
  editingTabId.value = null;
};

const openNewTerminalTab = (sshSessionId: string, name: string, initialPath?: string, makeActive: boolean = true) => {
  if (!sshSessionId) {
    console.warn('Cannot open terminal tab without sshSessionId');
    return;
  }
  const newTab: TerminalTab = {
    id: uuidv4(),
    sshSessionId,
    name: name || `Terminal ${terminalTabs.value.length + 1}`,
    initialPath: initialPath || '.', // Default to '.' if not provided
  };
  terminalTabs.value.push(newTab);
  if (makeActive) {
    activeTerminalTabId.value = newTab.id;
  }
  return newTab.id;
};

const closeTerminalTab = (tabIdToClose: string) => {
  const tabIndex = terminalTabs.value.findIndex(tab => tab.id === tabIdToClose);
  if (tabIndex === -1) return;

  terminalTabs.value.splice(tabIndex, 1);

  if (activeTerminalTabId.value === tabIdToClose) {
    if (terminalTabs.value.length > 0) {
      // Activate the previous tab, or the first one if the closed one was the first
      activeTerminalTabId.value = terminalTabs.value[Math.max(0, tabIndex - 1)]?.id || terminalTabs.value[0]?.id || null;
    } else {
      activeTerminalTabId.value = null;
    }
  }
};

const setActiveTerminalTab = (tabId: string) => {
  activeTerminalTabId.value = tabId;
};

const openNewFileManager = (sshSessionId: string) => {
  const newFileManager: FileManagerInstance = {
    id: uuidv4(),
    sshSessionId,
  };
  fileManagers.value.push(newFileManager);
};

const closeFileManager = (fileManagerId: string) => {
  const index = fileManagers.value.findIndex(fm => fm.id === fileManagerId);
  if (index !== -1) {
    fileManagers.value.splice(index, 1);
  }
};

const closeAllFileManagers = () => {
  fileManagers.value = [];
};

const handleFileDragToTerminal = (filePath: string) => {
  const activeTab = activeTerminalTab.value;
  if (activeTab) {
    const terminal = terminalTabs.value.find(tab => tab.id === activeTab.id);
    if (terminal) {
      const safePath = filePath.includes(' ') ? `"${filePath}"` : filePath;
      const command = `${safePath}`;
      const terminalView = document.querySelector(`[data-terminal-id="${activeTab.id}"]`) as any;
      terminalView?.executeCommand(command);
    }
  }
};

const closeAllTerminalsForHost = (sshSessionId: string) => {
  terminalTabs.value = terminalTabs.value.filter(tab => tab.sshSessionId !== sshSessionId);
  if (activeTerminalTabId.value && !terminalTabs.value.find(tab => tab.id === activeTerminalTabId.value)) {
    activeTerminalTabId.value = terminalTabs.value.length > 0 ? terminalTabs.value[0].id : null;
  }
};

// ... existing resize logic ...
const startResize = (event: MouseEvent) => {
  isResizing.value = true;
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
  event.preventDefault(); 
};

const doResize = (event: MouseEvent) => {
  if (isResizing.value) {
    const newWidth = event.clientX;
    if (newWidth > 150 && newWidth < window.innerWidth - 150) { 
      sidebarWidth.value = newWidth;
    }
  }
};

const stopResize = () => {
  isResizing.value = false;
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);
};

onUnmounted(() => {
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);
});

</script>

<template>
  <TopBar @open-add-connection-modal="showAddConnectionModal = true" />
  <div class="main-layout">
    <div class="sidebar" :style="{ width: sidebarWidth + 'px' }">
      <div class="sidebar-connections-section">
        <HomeView 
          @host-selected="openNewTerminalTab" 
          @open-file-manager="openNewFileManager"
          @close-all-file-managers="closeAllFileManagers"
          @close-all-terminals="closeAllTerminalsForHost"
          :selected-id="selectedSshSessionId" 
        />
      </div>
      <div v-for="fileManager in fileManagers" :key="fileManager.id" class="sidebar-file-explorer-section">
        <FileExplorer 
          :instance-id="fileManager.id"
          :ssh-session-id="fileManager.sshSessionId"
          @file-dragged="handleFileDragToTerminal"
          @close="closeFileManager(fileManager.id)"
        />
      </div>
    </div>
    <div class="resize-handle" @mousedown="startResize"></div>
    <div class="main-content">
      <div v-if="terminalTabs.length > 0" class="terminal-tabs-container">
        <ul class="terminal-tabs-list">
          <li
            v-for="tab in terminalTabs"
            :key="tab.id"
            :class="{ active: tab.id === activeTerminalTabId }"
            @click="setActiveTerminalTab(tab.id)"
            class="terminal-tab-item"
            :data-tab-id="tab.id"
          >
            <template v-if="editingTabId === tab.id">
              <input
                type="text"
                v-model="newTabName"
                @blur="saveTabName(tab.id)"
                @keyup.enter="saveTabName(tab.id)"
                @keyup.esc="cancelEditingTab"
                class="tab-name-input"
              />
            </template>
            <template v-else>
              <span class="tab-name" @dblclick="startEditingTab(tab.id, tab.name)">{{ tab.name }}</span>
            </template>
            <button @click.stop="closeTerminalTab(tab.id)" class="close-tab-button" title="Close terminal">×</button>
          </li>
        </ul>
        <div class="terminal-instance-area">
          <template v-for="tab in terminalTabs" :key="tab.id">
            <div v-show="tab.id === activeTerminalTabId" class="terminal-wrapper" :data-terminal-id="tab.id">
              <TerminalView
                :ssh-session-id="tab.sshSessionId"
                :initial-path="tab.initialPath"
                width="100%"
                height="100%" 
              />
            </div>
          </template>
        </div>
      </div>
      <div v-else class="placeholder-text">
        Select an SSH connection or open a terminal.
      </div>
    </div>
  </div>
  <AddConnectionModal v-if="showAddConnectionModal" @close="showAddConnectionModal = false" />
</template>

<style scoped>
.main-layout {
  display: flex;
  height: calc(100vh - 50px); /* Adjust based on TopBar height */
  margin-top: 50px; /* Ensure content is below TopBar */
}

.sidebar {
  /* width is controlled by sidebarWidth ref */
  height: 100%;
  background-color: #252526; /* Dark background like VS Code */
  color: #cccccc; /* Light text color for dark background */
  border-right: 1px solid #333333; /* Darker border */
  position: relative; 
  display: flex; 
  flex-direction: column; 
  overflow: hidden; /* Prevent sidebar itself from scrolling */
}

.sidebar-connections-section {
  flex-shrink: 0; 
  overflow: hidden; 
}

.sidebar-file-explorer-section {
  flex-grow: 1; 
  overflow: hidden; 
  border-top: 1px solid #333333; 
}

.resize-handle {
  width: 5px;
  height: 100%;
  background-color: #333333; 
  cursor: col-resize;
  flex-shrink: 0; 
}

.main-content {
  flex-grow: 1;
  height: 100%;
  overflow: hidden; 
  display: flex; 
  flex-direction: column; 
  background-color: #1e1e1e; 
}

.terminal-tabs-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1e1e1e; /* Match main content background */
}

.terminal-tabs-list {
  list-style: none;
  padding: 0 5px; /* Padding for the list itself */
  margin: 0;
  display: flex;
  flex-shrink: 0;
  background-color: #2d2d2d; /* Slightly different for tab bar background */
  border-bottom: 1px solid #181818; /* Separator for tabs */
  overflow-x: auto; /* Allow horizontal scrolling for many tabs */
  scrollbar-width: thin;
  scrollbar-color: #555 #2d2d2d;
}
.terminal-tabs-list::-webkit-scrollbar {
  height: 4px;
}
.terminal-tabs-list::-webkit-scrollbar-thumb {
  background: #555;
}


.terminal-tab-item {
  display: flex;
  align-items: center;
  padding: 8px 12px; /* Comfortable padding */
  cursor: pointer;
  color: #8e8e8e; /* Default tab text color (inactive) */
  border-right: 1px solid #1e1e1e; /* Separator between tabs */
  background-color: #2d2d2d; /* Inactive tab background */
  white-space: nowrap;
  font-size: 0.85em;
  transition: background-color 0.1s, color 0.1s;
}

.terminal-tab-item:hover {
  background-color: #37373d; /* Hover background */
  color: #cccccc; /* Hover text color */
}

.terminal-tab-item.active {
  background-color: #1e1e1e; /* Active tab matches terminal background */
  color: #ffffff; /* Active tab text color */
  border-bottom: 1px solid #1e1e1e; /* Effectively removes bottom border by matching */
}

.tab-name {
  margin-right: 8px;
  max-width: 150px; /* Prevent very long names from breaking layout */
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.tab-name-input {
  width: 100%;
  padding: 4px;
  font-size: 0.85em;
  border: 1px solid #555;
  border-radius: 3px;
  background-color: #2d2d2d;
  color: #ffffff;
  outline: none;
}

.tab-name-input:focus {
  border-color: #007acc;
}

.close-tab-button {
  background: none;
  border: none;
  color: #8e8e8e;
  cursor: pointer;
  padding: 0 4px;
  font-size: 1.2em; /* Make X slightly larger */
  line-height: 1;
  border-radius: 3px;
}

.terminal-tab-item:hover .close-tab-button,
.terminal-tab-item.active .close-tab-button {
  color: #cccccc; /* Button color on hover/active tab */
}
.close-tab-button:hover {
  background-color: #555555;
  color: #ffffff;
}

.terminal-instance-area {
  flex-grow: 1;
  overflow: hidden; /* Important: TerminalView will manage its own scroll */
  position: relative; /* For potential absolute positioning inside if needed */
}

.terminal-wrapper {
  width: 100%;
  height: 100%;
  background-color: #1e1e1e; /* Ensure wrapper has background */
}


.placeholder-text {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #777;
  font-size: 1.2em;
  background-color: #1e1e1e; 
}
</style>
