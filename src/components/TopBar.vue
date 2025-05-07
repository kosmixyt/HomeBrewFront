<template>
    <div class="top-bar">
        <div v-if="loading">
            <span>Loading user status...</span>
        </div>
        <div v-else-if="user">
            <span>Welcome, {{ user.name || user.email }}!</span>
            <!-- You can add a logout button here, e.g., <a href="/auth/signout">Logout</a> -->
        </div>
        <div v-else>
            <span>You are not logged in.</span>
            <!-- You can add a login link here, e.g., <a href="/auth/signin">Login</a> -->
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface UserProfile {
    id: string;
    email: string;
    name?: string | null;
    // Add other fields if your /users/profile endpoint returns more
}

const user = ref<UserProfile | null>(null);
const loading = ref(true);

onMounted(async () => {
    try {
        const response = await fetch('http://localhost:3000/users/profile', {
            credentials: 'include', // Important for sending session cookies
        });
        if (response.ok) {
            user.value = await response.json();
        } else {
            // User is not authenticated or an error occurred
            user.value = null;
            if (response.status !== 401 && response.status !== 404) {
                // Log unexpected errors
                console.warn('Failed to fetch user profile:', response.status, await response.text());
            }
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
        user.value = null;
    } finally {
        loading.value = false;
    }
});
</script>

<style scoped>
.top-bar {
    background-color: #2c3e50;
    color: white;
    padding: 12px 25px;
    text-align: right;
    width: 100%;
    box-sizing: border-box;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
    height: 50px;
    /* Fixed height for the top bar */
}

.top-bar a {
    color: #42b983;
    text-decoration: none;
    margin-left: 15px;
}

.top-bar a:hover {
    text-decoration: underline;
}
</style>
