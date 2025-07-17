# WebCenter Content MCP Server

A Model Context Protocol (MCP) server that provides access to Oracle WebCenter Content REST APIs. This application features both a desktop GUI (built with Electron) and a standalone MCP server following the electron-mcp pattern for clean separation of concerns.

## Features

This MCP server provides comprehensive tools and resources for Oracle WebCenter Content, covering the complete REST API v1.1 specification:

- **Document Management**: Search, download, upload, update, delete documents and revisions
- **Folder Operations**: Create, delete folders, manage files within folders, create file links
- **Metadata Operations**: Get and update document metadata with versioning support
- **Workflow Management**: Create, update, approve, reject workflows; checkout/reverse checkout documents
- **Public & Application Links**: Create and manage public links and application links for files and folders
- **Background Jobs**: Start and monitor bulk operations (delete, download, category management)
- **Taxonomies**: Create, update, and manage taxonomies for document categorization
- **System Operations**: Query data sources, manage document types, get system configuration
- **Attachments**: Add, download, list, and delete document attachments
- **Storage Management**: Update storage tiers and restore documents from archive
- **Capabilities**: Test document and folder permissions and capabilities
- **Conversion Management**: Resubmit failed document conversions

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

The server provides 56 comprehensive MCP tools covering all WebCenter Content operations.

> 📚 **Complete Documentation**: See [ENDPOINTS.md](ENDPOINTS.md) for detailed documentation of all 56 MCP tools with parameters and examples.

### Document Operations

- **search-documents**: Search for documents in WebCenter Content
- **get-document-metadata**: Get metadata for a specific document
- **download-document**: Download a document from WebCenter Content
- **download-document-by-revision-id**: Download document by specific revision ID
- **update-document-metadata**: Update metadata for a document (with versioning)
- **update-document-by-revision-id**: Update document by specific revision ID
- **delete-document**: Delete a document from WebCenter Content
- **upload-document-revision**: Upload a new revision of an existing document
- **checkout-document**: Checkout a document for editing
- **reverse-checkout**: Reverse checkout (undo checkout) of a document
- **get-document-capabilities**: Get capabilities/permissions for a document
- **resubmit-conversion**: Resubmit failed conversion for a document
- **resubmit-conversion-by-revision-id**: Resubmit failed conversion by revision ID

### Storage Management

- **update-storage-tier**: Change storage tier for a document
- **update-storage-tier-by-revision-id**: Change storage tier by revision ID
- **restore-from-archive**: Restore document from archive
- **restore-from-archive-by-revision-id**: Restore document from archive by revision ID

### Folder Operations

- **create-folder**: Create a new folder in WebCenter Content
- **delete-folder**: Delete a folder
- **get-folder-info**: Get information about a specific folder
- **get-folder-file-info**: Get file information within a folder
- **delete-folder-file**: Delete a file within a folder
- **search-in-folder**: Search for items within a specific folder
- **create-file-link**: Create a file link within a folder
- **get-folder-capabilities**: Test folder capabilities and permissions

### Public Links Management

- **create-public-link-for-file**: Create public link for a file
- **get-public-links-for-file**: List public links for a file
- **create-public-link-for-folder**: Create public link for a folder
- **get-public-links-for-folder**: List public links for a folder
- **get-public-link-info**: Get information about a public link

### Application Links Management

- **create-application-link**: Create application link for a folder
- **get-application-links-for-folder**: List application links for a folder
- **get-application-link-info**: Get application link information
- **delete-application-link**: Delete an application link
- **refresh-application-link-token**: Refresh application link access token

### Background Jobs

- **start-bulk-delete-job**: Start bulk delete operation
- **start-bulk-download-job**: Start bulk download operation
- **start-bulk-add-category-job**: Start bulk add category operation
- **start-bulk-remove-category-job**: Start bulk remove category operation
- **cancel-background-job**: Cancel a background job
- **get-background-job-status**: Get status of a background job
- **download-background-job-package**: Download results of a background job

### Taxonomies

- **create-taxonomy**: Create a new taxonomy
- **get-taxonomy**: Get taxonomy information
- **update-taxonomy**: Update a taxonomy

### System Operations

- **get-document-types**: List all document types
- **get-document-config-info**: Get system configuration information
- **get-document-meta-info**: Get metadata fields information
- **query-data-source**: Query system data sources

### Workflow Management

- **create-workflow**: Create a new workflow
- **get-workflow**: Get workflow information
- **update-workflow**: Update workflow settings
- **approve-workflow**: Approve workflow for a document
- **reject-workflow**: Reject workflow for a document

### Attachment Operations

- **add-attachment**: Add attachment to a document
- **get-attachments**: List attachments for a document
- **download-attachment**: Download a document attachment
- **delete-attachment**: Delete a document attachment

## MCP Resources

The server provides access to these resources:

- **webcenter://documents**: Recent documents and search results
- **webcenter://folders**: Folder structure and information
- **webcenter://work-in-progress**: Documents currently being worked on

## Architecture

This application follows the **electron-mcp pattern** for optimal separation of concerns.

> 🏗️ **Architecture Details**: See [ARCHITECTURE.md](ARCHITECTURE.md) for comprehensive architecture documentation.

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


## API Coverage

This server provides **complete coverage** of the Oracle WebCenter Content REST API v1.1 specification, including all documented endpoints:

### File Operations
- `POST /files/data` - Upload new documents
- `GET /files/{dDocName}/data` - Download document content
- `POST /files/{dDocName}/data` - Upload document revision
- `GET /files/.by.did/{dID}/data` - Download by revision ID
- `PUT /files/{dDocName}` - Update document metadata
- `PUT /files/.by.did/{dID}` - Update by revision ID
- `DELETE /files/{dDocName}` - Delete document
- `POST /files/{dDocName}/resubmitConversion` - Resubmit failed conversion
- `POST /files/.by.did/{dID}/resubmitConversion` - Resubmit conversion by revision ID
- `POST /files/{dDocName}/storage/.updateStorageTier` - Update storage tier
- `POST /files/.by.did/{dID}/storage/.updateStorageTier` - Update storage tier by revision ID
- `POST /files/{dDocName}/storage/.restoreFromArchive` - Restore from archive
- `POST /files/.by.did/{dID}/storage/.restoreFromArchive` - Restore from archive by revision ID
- `GET /files/workInProgress/items` - List work in progress
- `POST /files/{dDocName}/.checkout` - Checkout document
- `POST /files/{dDocName}/.undocheckout` - Undo checkout
- `GET /files/{dDocName}/capabilities` - Get document capabilities
- `GET /files/search/items` - Global document search

### Folder Operations
- `POST /folders` - Create folder or shortcut
- `GET /folders/{fFolderGUID}` - Get folder information
- `DELETE /folders/{fFolderGUID}` - Delete folder
- `GET /folders/files/{fFileGUID}` - Get file info in folder
- `DELETE /folders/files/{fFileGUID}` - Delete file in folder
- `GET /folders/search/items` - Search within folders
- `POST /folders/{fFolderGUID}/{dDocName}/filelinks` - Create file link
- `GET /folders/{fFolderGUID}/capabilities` - Test folder capabilities

### Public Links
- `POST /publiclinks/.by.file/{fFileGUID}` - Create public link for file
- `GET /publiclinks/.by.file/{fFileGUID}` - List public links for file
- `POST /publiclinks/.by.folder/{fFolderGUID}` - Create public link for folder
- `GET /publiclinks/.by.folder/{fFolderGUID}` - List public links for folder
- `GET /publiclinks/{dLinkID}` - Get public link info

### Application Links
- `POST /applinks/.by.folder/{fFolderGUID}` - Create application link
- `GET /applinks/.by.folder/{fFolderGUID}` - List application links for folder
- `GET /applinks/{dAppLinkID}` - Get application link info
- `DELETE /applinks/{dAppLinkID}` - Delete application link
- `POST /applinks/{dAppLinkID}/.refreshAccessToken` - Refresh access token

### Background Jobs
- `POST /.bulk/.delete` - Start bulk delete job
- `POST /.bulk/.download` - Start bulk download job
- `POST /.bulk/categories/.add` - Start bulk add category job
- `POST /.bulk/categories/.remove` - Start bulk remove category job
- `POST /.bulk/{dJobID}/.cancel` - Cancel background job
- `GET /.bulk/{dJobID}` - Get background job status
- `GET /.bulk/{dJobID}/package` - Download background job package

### Taxonomies
- `POST /taxonomies` - Create taxonomy
- `GET /taxonomies/{dTaxonomyGUID}` - Get taxonomy
- `PUT /taxonomies/{dTaxonomyGUID}` - Update taxonomy

### System Operations
- `POST /system/docProfiles` - Create document profile
- `GET /system/docProfiles/{dpName}` - Get document profile
- `PUT /system/docProfiles/{dpName}` - Update document profile
- `DELETE /system/docProfiles/{dpName}` - Delete document profile
- `GET /system/{dataSource}/items` - Query data source
- `GET /system/doctypes` - List document types
- `POST /system/doctypes` - Create document type
- `PUT /system/doctypes/{dDocType}` - Update document type
- `DELETE /system/doctypes/{dDocType}` - Delete document type
- `GET /system/docConfigInfo` - Get configuration info
- `GET /system/docMetaInfo` - Get metadata fields info

### Workflow Operations
- `POST /workflow` - Create workflow
- `GET /workflows/{dWfName}` - Get workflow information
- `PUT /workflows/{dWfName}` - Edit workflow
- `POST /files/{dDocName}/workflow/.approve` - Approve workflow
- `POST /files/{dDocName}/workflow/.reject` - Reject workflow

### Attachment Operations
- `POST /files/{dDocName}/attachments/data` - Add attachment
- `GET /files/{dDocName}/attachments/` - List attachments
- `GET /files/{dDocName}/attachments/{extRenditionName}/data` - Download attachment
- `DELETE /files/{dDocName}/attachments/{extRenditionName}` - Delete attachment

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
