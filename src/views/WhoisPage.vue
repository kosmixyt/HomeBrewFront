<template>
  <div class="whois-page">
    <h1>WHOIS Domain Lookup</h1>
    <p>Look up registration information for a domain name</p>

    <div class="search-container">
      <form @submit.prevent="searchDomain">
        <input 
          v-model="domainQuery" 
          type="text" 
          placeholder="Enter a domain name..." 
          class="domain-input"
        />
        <button type="submit" class="search-button">
          Lookup
        </button>
      </form>
    </div>

    <div v-if="loading" class="loading">
      <p>Loading domain information...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
    </div>

    <div v-else-if="whoisData" class="result">
      <h2>{{ whoisData.domain_name }}</h2>
      
      <div class="result-section">
        <h3>Registration Information</h3>
        <div class="info-grid">
          <div class="info-row">
            <strong>Creation Date:</strong>
            <span>{{ formatDate(whoisData.creation_date) }}</span>
          </div>
          <div class="info-row">
            <strong>Expiration Date:</strong>
            <span>{{ formatDate(whoisData.expiration_date) }}</span>
          </div>
          <div class="info-row">
            <strong>Registrar:</strong>
            <span>{{ whoisData.registrar }}</span>
          </div>
          <div class="info-row" v-if="whoisData.dnssec">
            <strong>DNSSEC:</strong>
            <span>{{ whoisData.dnssec }}</span>
          </div>
        </div>
      </div>

      <div class="result-section" v-if="whoisData.name_servers && whoisData.name_servers.length">
        <h3>Name Servers</h3>
        <ul class="server-list">
          <li v-for="(server, index) in whoisData.name_servers" :key="index">
            {{ server }}
          </li>
        </ul>
      </div>

      <div class="raw-data">
        <h3>Raw WHOIS Data</h3>
        <pre>{{ JSON.stringify(whoisData, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { app_url } from '../main';

const domainQuery = ref('');
const whoisData = ref(null);
const loading = ref(false);
const error = ref('');

const searchDomain = async () => {
  if (!domainQuery.value.trim()) {
    error.value = 'Please enter a domain name';
    return;
  }
  
  loading.value = true;
  error.value = '';
  whoisData.value = null;
  
  try {
    const response = await fetch(
      `${app_url}/api/whois/query?domain=${encodeURIComponent(domainQuery.value.trim())}`, 
      { credentials: 'include' }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch domain information');
    }
    
    const data = await response.json();
    whoisData.value = data;
  } catch (err) {
    error.value = err.message || 'An error occurred while fetching domain information';
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
</script>

<style scoped>
.whois-page {
  height: calc(100vh - 90px);
  display: flex;
  padding: 20px;
  flex-direction: column;
  align-items: center;
  background-color: #1e1e1e;
  color: #cccccc;
  overflow-y: auto; /* Prevent vertical overflow */
}

h1 {
  font-size: 2.5em;
  margin-bottom: 10px;
}

p {
  font-size: 1.2em;
  margin-bottom: 30px;
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

.domain-input {
  flex: 1;
  padding: 12px 15px;
  font-size: 1em;
  border: none;
  border-radius: 5px 0 0 5px;
  background-color: #252526;
  color: #fff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.domain-input:focus {
  outline: none;
  box-shadow: 0 0 0 2px #0e639c;
}

.search-button {
  padding: 0 20px;
  background-color: #0e639c;
  color: white;
  font-size: 1em;
  border: none;
  border-radius: 0 5px 5px 0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-button:hover {
  background-color: #1177bb;
}

.loading, .error {
  width: 100%;
  max-width: 800px;
  text-align: center;
  padding: 20px;
  margin-top: 20px;
}

.error {
  color: #ff5555;
}

.result {
  width: 100%;
  max-width: 800px;
  background-color: #252526;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.result h2 {
  font-size: 2em;
  color: #ffffff;
  margin-bottom: 20px;
  border-bottom: 1px solid #444;
  padding-bottom: 10px;
  text-transform: uppercase;
}

.result-section {
  margin-bottom: 25px;
}

.result-section h3 {
  font-size: 1.3em;
  color: #0e639c;
  margin-bottom: 15px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #333;
}

.server-list {
  list-style-type: none;
  padding: 0;
}

.server-list li {
  padding: 8px 0;
  border-bottom: 1px solid #333;
}

.raw-data {
  margin-top: 30px;
  padding: 15px;
  background-color: #1e1e1e;
  border-radius: 5px;
  overflow: auto;
}

.raw-data pre {
  white-space: pre-wrap;
  font-family: monospace;
}
</style>
