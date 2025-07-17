# WebCenter Content MCP Server Architecture

This application follows the **electron-mcp pattern** for optimal separation of concerns between the desktop GUI and the MCP protocol server, providing both a user-friendly interface and robust protocol compatibility.

## Architecture Overview

### 1. Electron Main Process (`electron/main.cjs`)
- **Purpose**: Desktop GUI host only
- **Responsibilities**:
  - Create and manage the Electron window
  - Handle UI interactions and configuration
  - Spawn MCP server as child process with `--gui-mode` flag
  - Manage server lifecycle (start/stop)
  - Monitor server status via HTTP endpoints
  - No MCP protocol handling (clean separation)

### 2. MCP Server (`src/mcp-server.js`)
- **Purpose**: Dual-mode MCP protocol server
- **Responsibilities**:
  - **Stdio Mode**: Handle MCP protocol communication via stdin/stdout
  - **HTTP Mode**: Serve MCP protocol over HTTP at `/mcp` endpoint
  - Implement WebCenter Content tools and resources
  - Maintain full MCP protocol compatibility
  - Lazy-load WebCenter Content client for better error handling

### 3. WebCenter Content Client (`src/webcenter-client.js`)
- **Purpose**: Oracle WebCenter Content API integration
- **Responsibilities**:
  - HTTP Basic Authentication with WebCenter Content
  - Document management operations (search, download, metadata)
  - Folder operations (create, search, info)
  - Workflow management (checkout, work-in-progress)
  - Error handling and API response processing

### 4. Standalone Launcher (`mcp-server-standalone.js`)
- **Purpose**: Direct MCP server access wrapper
- **Responsibilities**:
  - Launch MCP server for direct client connections
  - Handle stdio inheritance properly for MCP protocol
  - Process management and signal handling
  - Used by Claude Desktop and other MCP clients

## Operation Modes

### 1. Desktop GUI Mode
```bash
npm run electron        # Production GUI
npm run electron-dev    # Development GUI with DevTools
```
- **Server Mode**: HTTP on port 3999
- **Protocol**: MCP over HTTP at `/mcp` endpoint
- **Use Case**: Configuration, testing, monitoring

### 2. MCP Server Mode (for Claude Desktop)
```bash
npm start              # Direct MCP server
npm run mcp            # Alias for direct MCP server
node mcp-server-standalone.js  # Standalone launcher
```
- **Server Mode**: stdio transport
- **Protocol**: MCP over stdin/stdout
- **Use Case**: Direct client integration

### 3. Development Mode
```bash
npm run dev            # Watch mode for MCP server
```
- **Server Mode**: stdio transport with file watching
- **Use Case**: Development and debugging

## Dual Transport Support

The MCP server automatically detects its operation mode:

### HTTP Transport (GUI Mode)
- **Trigger**: `--gui-mode` argument or `ELECTRON_GUI_MODE=true`
- **Endpoint**: `http://localhost:3999/mcp`
- **Protocol**: MCP over HTTP POST requests
- **Status**: Available at `/health` and `/status`

### Stdio Transport (Direct Mode)
- **Trigger**: Default when no GUI mode flags
- **Protocol**: MCP over stdin/stdout
- **Compatibility**: Full MCP client compatibility

## Key Benefits

1. **Clean Separation**: GUI and protocol server are completely separate
2. **Dual Transport**: Supports both stdio and HTTP MCP transports
3. **Protocol Compatibility**: Full stdio MCP protocol support
4. **HTTP MCP Support**: Native HTTP endpoint for web-based clients
5. **Cross-platform**: Works on Windows, Mac, Linux
6. **Flexible Usage**: Can be used as GUI app or CLI MCP server
7. **No stdio Contamination**: Electron GUI doesn't interfere with MCP protocol
8. **Robust Error Handling**: Lazy client initialization and comprehensive error management

## File Structure

```
├── electron/
│   ├── main.cjs           # Electron main process (GUI only)
│   ├── preload.cjs        # Preload script for IPC
│   └── renderer/          # UI files (HTML, CSS, JS)
├── src/
│   ├── mcp-server.js      # Dual-mode MCP protocol server
│   └── webcenter-client.js # WebCenter Content API client
├── mcp-server-standalone.js # Standalone MCP launcher
├── ARCHITECTURE.md        # This file
├── README.md             # User documentation
├── LICENSE               # GPL v3 license
├── COMMERCIAL-LICENSE    # Commercial license terms
├── package.json          # Project configuration
└── dist-electron/        # Build output (electron-builder)
```

## Configuration

The application uses environment variables for WebCenter Content connection:
- `WCC_BASE_URL`: WebCenter Content server URL
- `WCC_USER`: Username
- `WCC_PASSWORD`: Password
- `MCP_PORT`: HTTP server port (default: 3999)

These can be set via:
1. **Environment variables** (recommended for MCP server mode)
2. **GUI configuration form** (for desktop mode)
3. **`.env` file** (for development)

## Claude Desktop Integration

### Method 1: HTTP Server (Recommended)
1. Launch GUI: `npm run electron-dev`
2. Start MCP server from GUI
3. Configure Claude Desktop:
```json
{
  "mcpServers": {
    "webcenter-content": {
      "type": "http",
      "url": "http://localhost:3999/mcp"
    }
  }
}
```

### Method 2: Direct Server
```json
{
  "mcpServers": {
    "webcenter-content": {
      "command": "node",
      "args": ["path/to/mcp-server-standalone.js"],
      "env": {
        "WCC_BASE_URL": "your-server-url",
        "WCC_USER": "your-username", 
        "WCC_PASSWORD": "your-password"
      }
    }
  }
}
```

## MCP Protocol Implementation

### Tools Available
- **search-documents**: Search WebCenter Content documents
- **get-document-metadata**: Retrieve document metadata
- **download-document**: Download documents to local filesystem
- **update-document-metadata**: Update document metadata
- **create-folder**: Create new folders
- **get-folder-info**: Get folder information
- **search-in-folder**: Search within specific folders
- **checkout-document**: Checkout documents for editing
- **reverse-checkout**: Undo document checkout
- **get-document-capabilities**: Get document permissions

### Resources Available
- **webcenter://documents**: Recent documents and search results
- **webcenter://folders**: Folder structure and information
- **webcenter://work-in-progress**: Documents currently being worked on

## Security Considerations

1. **HTTP Basic Authentication** with WebCenter Content
2. **Environment variable management** for credentials
3. **Input validation** for all tool parameters
4. **Error message sanitization** to prevent information leakage
5. **Process isolation** between GUI and protocol server
6. **No credential storage** in configuration files

## Deployment Options

### Development
- Use `npm run electron-dev` for GUI development
- Use `npm run dev` for server development with file watching

### Production
- Build with `npm run build:electron`
- Distribute as standalone executable
- Configure environment variables for target systems

### Enterprise
- Use commercial license for proprietary deployments
- Configure via environment variables or GUI
- Integrate with existing authentication systems

This architecture provides maximum flexibility while maintaining clean separation of concerns and full MCP protocol compatibility.