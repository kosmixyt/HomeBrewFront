<script setup lang="ts">
import { ref, watch } from 'vue';
import HomeView from './HomeView.vue';
import WindowManager from '../ssh/components/WindowManager.vue';
import AddConnectionModal from '../ssh/components/AddConnectionModal.vue'; // Import the modal component

const props = defineProps({
  isWindowedMode: {
    type: Boolean,
    default: false // Default to tabbed mode
  },
  showAddConnectionModal: {
    type: Boolean,
    default: false // Default to false
  }
});

const activeTabId = ref<string | null>(null); // Track the active tab/window
const sidebarWidth = ref(300);
const isResizing = ref(false);
console.log(props.showAddConnectionModal)
const showAddConnectionModal = ref(props.showAddConnectionModal); // Track modal visibility

watch(() => props.showAddConnectionModal, (newValue) => {
  showAddConnectionModal.value = newValue;
});

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

const tabs = ref([] as any[]); // Track all tabs/windows

const addTab = (type: 'terminal' | 'file-manager', sshSessionId: string) => {
  const newTab = {
    id: crypto.randomUUID(),
    title: type === 'terminal' ? 'New Terminal' : 'New File Manager',
    type,
    sshSessionId,
  };
  tabs.value.push(newTab);
  activeTabId.value = newTab.id; // Set the new tab as active
};

const removeTab = (id: string) => {
  console.log('Removing tab with ID:', id); // Add logging
  tabs.value = tabs.value.filter(tab => tab.id !== id);
  if (activeTabId.value === id) {
    activeTabId.value = tabs.value.length > 0 ? tabs.value[0].id : null;
  }
};

const updateTabTitle = (id: string, newTitle: string) => {
  const tab = tabs.value.find(t => t.id === id);
  if (tab) {
    tab.title = newTitle;
  }
};

const setActiveTab = (id: string) => {
  activeTabId.value = id;
};

const closeAllTerminalsForHost = (sshSessionId: string) => {
  console.log('Closing all terminals for host:', sshSessionId);
  const terminalsToRemove = tabs.value.filter(
    tab => tab.type === 'terminal' && tab.sshSessionId === sshSessionId
  );

  console.log(`Found ${terminalsToRemove.length} terminals to close`);
  terminalsToRemove.forEach(tab => {
    removeTab(tab.id);
  });
};

const closeAllFileManagers = () => {
  console.log('Closing all file managers');
  const fileManagersToRemove = tabs.value.filter(tab => tab.type === 'file-manager');

  console.log(`Found ${fileManagersToRemove.length} file managers to close`);
  fileManagersToRemove.forEach(tab => {
    removeTab(tab.id);
  });
};
</script>

<template>
  <div class="ssh-page">
    <div class="sidebar" :style="{ width: sidebarWidth + 'px' }">
      <HomeView 
        @host-selected="sshSessionId => addTab('terminal', sshSessionId)" 
        @open-file-manager="sshSessionId => addTab('file-manager', sshSessionId)"
        @close-all-terminals="closeAllTerminalsForHost"
        @close-all-file-managers="closeAllFileManagers"
      />
    </div>
    <div class="resize-handle" @mousedown="startResize"></div>
    <div class="main-container">
      <WindowManager 
        :tabs="tabs" 
        :active-tab-id="activeTabId"
        :is-windowed-mode="props.isWindowedMode"
        @remove-tab="removeTab" 
        @update-tab-title="updateTabTitle"
        @set-active-tab="setActiveTab" 
      />
    </div>
    <AddConnectionModal 
      v-if="showAddConnectionModal" 
      @close="showAddConnectionModal = false; $emit('update:showAddConnectionModal', false)" 
    />
  </div>
</template>

<style scoped>
.ssh-page {
  display: flex;
  height: calc(100vh - 50px); /* Adjust height to account for TopBar */
}

.sidebar {
  height: 100%;
  background-color: #252526;
  color: #cccccc;
  border-right: 1px solid #333333;
  overflow: hidden;
}

.resize-handle {
  width: 5px;
  height: 100%;
  background-color: #333333;
  cursor: col-resize;
}

.main-container {
  flex-grow: 1;
  background-color: #1e1e1e;
  overflow: hidden;
  position: relative;
}
</style>
