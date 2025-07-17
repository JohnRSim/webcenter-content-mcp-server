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
- **Purpose**: Complete Oracle WebCenter Content REST API v1.1 integration
- **Responsibilities**:
  - HTTP Basic Authentication with WebCenter Content
  - Complete document lifecycle management (CRUD operations, revisions, conversions)
  - Comprehensive folder operations (create, delete, search, file management)
  - Storage management (tier updates, archive restoration)
  - Public and application link management
  - Background job orchestration (bulk operations, monitoring)
  - Workflow management (creation, approval, rejection)
  - Taxonomy and system configuration management
  - Attachment handling (upload, download, delete)
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

### Complete Tool Coverage (56 Tools)

The MCP server provides comprehensive coverage of the Oracle WebCenter Content REST API v1.1:

#### Document Management Tools
- **search-documents**: Search WebCenter Content documents
- **get-document-metadata**: Retrieve document metadata
- **download-document**: Download documents to local filesystem
- **download-document-by-revision-id**: Download specific document revision
- **update-document-metadata**: Update document metadata with versioning
- **update-document-by-revision-id**: Update specific document revision
- **delete-document**: Delete documents from WebCenter Content
- **upload-document-revision**: Upload new document revisions
- **checkout-document**: Checkout documents for editing
- **reverse-checkout**: Undo document checkout
- **get-document-capabilities**: Test document permissions
- **resubmit-conversion**: Resubmit failed document conversions
- **resubmit-conversion-by-revision-id**: Resubmit conversion by revision ID

#### Storage Management Tools
- **update-storage-tier**: Change document storage tier
- **update-storage-tier-by-revision-id**: Change storage tier by revision ID
- **restore-from-archive**: Restore documents from archive
- **restore-from-archive-by-revision-id**: Restore from archive by revision ID

#### Folder Management Tools
- **create-folder**: Create new folders
- **delete-folder**: Delete folders
- **get-folder-info**: Get folder information
- **get-folder-file-info**: Get file information within folders
- **delete-folder-file**: Delete files within folders
- **search-in-folder**: Search within specific folders
- **create-file-link**: Create file links within folders
- **get-folder-capabilities**: Test folder permissions

#### Public Link Management Tools
- **create-public-link-for-file**: Create public links for files
- **get-public-links-for-file**: List public links for files
- **create-public-link-for-folder**: Create public links for folders
- **get-public-links-for-folder**: List public links for folders
- **get-public-link-info**: Get public link information

#### Application Link Management Tools
- **create-application-link**: Create application links
- **get-application-links-for-folder**: List application links for folders
- **get-application-link-info**: Get application link information
- **delete-application-link**: Delete application links
- **refresh-application-link-token**: Refresh application link tokens

#### Background Job Management Tools
- **start-bulk-delete-job**: Start bulk delete operations
- **start-bulk-download-job**: Start bulk download operations
- **start-bulk-add-category-job**: Start bulk category addition
- **start-bulk-remove-category-job**: Start bulk category removal
- **cancel-background-job**: Cancel background jobs
- **get-background-job-status**: Monitor background job status
- **download-background-job-package**: Download job results

#### Taxonomy Management Tools
- **create-taxonomy**: Create new taxonomies
- **get-taxonomy**: Get taxonomy information
- **update-taxonomy**: Update taxonomy settings

#### System Management Tools
- **get-document-types**: List system document types
- **get-document-config-info**: Get system configuration
- **get-document-meta-info**: Get metadata field information
- **query-data-source**: Query system data sources

#### Workflow Management Tools
- **create-workflow**: Create new workflows
- **get-workflow**: Get workflow information
- **update-workflow**: Update workflow settings
- **approve-workflow**: Approve workflows for documents
- **reject-workflow**: Reject workflows for documents

#### Attachment Management Tools
- **add-attachment**: Add attachments to documents
- **get-attachments**: List document attachments
- **download-attachment**: Download document attachments
- **delete-attachment**: Delete document attachments

### Resources Available
- **webcenter://documents**: Recent documents and search results
- **webcenter://folders**: Folder structure and information
- **webcenter://work-in-progress**: Documents currently being worked on

### API Coverage Statistics
- **Total Endpoints**: 65+ REST API endpoints covered
- **Tool Categories**: 9 major functional categories
- **MCP Tools**: 56 comprehensive tools
- **API Version**: Complete Oracle WebCenter Content REST API v1.1
- **Operations**: Full CRUD operations across all resource types

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