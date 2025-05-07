<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import TerminalView from './TerminalView.vue';
import FileExplorer from './FileExplorer.vue';
import Window from './Window.vue';

const props = defineProps<{
  tabs: Array<{
    id: string;
    title: string;
    type: 'terminal' | 'file-manager';
    sshSessionId: string;
  }>;
  activeTabId: string | null;
  isWindowedMode: boolean;
}>();

const emit = defineEmits(['remove-tab', 'update-tab-title', 'set-active-tab']);

// Use a local ref that stays in sync with props
const activeTabId = ref<string | null>(props.activeTabId);

// Keep track of z-index for each window
const zIndexMap = ref<Record<string, number>>({}); 
let zIndexCounter = 1000; // Start z-index counter

// Watch for changes in props.activeTabId
watch(() => props.activeTabId, (newVal) => {
  activeTabId.value = newVal;
});

// Watch for changes in tabs to ensure we always have an active tab if tabs exist
watch(() => props.tabs, (newTabs) => {
  // If we have tabs but no active tab, set the first one active
  if (newTabs.length > 0 && !activeTabId.value) {
    setActiveTab(newTabs[0].id);
  }
  // If active tab is not in tabs list, set first tab as active
  else if (activeTabId.value && !newTabs.some(tab => tab.id === activeTabId.value)) {
    setActiveTab(newTabs.length > 0 ? newTabs[0].id : null);
  }
}, { deep: true });

const setActiveTab = async (id: string | null) => {
  if (id === null) {
    activeTabId.value = null;
    emit('set-active-tab', null);
    return;
  }
  
  activeTabId.value = id;
  emit('set-active-tab', id);
  
  if (props.isWindowedMode) {
    // Bring the window to front
    zIndexMap.value[id] = ++zIndexCounter;
  }
  
  await nextTick();
  const terminal = document.querySelector(`[data-terminal-id="${id}"]`) as any;
  if (terminal?.focusTerminal) {
    terminal.focusTerminal();
  }
};

const closeTab = (id: string) => {
  console.log('Closing tab:', id); // Add logging
  emit('remove-tab', id);
};

const startEditingTitle = ref<string | null>(null);
const newTitle = ref('');

const beginEditingTitle = (id: string, currentTitle: string) => {
  startEditingTitle.value = id;
  newTitle.value = currentTitle;
};

const saveTitle = (id: string) => {
  emit('update-tab-title', id, newTitle.value.trim() || 'Untitled');
  startEditingTitle.value = null;
};

const updateTabTitle = (tabId: string, title: string) => {
  console.log('Updating tab title:', tabId, title); // Add logging
  emit('update-tab-title', tabId, title);
};

onMounted(() => {
  // Initialize zIndexMap for all tabs
  props.tabs.forEach((tab, index) => {
    zIndexMap.value[tab.id] = 1000 + index;
  });
  
  // If we have tabs but no active tab, set the first one active
  if (props.tabs.length > 0 && !activeTabId.value) {
    setActiveTab(props.tabs[0].id);
  }
});
</script>

<template>
  <div class="window-manager">
    <!-- Tabbed mode -->
    <div v-if="!props.isWindowedMode" class="tabs">
      <div 
        v-for="tab in props.tabs" 
        :key="tab.id" 
        :class="{ active: tab.id === activeTabId }" 
        class="tab"
        @click="setActiveTab(tab.id)"
      >
        <template v-if="startEditingTitle === tab.id">
          <input 
            type="text" 
            v-model="newTitle" 
            @blur="saveTitle(tab.id)" 
            @keyup.enter="saveTitle(tab.id)" 
            @keyup.esc="startEditingTitle = null" 
            class="tab-title-input"
          />
        </template>
        <template v-else>
          <span @dblclick="beginEditingTitle(tab.id, tab.title)">{{ tab.title }}</span>
        </template>
        <button class="close-tab-button" @click.stop="closeTab(tab.id)">×</button>
      </div>
    </div>
    
    <div v-if="!props.isWindowedMode" class="tab-content">
      <div 
        v-for="tab in props.tabs" 
        :key="tab.id" 
        v-show="tab.id === activeTabId" 
        class="tab-pane"
      >
        <TerminalView v-if="tab.type === 'terminal'" :sshSessionId="tab.sshSessionId" :data-terminal-id="tab.id" />
        <FileExplorer v-else-if="tab.type === 'file-manager'" :sshSessionId="tab.sshSessionId" />
      </div>
    </div>
    
    <!-- Windowed mode -->
    <div v-else class="windows-container">
      <Window
        v-for="tab in props.tabs"
        :key="tab.id"
        :id="tab.id"
        :title="tab.title"
        :type="tab.type"
        :sshSessionId="tab.sshSessionId"
        :z-index="zIndexMap[tab.id] || 1000"
        :is-active="tab.id === activeTabId"
        @click="setActiveTab(tab.id)"
        @update-title="title => updateTabTitle(tab.id, title)"
        @close="closeTab(tab.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.window-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative; /* Ensure proper positioning context for absolute windows */
}

.windows-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.tabs {
  display: flex;
  background-color: #333333;
  border-bottom: 1px solid #1e1e1e;
  height: 30px;
}

.tab {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  cursor: pointer;
  color: #cccccc;
  background-color: #2d2d2d;
  border-right: 1px solid #1e1e1e;
  transition: background-color 0.2s;
}

.tab.active {
  background-color: #1e1e1e;
  color: #ffffff;
}

.tab:hover {
  background-color: #37373d;
}

.tab-title-input {
  width: 100%;
  padding: 3px;
  font-size: 0.9em;
  border: 1px solid #555555;
  border-radius: 3px;
  background-color: #2d2d2d;
  color: #ffffff;
}

.close-tab-button {
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  font-size: 1.2em;
  margin-left: 5px;
  padding: 2px 6px;
  border-radius: 3px;
  z-index: 10;
}

.close-tab-button:hover {
  background-color: #c42b1c;
  color: white;
}

.tab-content {
  flex-grow: 1;
  background-color: #1e1e1e;
  overflow: hidden;
}

.tab-pane {
  height: 100%;
}
</style>
