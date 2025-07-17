# WebCenter Content MCP Server

A Model Context Protocol (MCP) server that provides access to Oracle WebCenter Content REST APIs. This application features both a desktop GUI (built with Electron) and a standalone MCP server following the electron-mcp pattern for clean separation of concerns.

## Features

This MCP server provides tools and resources for:

- **Document Management**: Search, download, upload, and manage documents
- **Folder Operations**: Create folders, search within folders, get folder information
- **Metadata Operations**: Get and update document metadata
- **Workflow Management**: Checkout/reverse checkout documents, view work in progress
- **Capabilities**: Check document permissions and capabilities

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables by creating or updating the `.env` file:
   ```
   WCC_BASE_URL=https://your-webcenter-domain.com/documents/wcc/api/v1.1
   WCC_USER=your-username
   WCC_PASSWORD=your-password
   MCP_PORT=3999
   ```

## Usage

This application can be used in two ways:

### 1. Desktop GUI Application (Electron)

Launch the desktop application with a graphical interface:

```bash
# Production mode
npm run electron

# Development mode (with DevTools)
npm run electron-dev
```

The GUI allows you to:
- Configure connection settings
- Start/stop the MCP server
- Test connections
- Monitor server status
- View server logs

### 2. Standalone MCP Server (for Claude Desktop)

Run the MCP server directly for use with Claude Desktop or other MCP clients:

```bash
# Direct MCP server (stdio mode)
npm start
npm run mcp

# Development mode with file watching
npm run dev

# Using the standalone launcher
node mcp-server-standalone.js
```

### Building for Distribution

```bash
# Build for current platform
npm run build:electron

# Build for Windows
npm run build:electron:win

# Build for macOS
npm run build:electron:mac

# Build for Linux
npm run build:electron:linux
```

## MCP Tools

The server provides the following MCP tools:

### Document Operations

- **search-documents**: Search for documents in WebCenter Content
- **get-document-metadata**: Get metadata for a specific document
- **download-document**: Download a document from WebCenter Content
- **update-document-metadata**: Update metadata for a document
- **checkout-document**: Checkout a document for editing
- **reverse-checkout**: Reverse checkout (undo checkout) of a document
- **get-document-capabilities**: Get capabilities/permissions for a document

### Folder Operations

- **create-folder**: Create a new folder in WebCenter Content
- **get-folder-info**: Get information about a specific folder
- **search-in-folder**: Search for items within a specific folder

## MCP Resources

The server provides access to these resources:

- **webcenter://documents**: Recent documents and search results
- **webcenter://folders**: Folder structure and information
- **webcenter://work-in-progress**: Documents currently being worked on

## Architecture

This application follows the **electron-mcp pattern** for optimal separation of concerns:

### Key Components

1. **Electron Main Process** (`electron/main.cjs`)
   - Desktop GUI host only
   - Spawns MCP server as child process
   - Handles configuration and server lifecycle
   - No MCP protocol handling

2. **MCP Server** (`src/mcp-server.js`)
   - Pure MCP protocol server
   - Dual-mode operation (stdio/HTTP)
   - Full WebCenter Content API integration
   - Maintains protocol compatibility

3. **Standalone Launcher** (`mcp-server-standalone.js`)
   - Direct MCP server access
   - Proper stdio handling for MCP clients
   - Used by Claude Desktop and other clients

### Operation Modes

- **GUI Mode**: HTTP server on port 3999, spawned by Electron
- **MCP Mode**: stdio transport for direct client communication
- **HTTP MCP Mode**: HTTP server with MCP protocol endpoint at `/mcp`
- **Automatic Detection**: Based on launch context and arguments

## Configuration for MCP Clients

### Claude Desktop

You can connect Claude Desktop to this server using **two different approaches**:

#### **🚀 Method 1: HTTP Server (Recommended for GUI users)**

1. **Launch the Electron GUI:**
   ```bash
   npm run electron-dev
   ```

2. **Start the MCP server** from the GUI interface

3. **Add HTTP configuration** to your Claude Desktop config (`claude_desktop_config.json`):
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

4. **Restart Claude Desktop** to load the new configuration

#### **📡 Method 2: Standalone Server (Direct stdio)**

Add this to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "webcenter-content": {
      "command": "node",
      "args": ["C:\\path\\to\\webcenter-content-mcp-server\\mcp-server-standalone.js"],
      "env": {
        "WCC_BASE_URL": "https://your-webcenter-domain.com/documents/wcc/api/v1.1",
        "WCC_USER": "your-username",
        "WCC_PASSWORD": "your-password"
      }
    }
  }
}
```

**Alternative direct server configuration:**

```json
{
  "mcpServers": {
    "webcenter-content": {
      "command": "node",
      "args": ["C:\\path\\to\\webcenter-content-mcp-server\\src\\mcp-server.js"],
      "env": {
        "WCC_BASE_URL": "https://your-webcenter-domain.com/documents/wcc/api/v1.1",
        "WCC_USER": "your-username",
        "WCC_PASSWORD": "your-password"
      }
    }
  }
}
```

### VS Code with MCP Extension

Configure the MCP extension to use this server by adding it to your MCP settings.

## API Coverage

This server covers the following WebCenter Content API endpoints:

- `/files/data` - Upload documents
- `/files/{dDocName}/data` - Download documents
- `/files/{dDocName}` - Get/update document metadata
- `/files/{dDocName}/checkout` - Checkout documents
- `/files/{dDocName}/reverseCheckout` - Reverse checkout
- `/files/{dDocName}/capabilities` - Get document capabilities
- `/files/workInProgress/items` - List work in progress
- `/search/items` - Global search
- `/folders` - Create folders
- `/folders/{fFolderGUID}` - Get folder info
- `/folders/search/items` - Search in folders

## Error Handling

The server includes comprehensive error handling for:

- Authentication failures
- Network connectivity issues
- Invalid parameters
- WebCenter Content API errors
- File system operations

## Security

- Uses HTTP Basic Authentication with WebCenter Content
- Sensitive credentials are managed through environment variables
- Input validation for all tool parameters
- Proper error messages without exposing sensitive information
- Clean separation prevents GUI/protocol interference
- No stdio contamination in desktop mode

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Benefits of This Architecture

✅ **Protocol Compatibility**: Full stdio MCP support for Claude Desktop  
✅ **HTTP MCP Support**: Native HTTP MCP endpoint for web-based clients  
✅ **GUI Functionality**: Electron desktop app with configuration UI  
✅ **Cross-platform**: Works on Windows, Mac, Linux  
✅ **No stdio Contamination**: Clean separation prevents GUI/protocol conflicts  
✅ **Flexible Deployment**: Can be used as GUI app or CLI MCP server  
✅ **Robust Process Management**: Proper child process handling and cleanup  
✅ **Status Monitoring**: HTTP endpoints for server health and status  
✅ **Dual Transport**: Supports both stdio and HTTP MCP transports  
✅ **Easy Integration**: Simple HTTP endpoint for Claude Desktop connection  

## Troubleshooting

### Common Issues

1. **Server exits immediately**: Check environment variables and WebCenter Content connectivity
2. **GUI shows "Server not started"**: Verify port 3999 is available and check server logs
3. **Connection test fails**: Validate WebCenter Content URL, username, and password
4. **MCP client can't connect**: Ensure using the standalone launcher or direct server path
5. **Port 3999 in use**: Stop other instances or change MCP_PORT in environment variables
6. **HTTP MCP not working**: Verify server is running and accessible at `http://localhost:3999/mcp`
7. **Claude Desktop not connecting**: Check config syntax and restart Claude Desktop after changes

### Debug Mode

Run with debug output:
```bash
# GUI mode
npm run electron-dev

# MCP server mode
npm run dev
```

### Health Check

When running in GUI mode, check server health:
```bash
# Server health
curl http://localhost:3999/health

# Server status
curl http://localhost:3999/status

# MCP endpoint info
curl http://localhost:3999/mcp

# Test MCP protocol (initialize)
curl -X POST http://localhost:3999/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"initialize","params":{"protocolVersion":"2025-01-01","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'
```

## License

This project is dual-licensed:

### 🆓 **Open Source License (GPL v3)**
- **Free for open source projects**
- Individual developers can use it freely
- Requires derivative works to be GPL-licensed
- Full license terms: [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html)

### 💼 **Commercial License**
- **For proprietary commercial use**
- Allows integration into closed-source products
- No copyleft requirements
- Suitable for SaaS products, internal tooling, and commercial platforms

**Commercial Use:**  
If you are an enterprise, consultant, or plan to use this in proprietary/commercial software, please [contact Fishbowl Solutions](https://fishbowlsolutions.com) to obtain a commercial license.

### 🤔 **Which License Do I Need?**
- **Use GPL v3** if you're building open source software
- **Need Commercial License** if you're:
  - Building proprietary software
  - Integrating into closed-source products
  - Developing commercial SaaS applications
  - Using in enterprise environments without open-sourcing your stack

See the [LICENSE](LICENSE) file for complete details.