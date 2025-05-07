import { ref, readonly } from 'vue'
import { io, Socket } from 'socket.io-client'

// Attempt to get API URL from environment variables, fallback to localhost
const VITE_API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000/ssh'

// Module-scoped state for the socket (singleton pattern)
const sshSocketRef = ref<Socket | null>(null)
const isSshSocketConnectedRef = ref(false) // Tracks WebSocket connection status
const isSshSessionReadyRef = ref(false) // Tracks if the SSH PTY session is ready

export function useSshSocket() {
  const connectSsh = () => {
    if (sshSocketRef.value && sshSocketRef.value.connected) {
      // console.log('useSshSocket: SSH Socket already connected.')
      // Ensure connection status refs are accurate if re-connecting logic is complex
      isSshSocketConnectedRef.value = true
      return
    }

    // Disconnect existing socket if any before creating a new one
    if (sshSocketRef.value) {
      sshSocketRef.value.disconnect()
    }

    const socketInstance = io(`${VITE_API_URL}`, {
      withCredentials: true,
      reconnectionAttempts: 3, // Optional: configure reconnection
      timeout: 10000, // Optional: connection timeout
    })

    socketInstance.on('connect', () => {
      console.log('useSshSocket: Connected to SSH Socket.IO namespace!', socketInstance.id)
      isSshSocketConnectedRef.value = true
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('useSshSocket: Disconnected from SSH Socket.IO namespace!', reason)
      isSshSocketConnectedRef.value = false
      isSshSessionReadyRef.value = false // If WebSocket disconnects, SSH session is no longer ready
    })

    socketInstance.on('connect_error', (err) => {
      console.error('useSshSocket: SSH Socket connection error:', err.message)
      isSshSocketConnectedRef.value = false
      isSshSessionReadyRef.value = false
    })

    sshSocketRef.value = socketInstance
  }

  const disconnectSsh = () => {
    if (sshSocketRef.value) {
      sshSocketRef.value.disconnect()
      // sshSocketRef.value = null; // Socket instance will be cleaned up by socket.io client on disconnect
      console.log('useSshSocket: SSH Socket disconnected via composable.')
    }
    // Explicitly set states to false on manual disconnect
    isSshSocketConnectedRef.value = false
    isSshSessionReadyRef.value = false
  }

  const setSshSessionReady = (isReady: boolean) => {
    isSshSessionReadyRef.value = isReady
  }

  return {
    sshSocket: readonly(sshSocketRef),
    isSshSocketConnected: readonly(isSshSocketConnectedRef),
    isSshSessionReady: readonly(isSshSessionReadyRef),
    connectSsh,
    disconnectSsh,
    setSshSessionReady,
  }
}
