// Electron main process - GUI only, no MCP protocol handling
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const { pathToFileURL } = require('url');

// Configuration file path
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

let mainWindow;
let mcpServerProcess;


// Default configuration
const defaultConfig = {
  WCC_BASE_URL: '',
  WCC_USER: '',
  WCC_PASSWORD: '',
  useEnvVars: true
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Load configuration from file
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...defaultConfig, ...config };
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return defaultConfig;
}

// Save configuration to file
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error);
    return false;
  }
}

// Start MCP server
function startMCPServer(config) {
  if (mcpServerProcess) {
    mcpServerProcess.kill();
    mcpServerProcess = null;
  }

  const env = { ...process.env };
  
  // Set GUI mode flag
  env.ELECTRON_GUI_MODE = 'true';
  
  // Use form values if not using env vars, otherwise use system env vars
  if (!config.useEnvVars) {
    env.WCC_BASE_URL = config.WCC_BASE_URL;
    env.WCC_USER = config.WCC_USER;
    env.WCC_PASSWORD = config.WCC_PASSWORD;
  }

  // Handle both development and packaged app paths
  const isDev = process.argv.includes('--dev') || !app.isPackaged;
  const serverPath = isDev 
    ? path.join(__dirname, '..', 'src', 'mcp-server.js')
    : path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'mcp-server.js');
  
  console.log('Starting MCP server with path:', serverPath);
  
  mcpServerProcess = spawn('node', [serverPath, '--gui-mode'], {
    env,
    stdio: 'pipe',
    detached: false
  });

  // Send immediate startup confirmation
  if (mainWindow) {
    mainWindow.webContents.send('server-status', {
      status: 'starting',
      message: 'MCP Server starting...'
    });
  }

  // Set a timeout to confirm startup
  setTimeout(() => {
    if (mcpServerProcess && !mcpServerProcess.killed) {
      console.log('MCP Server confirmed running');
      if (mainWindow) {
        mainWindow.webContents.send('server-status', {
          status: 'running',
          message: 'MCP Server started successfully'
        });
      }
    }
  }, 2000);

  mcpServerProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('MCP Server stdout:', output);
    if (mainWindow) {
      mainWindow.webContents.send('server-status', {
        status: 'running',
        message: output.trim()
      });
    }
  });

  mcpServerProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.error('MCP Server stderr:', output);
    // Send server status to renderer
    if (mainWindow) {
      mainWindow.webContents.send('server-status', {
        status: 'running',
        message: output.trim()
      });
    }
  });

  mcpServerProcess.on('close', (code) => {
    console.log(`MCP Server process exited with code ${code}`);
    mcpServerProcess = null;
    if (mainWindow) {
      mainWindow.webContents.send('server-status', {
        status: 'stopped',
        message: `Server stopped with code ${code}`
      });
    }
  });

  mcpServerProcess.on('error', (error) => {
    console.error('MCP Server process error:', error);
    mcpServerProcess = null;
    if (mainWindow) {
      mainWindow.webContents.send('server-status', {
        status: 'error',
        message: `Server error: ${error.message}`
      });
    }
  });
}

// Stop MCP server
function stopMCPServer() {
  // Stopping MCP server
  
  if (mcpServerProcess && !mcpServerProcess.killed) {
    // Stopping MCP Server
    
    // For Windows, use taskkill to properly terminate the process tree
    if (process.platform === 'win32') {
      const { spawn } = require('child_process');
      const currentPid = mcpServerProcess.pid;
      const taskkill = spawn('taskkill', ['/pid', currentPid, '/T', '/F']);
      
      // Set to null immediately to prevent race conditions
      mcpServerProcess = null;
      
      taskkill.on('close', (code) => {
        // Taskkill completed
        
        // Notify renderer that server stopped
        if (mainWindow) {
          mainWindow.webContents.send('server-status', {
            status: 'stopped',
            message: 'Server stopped successfully'
          });
        }
      });
      
      taskkill.on('error', (error) => {
        // Taskkill error
        
        // Notify renderer that server stopped (even if taskkill failed)
        if (mainWindow) {
          mainWindow.webContents.send('server-status', {
            status: 'stopped',
            message: 'Server stop attempted'
          });
        }
      });
    } else {
      // For Unix-like systems, use process groups
      try {
        process.kill(-mcpServerProcess.pid, 'SIGTERM');
        
        // Force kill after 3 seconds if still running
        setTimeout(() => {
          if (mcpServerProcess && !mcpServerProcess.killed) {
            // Force stopping MCP Server
            try {
              process.kill(-mcpServerProcess.pid, 'SIGKILL');
            } catch (error) {
              // Error force killing process
            }
            mcpServerProcess = null;
          }
        }, 3000);
      } catch (error) {
        // Error stopping process
        mcpServerProcess = null;
      }
    }
  } else {
    // No server process to stop
  }
}

// IPC handlers
ipcMain.handle('load-config', () => {
  return loadConfig();
});

ipcMain.handle('save-config', (event, config) => {
  return saveConfig(config);
});

ipcMain.handle('start-server', (event, config) => {
  try {
    startMCPServer(config);
    return { success: true, message: 'Server starting...' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('stop-server', () => {
  try {
    stopMCPServer();
    return { success: true, message: 'Server stopping...' };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('get-server-status', async () => {
  const isRunning = mcpServerProcess !== null && mcpServerProcess !== undefined && !mcpServerProcess.killed;
  const pid = mcpServerProcess?.pid || null;
  
  // For HTTP mode, also check if server is responding
  if (isRunning) {
    try {
      const axios = require('axios');
      const response = await axios.get('http://localhost:3999/status', { timeout: 1000 });
      return {
        running: true,
        pid: pid,
        httpStatus: response.data
      };
    } catch (error) {
      // HTTP check failed, but process might still be starting
      return {
        running: isRunning,
        pid: pid,
        httpStatus: null
      };
    }
  }
  
  return {
    running: isRunning,
    pid: pid
  };
});

ipcMain.handle('get-project-path', () => {
  const isDev = process.argv.includes('--dev') || !app.isPackaged;
  return isDev 
    ? path.join(__dirname, '..', 'src', 'mcp-server.js')  // In dev mode, use Node.js script
    : process.execPath; // In production, use the Electron executable path
});

// Debug: Force reset server state
ipcMain.handle('force-reset-server', () => {
  // Force reset server state
  mcpServerProcess = null;
  return { success: true, message: 'Server state reset' };
});

ipcMain.handle('test-connection', async (event, config) => {
  try {
    // Import the WebCenter client - handle both dev and packaged paths
    const isDev = process.argv.includes('--dev') || !app.isPackaged;
    const modulePath = isDev 
      ? path.join(__dirname, '..', 'src', 'webcenter-client.js')
      : path.join(process.resourcesPath, 'app.asar.unpacked', 'src', 'webcenter-client.js');
    const fileUrl = pathToFileURL(modulePath).href;
    const { WebCenterContentClient } = await import(fileUrl);
    
    // Get configuration values
    const baseUrl = config.useEnvVars ? process.env.WCC_BASE_URL : config.WCC_BASE_URL;
    const username = config.useEnvVars ? process.env.WCC_USER : config.WCC_USER;
    const password = config.useEnvVars ? process.env.WCC_PASSWORD : config.WCC_PASSWORD;
    
    // Validate configuration
    if (!baseUrl || !username || !password) {
      return {
        success: false,
        message: 'Missing required configuration values'
      };
    }
    
    // Create client and test connection
    const client = new WebCenterContentClient(baseUrl, username, password);
    const result = await client.testConnection();
    
    return result;
  } catch (error) {
    return {
      success: false,
      message: `Connection test failed: ${error.message}`,
      error: error.stack
    };
  }
});

// App event handlers
app.whenReady().then(() => {
  createWindow();
  
  // Create application menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            shell.openExternal('https://github.com/anthropics/claude-code');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopMCPServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopMCPServer();
});