// DOM elements
const configForm = document.getElementById('configForm');
const useEnvVarsCheckbox = document.getElementById('useEnvVars');
const manualConfigDiv = document.getElementById('manualConfig');
const baseUrlInput = document.getElementById('baseUrl');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const testConnectionBtn = document.getElementById('testConnection');
const startServerBtn = document.getElementById('startServer');
const stopServerBtn = document.getElementById('stopServer');
const serverStatusSpan = document.getElementById('serverStatus');
const serverLogDiv = document.getElementById('serverLog');
const clearLogBtn = document.getElementById('clearLog');
const copyConfigBtn = document.getElementById('copyConfig');
const configPathSpan = document.getElementById('configPath');

// State
let currentConfig = null;
let serverRunning = false;

// Initialize the app
async function init() {
    console.log('=== App Initialization ===');
    
    await loadConfiguration();
    console.log('Configuration loaded');
    
    setupEventListeners();
    console.log('Event listeners setup');
    
    // Force enable the start button initially
    startServerBtn.disabled = false;
    stopServerBtn.disabled = true;
    console.log('Initial button states set - start enabled, stop disabled');
    
    await updateServerStatus();
    console.log('Server status updated');
    
    await updateClaudeConfig();
    console.log('Claude config updated');
    
    console.log('=== App Initialization Complete ===');
}

// Load configuration from main process
async function loadConfiguration() {
    try {
        currentConfig = await window.electronAPI.loadConfig();
        updateFormFromConfig(currentConfig);
    } catch (error) {
        console.error('Error loading configuration:', error);
        addLogEntry('Error loading configuration', 'error');
    }
}

// Update form fields from config
function updateFormFromConfig(config) {
    useEnvVarsCheckbox.checked = config.useEnvVars;
    baseUrlInput.value = config.WCC_BASE_URL || '';
    usernameInput.value = config.WCC_USER || '';
    passwordInput.value = config.WCC_PASSWORD || '';
    
    toggleManualConfig();
}

// Toggle manual configuration visibility
function toggleManualConfig() {
    if (useEnvVarsCheckbox.checked) {
        manualConfigDiv.style.display = 'none';
        baseUrlInput.removeAttribute('required');
        usernameInput.removeAttribute('required');
        passwordInput.removeAttribute('required');
    } else {
        manualConfigDiv.style.display = 'block';
        baseUrlInput.setAttribute('required', 'required');
        usernameInput.setAttribute('required', 'required');
        passwordInput.setAttribute('required', 'required');
    }
}

// Setup event listeners
function setupEventListeners() {
    useEnvVarsCheckbox.addEventListener('change', toggleManualConfig);
    
    configForm.addEventListener('submit', handleConfigSubmit);
    testConnectionBtn.addEventListener('click', handleTestConnection);
    startServerBtn.addEventListener('click', (e) => {
        console.log('Start button clicked!', e);
        console.log('Button disabled state:', startServerBtn.disabled);
        if (!startServerBtn.disabled) {
            handleStartServer();
        } else {
            console.log('Button click ignored - disabled');
        }
    });
    
    stopServerBtn.addEventListener('click', (e) => {
        console.log('Stop button clicked!', e);
        console.log('Button disabled state:', stopServerBtn.disabled);
        if (!stopServerBtn.disabled) {
            handleStopServer();
        } else {
            console.log('Button click ignored - disabled');
        }
    });
    clearLogBtn.addEventListener('click', clearLog);
    copyConfigBtn.addEventListener('click', copyClaudeConfig);
    
    // Listen for server status updates
    window.electronAPI.onServerStatus((event, status) => {
        const logType = status.status === 'running' ? 'success' : 
                       status.status === 'starting' ? 'info' :
                       status.status === 'stopped' ? 'warning' : 'error';
        addLogEntry(status.message, logType);
        
        // Update button states immediately when we get status updates
        setTimeout(() => {
            updateServerStatus();
        }, 500);
    });
}

// Handle configuration form submission
async function handleConfigSubmit(event) {
    event.preventDefault();
    
    const config = {
        useEnvVars: useEnvVarsCheckbox.checked,
        WCC_BASE_URL: baseUrlInput.value,
        WCC_USER: usernameInput.value,
        WCC_PASSWORD: passwordInput.value
    };
    
    try {
        const success = await window.electronAPI.saveConfig(config);
        if (success) {
            currentConfig = config;
            addLogEntry('Configuration saved successfully', 'success');
            updateClaudeConfig();
        } else {
            addLogEntry('Error saving configuration', 'error');
        }
    } catch (error) {
        console.error('Error saving configuration:', error);
        addLogEntry('Error saving configuration', 'error');
    }
}

// Handle test connection
async function handleTestConnection() {
    // Get current form values for testing
    const testConfig = {
        useEnvVars: useEnvVarsCheckbox.checked,
        WCC_BASE_URL: baseUrlInput.value,
        WCC_USER: usernameInput.value,
        WCC_PASSWORD: passwordInput.value
    };
    
    // Validate configuration
    if (!testConfig.useEnvVars) {
        if (!testConfig.WCC_BASE_URL || !testConfig.WCC_USER || !testConfig.WCC_PASSWORD) {
            addLogEntry('Please fill in all required fields', 'warning');
            return;
        }
    }
    
    testConnectionBtn.disabled = true;
    testConnectionBtn.textContent = 'Testing...';
    addLogEntry('Testing connection...', 'info');
    
    try {
        const result = await window.electronAPI.testConnection(testConfig);
        
        if (result.success) {
            addLogEntry(`✓ ${result.message}`, 'success');
            if (result.serverInfo) {
                addLogEntry(`Server info: ${JSON.stringify(result.serverInfo)}`, 'info');
            }
        } else {
            addLogEntry(`✗ ${result.message}`, 'error');
            if (result.error) {
                addLogEntry(`Details: ${JSON.stringify(result.error)}`, 'error');
            }
        }
    } catch (error) {
        console.error('Error testing connection:', error);
        addLogEntry('Connection test failed: ' + error.message, 'error');
    } finally {
        testConnectionBtn.disabled = false;
        testConnectionBtn.textContent = 'Test Connection';
    }
}

// Handle start server
async function handleStartServer() {
    console.log('handleStartServer called, currentConfig:', currentConfig);
    
    // Get current form values for starting server
    const serverConfig = currentConfig || {
        useEnvVars: useEnvVarsCheckbox.checked,
        WCC_BASE_URL: baseUrlInput.value,
        WCC_USER: usernameInput.value,
        WCC_PASSWORD: passwordInput.value
    };
    
    console.log('Using config:', serverConfig);
    
    // If using env vars, we can proceed without form values
    if (!serverConfig.useEnvVars) {
        if (!serverConfig.WCC_BASE_URL || !serverConfig.WCC_USER || !serverConfig.WCC_PASSWORD) {
            addLogEntry('Please configure WebCenter Content settings first', 'warning');
            return;
        }
    }
    
    startServerBtn.disabled = true;
    startServerBtn.textContent = 'Starting...';
    
    try {
        const result = await window.electronAPI.startServer(serverConfig);
        if (result.success) {
            addLogEntry(result.message || 'Starting MCP server...', 'info');
        } else {
            addLogEntry('Error starting server: ' + result.message, 'error');
        }
        
        // Update status after a short delay to allow process to start
        setTimeout(() => {
            updateServerStatus();
        }, 1000);
    } catch (error) {
        console.error('Error starting server:', error);
        addLogEntry('Error starting server: ' + error.message, 'error');
        startServerBtn.disabled = false;
        startServerBtn.textContent = 'Start Server';
    }
}

// Handle stop server
async function handleStopServer() {
    stopServerBtn.disabled = true;
    stopServerBtn.textContent = 'Stopping...';
    
    try {
        const result = await window.electronAPI.stopServer();
        if (result.success) {
            addLogEntry(result.message || 'Stopping MCP server...', 'info');
        } else {
            addLogEntry('Error stopping server: ' + result.message, 'error');
        }
        
        // Update status after a short delay to allow process to stop
        setTimeout(() => {
            updateServerStatus();
        }, 2000);
    } catch (error) {
        console.error('Error stopping server:', error);
        addLogEntry('Error stopping server: ' + error.message, 'error');
        stopServerBtn.disabled = false;
        stopServerBtn.textContent = 'Stop Server';
    }
}

// Update server status
async function updateServerStatus() {
    console.log('=== updateServerStatus called ===');
    
    try {
        console.log('Getting server status...');
        const status = await window.electronAPI.getServerStatus();
        console.log('Server status received:', status);
        
        serverRunning = status.running;
        console.log('serverRunning set to:', serverRunning);
        
        if (serverRunning) {
            console.log('Server is running - disabling start button');
            serverStatusSpan.textContent = `Running (PID: ${status.pid})`;
            serverStatusSpan.className = 'status running';
            startServerBtn.disabled = true;
            startServerBtn.textContent = 'Start Server';
            stopServerBtn.disabled = false;
            stopServerBtn.textContent = 'Stop Server';
        } else {
            console.log('Server is stopped - enabling start button');
            serverStatusSpan.textContent = 'Stopped';
            serverStatusSpan.className = 'status stopped';
            startServerBtn.disabled = false;
            startServerBtn.textContent = 'Start Server';
            stopServerBtn.disabled = true;
            stopServerBtn.textContent = 'Stop Server';
        }
        
        console.log('Final button states - start disabled:', startServerBtn.disabled, 'stop disabled:', stopServerBtn.disabled);
    } catch (error) {
        console.error('Error getting server status:', error);
        console.log('Error occurred - enabling start button');
        // Reset to stopped state on error
        serverStatusSpan.textContent = 'Error';
        serverStatusSpan.className = 'status stopped';
        startServerBtn.disabled = false;
        startServerBtn.textContent = 'Start Server';
        stopServerBtn.disabled = true;
        stopServerBtn.textContent = 'Stop Server';
    }
    
    console.log('=== updateServerStatus complete ===');
}

// Add entry to server log
function addLogEntry(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = type;
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    serverLogDiv.appendChild(logEntry);
    serverLogDiv.scrollTop = serverLogDiv.scrollHeight;
}

// Clear server log
function clearLog() {
    serverLogDiv.innerHTML = '<p>Log cleared</p>';
}

// Update Claude Desktop configuration display
async function updateClaudeConfig() {
    if (currentConfig) {
        try {
            const projectPath = await window.electronAPI.getProjectPath();
            configPathSpan.textContent = projectPath;
        } catch (error) {
            console.error('Error getting project path:', error);
            configPathSpan.textContent = 'C:\\\\path\\\\to\\\\your\\\\project\\\\src\\\\index.js';
        }
    }
}

// Copy Claude Desktop configuration to clipboard
async function copyClaudeConfig() {
    const config = document.getElementById('claudeConfig').textContent;
    
    try {
        await navigator.clipboard.writeText(config);
        addLogEntry('Configuration copied to clipboard', 'success');
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        addLogEntry('Error copying to clipboard', 'error');
    }
}

// Debug function for button state
function debugButtonState() {
    console.log('=== Button Debug Info ===');
    console.log('startServerBtn element:', startServerBtn);
    console.log('startServerBtn.disabled:', startServerBtn.disabled);
    console.log('startServerBtn.textContent:', startServerBtn.textContent);
    console.log('startServerBtn.className:', startServerBtn.className);
    console.log('startServerBtn style.display:', startServerBtn.style.display);
    console.log('startServerBtn computed style:', window.getComputedStyle(startServerBtn));
    console.log('========================');
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Update server status periodically
setInterval(updateServerStatus, 5000);

// Add debug button state check
setInterval(debugButtonState, 10000);