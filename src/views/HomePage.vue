<template>
  <div class="home-page">
    <h1>Welcome to HomeBrew</h1>
    <p>Manage your SSH connections, terminals, and file explorers all in one place.</p>
    
    <div class="nav-buttons">
      <router-link to="/ssh" class="get-started-button">SSH/SFTP panel</router-link>
      <router-link to="/whois" class="get-started-button">WHOIS Lookup</router-link>
      <router-link to="/docker" class="get-started-button">Docker Management</router-link>
    </div>

    <!-- Google Search Bar -->
    <div class="search-container">
      <form @submit.prevent="searchGoogle">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search the web..."
          class="search-input"
        />
        <button type="submit" class="search-button">
          <span>🔍</span>
        </button>
      </form>
    </div>

    <div class="links-container">
      <div class="section-header">
        <h2>Your Self-Hosted Links</h2>
        <button class="category-button" @click="showCategoryModal = true">+ New Category</button>
      </div>

      <!-- Display categorized links -->
      <div v-if="data.categories && data.categories.length > 0" class="categories-section">
        <div 
          v-for="category in data.categories" 
          :key="category.id" 
          class="category"
          @dragover.prevent
          @drop="handleDrop($event, category.id)"
        >
          <h3 class="category-title">
            <span class="category-icon">📁</span>
            {{ category.name }}
          </h3>
          <div class="links-grid">
            <div 
              v-for="item in category.Items" 
              :key="item.id" 
              class="link-card"
              draggable="true"
              @dragstart="handleDragStart($event, item)"
              @click="openLink(item.url)"
            >
              <div class="link-icon">
                <img :src="app_url + '/' + item.iconPath" alt="icon" onerror="this.src='/default-icon.png'" />
              </div>
              <div class="link-details">
                <h4>{{ item.name }}</h4>
                <small class="link-url">{{ formatUrl(item.url) }}</small>
              </div>
              <div class="drag-handle">
                <span>⋮⋮</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Display uncategorized links -->
      <div 
        v-if="data.uncategorizedItems && data.uncategorizedItems.length > 0" 
        class="uncategorized-section"
        @dragover.prevent
        @drop="handleDrop($event, null)"
      >
        <h3 class="category-title">
          <span class="category-icon">🔗</span>
          Uncategorized Links
        </h3>
        <div class="links-grid">
          <div 
            v-for="item in data.uncategorizedItems" 
            :key="item.id" 
            class="link-card"
            draggable="true"
            @dragstart="handleDragStart($event, item)"
            @click="openLink(item.url)"
          >
            <div class="link-icon">
              <img :src="app_url + '/' + item.iconPath" alt="icon" onerror="this.src='/default-icon.png'" />
            </div>
            <div class="link-details">
              <h4>{{ item.name }}</h4>
              <small class="link-url">{{ formatUrl(item.url) }}</small>
            </div>
            <div class="drag-handle">
              <span>⋮⋮</span>
            </div>
          </div>
        </div>
      </div>

      <!-- No links message -->
      <div v-if="(!data.categories || data.categories.length === 0) && (!data.uncategorizedItems || data.uncategorizedItems.length === 0)" class="no-links">
        <p>You don't have any links yet. Add your first link!</p>
      </div>
    </div>

    <button class="floating-add-button" @click="showModal = true">+</button>

    <div v-if="showModal" class="modal-overlay">
      <div class="modal">
        <h2>Add a New Link</h2>
        <form @submit.prevent="addLink">
          <input v-model="newLink.name" placeholder="Link Name" required />
          <input v-model="newLink.url" placeholder="Link URL" required />
          <div class="file-input-container">
            <label for="icon-upload">Choose Icon</label>
            <input id="icon-upload" type="file" @change="handleFileUpload" accept="image/*" />
            <span v-if="iconFile">{{ iconFile.name }}</span>
          </div>
          <select v-model="newLink.categoryId">
            <option value="">No Category</option>
            <option v-for="category in data.categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
          <div class="modal-actions">
            <button type="submit">Add Link</button>
            <button type="button" class="cancel-button" @click="closeModal">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showCategoryModal" class="modal-overlay">
      <div class="modal">
        <h2>Create New Category</h2>
        <form @submit.prevent="addCategory">
          <input v-model="newCategory.name" placeholder="Category Name" required />
          <div class="file-input-container">
            <label for="category-icon-upload">Choose Icon</label>
            <input id="category-icon-upload" type="file" @change="handleCategoryIconUpload" accept="image/*" />
            <span v-if="categoryIconFile">{{ categoryIconFile.name }}</span>
          </div>
          <div class="modal-actions">
            <button type="submit">Create Category</button>
            <button type="button" class="cancel-button" @click="closeCategoryModal">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { app_url } from '../main';

interface LinkItem {
  id: string;
  name: string;
  url: string;
  iconPath: string;
  selfHostLinkCategoryId: string | null;
}

interface LinkCategory {
  id: string;
  name: string;
  Items: LinkItem[];
}

interface LinksData {
  categories: LinkCategory[];
  uncategorizedItems: LinkItem[];
}

const data = ref<LinksData>({
  categories: [],
  uncategorizedItems: []
});
const newLink = ref({ name: '', url: '', categoryId: '' });
const iconFile = ref<File | null>(null);
const showModal = ref(false);
const currentDragItem = ref<LinkItem | null>(null);
const searchQuery = ref('');

// New category related variables
const showCategoryModal = ref(false);
const newCategory = ref({ name: '' });
const categoryIconFile = ref<File | null>(null);

onMounted(async () => {
  await fetchLinks();
});

async function fetchLinks() {
  try {
    const response = await fetch(`${app_url}/api/links`, { credentials: 'include' });
    if (!response.ok) {
      throw new Error('Failed to fetch links');
    }
    data.value = await response.json();
  } catch (error) {
    console.error(error);
  }
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    iconFile.value = target.files[0];
  }
};

const handleCategoryIconUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    categoryIconFile.value = target.files[0];
  }
};

const formatUrl = (url: string) => {
  // Remove protocol and trailing slash for display
  return url.replace(/(^\w+:|^)\/\//, '').replace(/\/$/, '');
};

const openLink = (url: string) => {
  // Check if URL has protocol, if not add http://
  if (!/^https?:\/\//i.test(url)) {
    url = 'http://' + url;
  }
  window.open(url, '_blank');
};

const closeModal = () => {
  showModal.value = false;
  newLink.value = { name: '', url: '', categoryId: '' };
  iconFile.value = null;
};

const closeCategoryModal = () => {
  showCategoryModal.value = false;
  newCategory.value = { name: '' };
  categoryIconFile.value = null;
};

const addLink = async () => {
  try {
    const formData = new FormData();
    formData.append('name', newLink.value.name);
    formData.append('url', newLink.value.url);
    
    if (newLink.value.categoryId) {
      formData.append('selfHostLinkCategoryId', newLink.value.categoryId);
    }
    
    if (iconFile.value) {
      formData.append('icon', iconFile.value);
    }

    const response = await fetch(`${app_url}/api/links/item`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.error === 'An item with this name already exists.') {
        alert('An item with this name already exists. Please choose a different name.');
        return;
      }
      throw new Error('Failed to add link');
    }

    // Refresh links
    await fetchLinks();
    
    // Close modal and reset form
    closeModal();
  } catch (error) {
    console.error('Error adding link:', error);
  }
};

const addCategory = async () => {
  try {
    const formData = new FormData();
    formData.append('name', newCategory.value.name);
    
    if (categoryIconFile.value) {
      formData.append('icon', categoryIconFile.value);
    } else {
      // Default icon if none is selected
      formData.append('iconPath', 'default-category-icon.png');
    }

    const response = await fetch(`${app_url}/api/links/category`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.error === 'A category with this name already exists.') {
        alert('A category with this name already exists. Please choose a different name.');
        return;
      }
      throw new Error('Failed to create category');
    }

    // Refresh links to show the new category
    await fetchLinks();
    
    // Close modal and reset form
    closeCategoryModal();
  } catch (error) {
    console.error('Error creating category:', error);
  }
};

// Drag and drop functionality
const handleDragStart = (event: DragEvent, item: any) => {
  currentDragItem.value = item;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.id);
  }
};

const handleDrop = async (event: DragEvent, categoryId: string | null) => {
  event.preventDefault();
  
  if (!currentDragItem.value) return;
  
  const itemId = currentDragItem.value.id;
  const oldCategoryId = currentDragItem.value.selfHostLinkCategoryId;
  
  // Don't do anything if dropping to the same category
  if (oldCategoryId === categoryId) return;
  
  try {
    const response = await fetch(`${app_url}/api/links/item/${itemId}/move`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categoryId: categoryId,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to move item');
    }
    
    // Refresh links after successful move
    await fetchLinks();
    
  } catch (error) {
    console.error('Error moving item:', error);
  }
  
  currentDragItem.value = null;
};

// Google Search function
const searchGoogle = () => {
  if (searchQuery.value.trim()) {
    const query = encodeURIComponent(searchQuery.value.trim());
    window.open(`https://www.google.com/search?q=${query}`, '_blank');
    searchQuery.value = ''; // Clear the search input after search
  }
};
</script>

<style scoped>
.home-page {
  height: calc(100vh - 50px);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background-color: #1e1e1e;
  color: #cccccc;
}

h1 {
  font-size: 2.5em;
  margin-bottom: 10px;
}

p {
  font-size: 1.2em;
  margin-bottom: 20px;
}

.nav-buttons {
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
}

.get-started-button {
  display: inline-block;
  padding: 10px 20px;
  background-color: #0e639c;
  color: white;
  text-decoration: none;
  border-radius: 5px;
  font-size: 1em;
  transition: background-color 0.2s;
}

.get-started-button:hover {
  background-color: #1177bb;
}

.search-container {
  width: 100%;
  max-width: 600px;
  margin-bottom: 30px;
}

.search-container form {
  display: flex;
  width: 100%;
}

.search-input {
  flex: 1;
  padding: 12px 15px;
  font-size: 1em;
  border: none;
  border-radius: 24px 0 0 24px;
  background-color: #252526;
  color: #fff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.search-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px #0e639c;
}

.search-button {
  padding: 0 15px;
  background-color: #0e639c;
  color: white;
  font-size: 1.2em;
  border: none;
  border-radius: 0 24px 24px 0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-button:hover {
  background-color: #1177bb;
}

.links-container {
  width: 100%;
  max-width: 1200px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  margin: 0;
}

.category-button {
  background-color: #0e639c;
  color: white;
  border: none;
  border-radius: 5px;
  padding: 8px 16px;
  font-size: 0.9em;
  cursor: pointer;
  transition: background-color 0.2s;
}

.category-button:hover {
  background-color: #1177bb;
}

.category {
  margin-bottom: 30px;
  background-color: #252526;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.category.drag-over {
  border-color: #0e639c;
}

.category-title {
  font-size: 1.5em;
  margin-bottom: 15px;
  color: #ffffff;
  display: flex;
  align-items: center;
}

.category-icon {
  margin-right: 10px;
  font-size: 1.2em;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.link-card {
  background-color: #333333;
  border-radius: 8px;
  padding: 15px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s, background-color 0.2s;
  position: relative;
}

.link-card:hover {
  transform: translateY(-3px);
  background-color: #3c3c3c;
}

.link-card:hover .drag-handle {
  opacity: 1;
}

.drag-handle {
  position: absolute;
  top: 10px;
  right: 10px;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.2s;
  color: #8a8a8a;
  font-size: 16px;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.link-icon {
  width: 40px;
  height: 40px;
  margin-right: 15px;
  flex-shrink: 0;
}

.link-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 5px;
}

.link-details {
  flex-grow: 1;
}

.link-details h4 {
  margin: 0 0 5px 0;
  color: #ffffff;
  font-size: 1.1em;
}

.link-url {
  color: #8a8a8a;
  font-size: 0.8em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.uncategorized-section {
  background-color: #252526;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  border: 2px solid transparent;
  transition: border-color 0.2s;
}

.uncategorized-section.drag-over {
  border-color: #0e639c;
}

.no-links {
  text-align: center;
  padding: 40px;
  background-color: #252526;
  border-radius: 8px;
  margin-top: 20px;
}

.floating-add-button {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: #0e639c;
  color: white;
  font-size: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  transition: background-color 0.2s;
}

.floating-add-button:hover {
  background-color: #1177bb;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background-color: #252526;
  padding: 25px;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
}

.modal h2 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #ffffff;
}

.modal form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.modal input,
.modal select {
  padding: 12px;
  border-radius: 5px;
  border: 1px solid #444;
  background-color: #333;
  color: #fff;
  font-size: 1em;
}

.file-input-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.file-input-container label {
  background-color: #444;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-block;
  max-width: fit-content;
}

.file-input-container input[type="file"] {
  display: none;
}

.modal-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
}

.modal button {
  padding: 12px 20px;
  border-radius: 5px;
  border: none;
  font-size: 1em;
  cursor: pointer;
}

.modal button[type="submit"] {
  background-color: #0e639c;
  color: white;
}

.modal button[type="submit"]:hover {
  background-color: #1177bb;
}

.cancel-button {
  background-color: #555;
  color: white;
}

.cancel-button:hover {
  background-color: #666;
}
</style>
