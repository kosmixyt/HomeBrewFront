<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { useSshSocket } from '@/composables/useSshSocket' // Import the composable

// Use the composable
const {
  sshSocket, // This is a readonly ref to the socket instance
  isSshSocketConnected, // WebSocket connection status
  isSshSessionReady, // SSH PTY session readiness status
  connectSsh,
  disconnectSsh,
  setSshSessionReady
} = useSshSocket()




// move to good location

const terminalContainer = ref<HTMLElement | null>(null)
const xterm = ref<Terminal | null>(null)
const fitAddon = ref<FitAddon | null>(null)

// Define event handlers in the setup scope so they can be added/removed
const handleSshReady = (message: string) => {
  console.log('HomeView: SSH Ready:', message)
  xterm.value?.writeln(`\r\n${message}`)
  setSshSessionReady(true) // Update session readiness via composable
}

const handleSshData = (data: string) => {
  xterm.value?.write(data)
}

const handleSshError = (errorMessage: string) => {
  console.error('HomeView: SSH Error:', errorMessage)
  xterm.value?.writeln(`\r\nSSH Error: ${errorMessage}`)
  setSshSessionReady(false) // Update session readiness via composable
}

const handleSshViewDisconnect = () => {
  // This handler is for the 'disconnect' event on the socket instance,
  // primarily for UI updates within this component.
  // The composable handles the core isSshSocketConnected state.
  console.log('HomeView: Received disconnect event on socket instance.')
  if (xterm.value && !isSshSocketConnected.value) { // Check composable's state
    xterm.value?.writeln('\r\nSSH WebSocket Disconnected.')
  }
  setSshSessionReady(false) // Ensure session is marked not ready
}

onMounted(async () => {
  await nextTick()


  if (terminalContainer.value) {
    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
    })
    const addon = new FitAddon()
    fitAddon.value = addon
    term.loadAddon(addon)
    xterm.value = term

    term.open(terminalContainer.value)
    addon.fit()
    term.onData((data) => {
      // Use sshSocket.value from the composable
      if (sshSocket.value && sshSocket.value.connected) {
        sshSocket.value.emit('ssh-data', data)
      }
    })

    // Connect using the composable's function
    connectSsh()

    // Watch for the WebSocket connection status from the composable
    watch(isSshSocketConnected, (connected) => {
      if (connected && xterm.value && fitAddon.value && sshSocket.value) {
        xterm.value?.writeln('SSH WebSocket Connected. Initializing PTY...')
        fitAddon.value.fit()
        // Emit ssh-init with current terminal dimensions
        sshSocket.value.emit('ssh-init', { cols: xterm.value.cols, rows: xterm.value.rows })
      } else if (!connected && xterm.value) {
        // This message is now primarily handled by handleSshViewDisconnect or composable's disconnect log
        // xterm.value?.writeln('\r\nSSH WebSocket Disconnected.')
      }
    }, { immediate: true }) // immediate: true to run on mount if already connected

    // Watch the sshSocket ref from the composable to attach/detach event listeners
    watch(sshSocket, (currentSocket, oldSocket) => {
      if (oldSocket) {
        oldSocket.off('ssh-ready', handleSshReady)
        oldSocket.off('ssh-data', handleSshData)
        oldSocket.off('ssh-error', handleSshError)
        oldSocket.off('disconnect', handleSshViewDisconnect)
      }
      if (currentSocket) {
        currentSocket.on('ssh-ready', handleSshReady)
        currentSocket.on('ssh-data', handleSshData)
        currentSocket.on('ssh-error', handleSshError)
        currentSocket.on('disconnect', handleSshViewDisconnect) // Listen for disconnect on the instance
      }
    }, { immediate: true }) // immediate: true to attach listeners if socket is already available
  }

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // Clean up listeners from the composable's socket instance
  if (sshSocket.value) {
    sshSocket.value.off('ssh-ready', handleSshReady)
    sshSocket.value.off('ssh-data', handleSshData)
    sshSocket.value.off('ssh-error', handleSshError)
    sshSocket.value.off('disconnect', handleSshViewDisconnect)
  }
  disconnectSsh()
  if (xterm.value) {
    xterm.value.dispose()
  }
  window.removeEventListener('resize', handleResize)
})

const handleResize = () => {
  if (fitAddon.value && xterm.value) {
    fitAddon.value.fit()
    // Use sshSocket.value from the composable
    if (sshSocket.value && sshSocket.value.connected && xterm.value) {
      sshSocket.value.emit('ssh-resize', { cols: xterm.value.cols, rows: xterm.value.rows })
    }
  }
}
</script>

<template>
  <div class="ssh-terminal-view">
    <h1>SSH Terminal</h1>
    <div ref="terminalContainer" id="terminal-container"></div>
    <!-- Use isSshSessionReady from the composable for the status message -->
    <p v-if="!isSshSessionReady && !isSshSocketConnected" class="status-disconnected">
      Connecting to SSH server... If it takes too long, check server logs and connection.
    </p>
    <p v-if="!isSshSessionReady && isSshSocketConnected" class="status-disconnected">
      SSH WebSocket connected, waiting for PTY session to be ready...
    </p>
  </div>
</template>

<style scoped>
.ssh-terminal-view {
  display: flex;
  flex-direction: column;
  height: 90vh;
  /* Adjust as needed */
  padding: 10px;
}

#terminal-container {
  flex-grow: 1;
  background-color: #1e1e1e;
  /* Dark background for terminal */
  padding: 5px;
  overflow: hidden;
  /* FitAddon handles scrolling within xterm */
}

.status-disconnected {
  color: red;
  margin-top: 10px;
}

/* Ensure xterm takes up the full space of its container */
:deep(.xterm) {
  height: 100% !important;
}

:deep(.xterm-viewport) {
  height: 100% !important;
  overflow-y: scroll !important;
  /* Ensure viewport itself can scroll if content exceeds */
}
</style>
