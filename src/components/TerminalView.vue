<template>
    <div ref="terminalContainer" :style="{ width: props.width, height: props.height, }"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, defineProps, withDefaults, defineExpose } from 'vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { io, Socket } from 'socket.io-client';

interface Props {
    width?: string;
    height?: string;
    sshSessionId: string; // Made non-optional as it's crucial
    initialPath?: string; // New prop for initial path
}

const props = withDefaults(defineProps<Props>(), {
    width: '100%',
    height: 'calc(100vh - 80px)', // This height might need adjustment if App.vue adds a tab bar
    initialPath: '',
});

const terminalContainer = ref<HTMLElement | null>(null);
let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let socket: Socket | null = null;
let resizeObserver: ResizeObserver | null = null;
let initialCommandSent = false; // Flag to ensure initial command is sent only once
const terminalId = ref(Date.now().toString());
let sshReadyTimeout: ReturnType<typeof setTimeout> | null = null; // Ajout du timeout pour ssh-ready

function escapeShellArg(arg: string): string {
    if (arg === '') {
        return "''"; // Handle empty string case
    }
    // Replace single quotes with '\'' (close quote, escaped quote, open quote)
    // and then wrap the whole thing in single quotes.
    // This is a common way to make a string literal for many shells.
    return "'" + arg.replace(/'/g, "'\\''") + "'";
}

function sendToServer(data: string) {
    if (socket && socket.connected) {
        socket.emit('ssh-data', data);
    } else {
        console.warn('Socket not connected, cannot send data:', data);
    }
}

// Expose method to execute commands
defineExpose({
    executeCommand: (command: string) => {
        if (term && socket && socket.connected) {
            const commandToSend = command.endsWith('\n') ? command : `${command}\n`;
            sendToServer(commandToSend);
        } else {
            console.warn('Terminal or socket not ready to execute command:', command);
        }
    },
    focusTerminal: () => {
        term?.focus();
    }
});

onMounted(async () => {
    console.log(`TerminalView instance mounted with sshSessionId: ${props.sshSessionId}, initialPath: "${props.initialPath}"`);
    initialCommandSent = false; // Ensure flag is reset for this instance

    if (terminalContainer.value) {
        await nextTick(); // Ensure the container is rendered and has dimensions

        term = new Terminal({
            cursorBlink: true,
            fontFamily: 'monospace',
            fontSize: 14,
            theme: {
                background: '#252526', // Match sidebar background
                foreground: '#d4d4d4',
                cursor: '#d4d4d4',
                selectionBackground: '#094771', // Match sidebar selection
                selectionForeground: '#ffffff',
            }
        });
        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalContainer.value);
        try {
            // Ensure the container has non-zero dimensions before fitting
            if (terminalContainer.value.clientWidth > 0 && terminalContainer.value.clientHeight > 0) {
                fitAddon.fit();
            } else {
                console.warn("Initial fit skipped: container has zero dimensions.");
                // Optionally, retry fit after a short delay or on next tick if dimensions might update
                setTimeout(() => {
                    if (terminalContainer.value && terminalContainer.value.clientWidth > 0 && terminalContainer.value.clientHeight > 0 && fitAddon) {
                        fitAddon.fit();
                    }
                }, 100);
            }
        } catch (e) {
            console.warn("Initial fit failed, possibly due to container not being fully ready:", e);
        }

        // Setup ResizeObserver to handle container resize
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                // Debounce or throttle this if it fires too rapidly during resize dragging
                // For now, direct call
                handleResize();
            });
            resizeObserver.observe(terminalContainer.value);
        } else {
            // Fallback for browsers that don't support ResizeObserver
            window.addEventListener('resize', handleResize);
        }

        let currentSshSessionId = props.sshSessionId; // Directly use the prop

        if (!currentSshSessionId) {
            term?.writeln("\r\n\x1b[31mSSH Session ID not provided. Connection aborted.\x1b[0m");
            console.error('SSH Session ID not provided. Connection aborted.');
            return;
        }

        // Socket.IO connection
        socket = io('http://localhost:3000/ssh', {
            query: { 
                id: currentSshSessionId,
                terminalId: terminalId.value 
            },
            withCredentials: true,
        });

        socket.on('connect', () => {
            console.log('Socket connected to /ssh, ID:', socket?.id);
            if (term && socket) {
                console.log(`Emitting ssh-init with cols: ${term.cols}, rows: ${term.rows}`);
                socket.emit('ssh-init', { cols: term.cols, rows: term.rows });
                // Démarre le timeout pour ssh-ready
                if (sshReadyTimeout) clearTimeout(sshReadyTimeout);
                sshReadyTimeout = setTimeout(() => {
                    if (socket && socket.connected && term) {
                        console.log('Pas de ssh-ready après 2s, on relance ssh-init');
                        socket.emit('ssh-init', { cols: term.cols, rows: term.rows });
                    }else{
                        console.log("ssh-ready timeout");
                    }
                }, 2000);
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected from /ssh:', reason);
            term?.writeln(`\r\n\x1b[33mSocket disconnected: ${reason}\x1b[0m`);
        });

        socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
            term?.writeln(`\r\n\x1b[31mSocket Connection Error: ${err.message}\x1b[0m`);
        });

        socket.on('ssh-data', (data: string) => {
            term?.write(data);
        });

        socket.on('ssh-error', (errorMessage: string) => {
            console.error('SSH Error from server:', errorMessage);
            term?.writeln(`\r\n\x1b[31mSSH Error: ${errorMessage}\x1b[0m`);
        });

        socket.on('ssh-ready', (message: string) => {
            // Annule le timeout si ssh-ready est reçu
            if (sshReadyTimeout) {
                clearTimeout(sshReadyTimeout);
                sshReadyTimeout = null;
            }
            console.log(`SSH Ready. Envoyeur de commande initiale...`);
            term?.writeln(`\r\n\x1b[32m${message}\x1b[0m`);
            
            // Ajouter une vérification de l'état du socket
            if (socket?.connected) {
                // Ajouter un délai supplémentaire pour s'assurer que le shell est prêt
                setTimeout(() => {
                    if (props.initialPath && !initialCommandSent) {
                        const safePath = escapeShellArg(props.initialPath);
                        sendToServer(`cd ${safePath} && clear\n`);
                        initialCommandSent = true;
                    }
                }, 500);
            }
        });

        term.onData((data: string) => {
            if (socket && socket.connected) {
                socket.emit('ssh-data', data);
            } else {
                console.warn('Socket not connected, cannot send data.');
            }
        });

        term.onResize(({ cols, rows }) => {
            if (socket && socket.connected) {
                console.log(`Terminal resized to cols: ${cols}, rows: ${rows}. Emitting ssh-resize.`);
                socket.emit('ssh-resize', { cols, rows });
            }
        });

        // Handle window resize - can be kept as a fallback or for specific window-level adjustments
        setTimeout(() => handleResize(), 200); // Increased delay slightly

        terminalContainer.value.addEventListener('dragover', (event) => {
            event.preventDefault();
        });

        terminalContainer.value.addEventListener('drop', (event) => {
            event.preventDefault();
            const filePath = event.dataTransfer?.getData('text/plain');
            if (filePath) {
                const safePath = filePath.includes(' ') ? `"${filePath}"` : filePath;
                sendToServer(`${safePath}`);
            }
        });
    }
});

onUnmounted(() => {
    if (resizeObserver && terminalContainer.value) {
        resizeObserver.unobserve(terminalContainer.value);
        resizeObserver.disconnect();
    } else {
        // Fallback: remove the window resize listener if ResizeObserver wasn't used
        window.removeEventListener('resize', handleResize);
    }
    if (socket) {
        console.log('Disconnecting socket on component unmount.');
        socket.disconnect();
    }
    if (term) {
        console.log('Disposing terminal on component unmount.');
        term.dispose();
    }
    term = null;
    fitAddon = null;
    socket = null;
    resizeObserver = null; // Clear the observer instance
    if (sshReadyTimeout) {
        clearTimeout(sshReadyTimeout);
        sshReadyTimeout = null;
    }
});

const handleResize = () => {
    if (fitAddon && term && terminalContainer.value && terminalContainer.value.clientWidth > 0 && terminalContainer.value.clientHeight > 0) {
        try {
            fitAddon.fit();
        } catch (e) {
            console.warn("Fit addon resize failed:", e);
        }
    }
};
</script>

<style scoped>
/* Styles are now primarily controlled by props and inline style in the template */
/* Custom scrollbar styling for xterm.js viewport */
:deep(.xterm-viewport::-webkit-scrollbar),
:deep(.xterm .xterm-viewport::-webkit-scrollbar) { /* More specific if needed */
  width: 8px; /* Slimmer scrollbar */
  height: 8px;
}

:deep(.xterm-viewport::-webkit-scrollbar-track),
:deep(.xterm .xterm-viewport::-webkit-scrollbar-track) {
  background: #252526; /* Match terminal background for seamless look */
}

:deep(.xterm-viewport::-webkit-scrollbar-thumb),
:deep(.xterm .xterm-viewport::-webkit-scrollbar-thumb) {
  background: #555555;
  border-radius: 4px;
}

:deep(.xterm-viewport::-webkit-scrollbar-thumb:hover),
:deep(.xterm .xterm-viewport::-webkit-scrollbar-thumb:hover) {
  background: #6a6a6a;
}

/* For Firefox - limited styling */
:deep(.xterm-viewport) {
  scrollbar-width: thin; /* "auto" or "thin" */
  scrollbar-color: #555555 #252526; /* thumb and track color */
}
</style>
