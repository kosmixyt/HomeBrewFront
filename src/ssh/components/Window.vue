<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import TerminalView from './TerminalView.vue';
import FileExplorer from './FileExplorer.vue';

// Add this global counter for z-index management
let zIndexCounter = 1000;

const props = defineProps<{
  id: string;
  title: string;
  type: 'terminal' | 'file-manager';
  sshSessionId: string;
  zIndex?: number;
  isActive: boolean;
}>();

const emit = defineEmits(['close', 'update-title', 'click']);

const isEditingTitle = ref(false);
const newTitle = ref(props.title);

const startEditingTitle = () => {
  isEditingTitle.value = true;
  newTitle.value = props.title;
};

const saveTitle = () => {
  emit('update-title', newTitle.value.trim() || props.title);
  isEditingTitle.value = false;
};

const position = ref({ x: 100, y: 100 });
const size = ref({ width: 400, height: 300 });

const zIndex = ref(props.zIndex || 1000);

const bringToFront = () => {
  zIndex.value = ++zIndexCounter;
};

const startDrag = (event: MouseEvent) => {
  const startX = event.clientX - position.value.x;
  const startY = event.clientY - position.value.y;

  const onMouseMove = (moveEvent: MouseEvent) => {
    position.value.x = moveEvent.clientX - startX;
    position.value.y = moveEvent.clientY - startY;
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

const startResize = (event: MouseEvent) => {
  const startWidth = size.value.width;
  const startHeight = size.value.height;
  const startX = event.clientX;
  const startY = event.clientY;

  const onMouseMove = (moveEvent: MouseEvent) => {
    size.value.width = startWidth + (moveEvent.clientX - startX);
    size.value.height = startHeight + (moveEvent.clientY - startY);
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

const focusAndResizeTerminal = async () => {
  await nextTick(); // Wait for DOM updates
  const terminal = document.querySelector(`[data-terminal-id="${props.id}"]`) as any;
  terminal?.focusTerminal?.(); // Ensure the terminal is focused and resized
};

const handleClick = () => {
  emit('click');
  bringToFront(); // Always bring to front when clicked
};

onMounted(() => {
  focusAndResizeTerminal(); // Resize and focus the terminal when the window is mounted
});

watch(
  () => props.isActive,
  (isActive) => {
    if (isActive) {
      focusAndResizeTerminal(); // Resize and focus the terminal when the window becomes active
    }
  }
);
</script>

<template>
  <div
    class="window"
    :class="{ 'active': isActive }"
    :style="{ left: position.x + 'px', top: position.y + 'px', width: size.width + 'px', height: size.height + 'px', zIndex: zIndex }"
    @mousedown="handleClick"
  >
    <div class="window-header" @mousedown.stop="startDrag">
      <template v-if="isEditingTitle">
        <input
          type="text"
          v-model="newTitle"
          @blur="saveTitle"
          @keyup.enter="saveTitle"
          @keyup.esc="isEditingTitle = false"
          class="title-input"
        />
      </template>
      <template v-else>
        <span class="window-title" @dblclick="startEditingTitle">{{ props.title }}</span>
      </template>
      <button class="close-button" @click.stop="$emit('close')">×</button>
    </div>
    <div class="window-content">
      <TerminalView v-if="props.type === 'terminal'" :sshSessionId="props.sshSessionId" :data-terminal-id="props.id" />
      <FileExplorer v-else-if="props.type === 'file-manager'" :sshSessionId="props.sshSessionId" />
    </div>
    <div class="resize-handle" @mousedown="startResize"></div>
  </div>
</template>

<style scoped>
.window {
  position: absolute;
  background-color: #252526;
  border: 1px solid #333333;
  border-radius: 5px;
  overflow: hidden;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column; /* Ensure content flows vertically */
}

.window.active {
  border-color: #0e639c; /* Highlight active window */
  box-shadow: 0 0 10px rgba(14, 99, 156, 0.5);
}

.window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #333333;
  padding: 5px 10px;
  cursor: move;
}

.window-title {
  color: #cccccc;
  font-size: 0.9em;
  user-select: none;
}

.title-input {
  width: 100%;
  padding: 3px;
  font-size: 0.9em;
  border: 1px solid #555555;
  border-radius: 3px;
  background-color: #2d2d2d;
  color: #ffffff;
}

.close-button {
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  font-size: 1.2em;
  padding: 5px 8px;
  margin: 0 0 0 5px;
  border-radius: 3px;
  z-index: 10; /* Ensure button stays above other elements */
}

.close-button:hover {
  background-color: #c42b1c;
  color: white;
}

.window-content {
  flex-grow: 1;
  background-color: #1e1e1e;
  overflow: hidden;
  height: calc(100% - 30px); /* Adjust for header height */
  position: relative; /* Ensure proper positioning context */
}

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  background-color: #555555;
  cursor: se-resize;
}
</style>
