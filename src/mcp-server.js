#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WebCenterContentClient } from './webcenter-client.js';
import dotenv from 'dotenv';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

class WebCenterContentMCPServer {
  constructor(port = 3999, mode = null) {
    this.port = port;
    this.httpServer = null;
    this.app = null;
    
    // Determine mode: command line arg, environment variable, or default
    if (mode) {
      this.mode = mode;
    } else if (process.argv.includes('--gui-mode') || process.env.ELECTRON_GUI_MODE === 'true') {
      this.mode = 'http';
    } else {
      this.mode = 'stdio';
    }
    
    console.log('MCP Server constructor - Mode:', this.mode, 'Port:', this.port);
    
    this.server = new Server(
      {
        name: 'webcenter-content-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Initialize WebCenter Content client (lazy initialization)
    this.wccClient = null;

    this.setupHandlers();
    
    if (this.mode === 'http') {
      this.setupHttpServer();
    }
  }

  getWccClient() {
    if (!this.wccClient) {
      console.log('Initializing WebCenter Content client...');
      this.wccClient = new WebCenterContentClient(
        process.env.WCC_BASE_URL,
        process.env.WCC_USER,
        process.env.WCC_PASSWORD
      );
    }
    return this.wccClient;
  }

  // Helper methods for HTTP MCP protocol
  async handleToolsList() {
    return {
      tools: [
        {
          name: 'search-documents',
          description: 'Search for documents in WebCenter Content',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query string',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 10,
              },
              orderBy: {
                type: 'string',
                description: 'Sort order (e.g., "dInDate desc")',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get-document-metadata',
          description: 'Get metadata for a specific document',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name (dDocName)',
              },
            },
            required: ['dDocName'],
          },
        },
        {
          name: 'download-document',
          description: 'Download a document from WebCenter Content',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name (dDocName)',
              },
              version: {
                type: 'string',
                description: 'Document version (optional)',
              },
              rendition: {
                type: 'string',
                description: 'Rendition type (optional)',
              },
              outputPath: {
                type: 'string',
                description: 'Local path to save the downloaded file',
              },
            },
            required: ['dDocName', 'outputPath'],
          },
        },
        {
          name: 'update-document-metadata',
          description: 'Update metadata for a document',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name (dDocName)',
              },
              metadata: {
                type: 'object',
                description: 'Metadata values to update',
              },
            },
            required: ['dDocName', 'metadata'],
          },
        },
        {
          name: 'create-folder',
          description: 'Create a new folder in WebCenter Content',
          inputSchema: {
            type: 'object',
            properties: {
              folderName: {
                type: 'string',
                description: 'Name of the folder to create',
              },
              parentFolderGUID: {
                type: 'string',
                description: 'Parent folder GUID (optional)',
              },
              description: {
                type: 'string',
                description: 'Folder description (optional)',
              },
            },
            required: ['folderName'],
          },
        },
        {
          name: 'get-folder-info',
          description: 'Get information about a specific folder',
          inputSchema: {
            type: 'object',
            properties: {
              fFolderGUID: {
                type: 'string',
                description: 'Folder GUID',
              },
            },
            required: ['fFolderGUID'],
          },
        },
        {
          name: 'search-in-folder',
          description: 'Search for items within a specific folder',
          inputSchema: {
            type: 'object',
            properties: {
              fFolderGUID: {
                type: 'string',
                description: 'Folder GUID to search within',
              },
              query: {
                type: 'string',
                description: 'Search query (optional)',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results',
                default: 10,
              },
            },
            required: ['fFolderGUID'],
          },
        },
        {
          name: 'checkout-document',
          description: 'Checkout a document for editing',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name (dDocName)',
              },
            },
            required: ['dDocName'],
          },
        },
        {
          name: 'reverse-checkout',
          description: 'Reverse checkout (undo checkout) of a document',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name (dDocName)',
              },
            },
            required: ['dDocName'],
          },
        },
        {
          name: 'get-document-capabilities',
          description: 'Get capabilities/permissions for a document',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name (dDocName)',
              },
            },
            required: ['dDocName'],
          },
        },
      ],
    };
  }

  async handleResourcesList() {
    return {
      resources: [
        {
          uri: 'webcenter://documents',
          name: 'WebCenter Documents',
          description: 'Access to WebCenter Content documents',
          mimeType: 'application/json',
        },
        {
          uri: 'webcenter://folders',
          name: 'WebCenter Folders',
          description: 'Access to WebCenter Content folders',
          mimeType: 'application/json',
        },
        {
          uri: 'webcenter://work-in-progress',
          name: 'Work in Progress',
          description: 'Documents currently being worked on',
          mimeType: 'application/json',
        },
      ],
    };
  }

  async handleResourceRead(params) {
    const { uri } = params;

    try {
      switch (uri) {
        case 'webcenter://documents':
          const searchResults = await this.getWccClient().searchDocuments('*', {
            limit: 20
          });
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(searchResults, null, 2),
              },
            ],
          };

        case 'webcenter://folders':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({ message: 'Use search-folders tool to find specific folders' }, null, 2),
              },
            ],
          };

        case 'webcenter://work-in-progress':
          const wipItems = await this.getWccClient().listWorkInProgress();
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(wipItems, null, 2),
              },
            ],
          };

        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    } catch (error) {
      throw new Error(`Failed to read resource ${uri}: ${error.message}`);
    }
  }

  async handleToolCall(params) {
    const { name, arguments: args } = params;

    try {
      switch (name) {
        case 'search-documents':
          const searchOptions = {
            limit: args.limit || 10,
          };
          if (args.orderBy) {
            searchOptions.orderBy = args.orderBy;
          }
          const searchResults = await this.getWccClient().searchDocuments(
            args.query || '*',
            searchOptions
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(searchResults, null, 2),
              },
            ],
          };

        case 'get-document-metadata':
          const metadata = await this.getWccClient().getDocumentMetadata(args.dDocName);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(metadata, null, 2),
              },
            ],
          };

        case 'download-document':
          const stream = await this.getWccClient().downloadDocument(
            args.dDocName,
            args.version,
            args.rendition
          );
          
          const outputDir = path.dirname(args.outputPath);
          if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
          }

          const chunks = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          writeFileSync(args.outputPath, buffer);

          return {
            content: [
              {
                type: 'text',
                text: `Document downloaded successfully to: ${args.outputPath}`,
              },
            ],
          };

        case 'update-document-metadata':
          const updateResult = await this.getWccClient().updateDocumentMetadata(
            args.dDocName,
            args.metadata
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(updateResult, null, 2),
              },
            ],
          };

        case 'create-folder':
          const folderData = {
            fFolderName: args.folderName,
            fDescription: args.description || '',
          };
          if (args.parentFolderGUID) {
            folderData.fParentGUID = args.parentFolderGUID;
          }

          const folderResult = await this.getWccClient().createFolder(folderData);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(folderResult, null, 2),
              },
            ],
          };

        case 'get-folder-info':
          const folderInfo = await this.getWccClient().getFolderInfo(args.fFolderGUID);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(folderInfo, null, 2),
              },
            ],
          };

        case 'search-in-folder':
          const folderSearchResults = await this.getWccClient().searchInFolder(
            args.fFolderGUID,
            {
              query: args.query,
              limit: args.limit || 10,
            }
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(folderSearchResults, null, 2),
              },
            ],
          };

        case 'checkout-document':
          const checkoutResult = await this.getWccClient().checkoutDocument(args.dDocName);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(checkoutResult, null, 2),
              },
            ],
          };

        case 'reverse-checkout':
          const reverseCheckoutResult = await this.getWccClient().reverseCheckout(args.dDocName);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(reverseCheckoutResult, null, 2),
              },
            ],
          };

        case 'get-document-capabilities':
          const capabilities = await this.getWccClient().getDocumentCapabilities(args.dDocName);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(capabilities, null, 2),
              },
            ],
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool ${name}: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'webcenter://documents',
            name: 'WebCenter Documents',
            description: 'Access to WebCenter Content documents',
            mimeType: 'application/json',
          },
          {
            uri: 'webcenter://folders',
            name: 'WebCenter Folders',
            description: 'Access to WebCenter Content folders',
            mimeType: 'application/json',
          },
          {
            uri: 'webcenter://work-in-progress',
            name: 'Work in Progress',
            description: 'Documents currently being worked on',
            mimeType: 'application/json',
          },
        ],
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        switch (uri) {
          case 'webcenter://documents':
            // Return recent documents or search results
            const searchResults = await this.getWccClient().searchDocuments('*', {
              limit: 20
            });
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(searchResults, null, 2),
                },
              ],
            };

          case 'webcenter://folders':
            // This would need a specific folder GUID in a real implementation
            // For now, return a placeholder
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify({ message: 'Use search-folders tool to find specific folders' }, null, 2),
                },
              ],
            };

          case 'webcenter://work-in-progress':
            const wipItems = await this.getWccClient().listWorkInProgress();
            return {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(wipItems, null, 2),
                },
              ],
            };

          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
      } catch (error) {
        throw new Error(`Failed to read resource ${uri}: ${error.message}`);
      }
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search-documents',
            description: 'Search for documents in WebCenter Content',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query string',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 10,
                },
                orderBy: {
                  type: 'string',
                  description: 'Sort order (e.g., "dInDate desc")',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get-document-metadata',
            description: 'Get metadata for a specific document',
            inputSchema: {
              type: 'object',
              properties: {
                dDocName: {
                  type: 'string',
                  description: 'Document name (dDocName)',
                },
              },
              required: ['dDocName'],
            },
          },
          {
            name: 'download-document',
            description: 'Download a document from WebCenter Content',
            inputSchema: {
              type: 'object',
              properties: {
                dDocName: {
                  type: 'string',
                  description: 'Document name (dDocName)',
                },
                version: {
                  type: 'string',
                  description: 'Document version (optional)',
                },
                rendition: {
                  type: 'string',
                  description: 'Rendition type (optional)',
                },
                outputPath: {
                  type: 'string',
                  description: 'Local path to save the downloaded file',
                },
              },
              required: ['dDocName', 'outputPath'],
            },
          },
          {
            name: 'update-document-metadata',
            description: 'Update metadata for a document',
            inputSchema: {
              type: 'object',
              properties: {
                dDocName: {
                  type: 'string',
                  description: 'Document name (dDocName)',
                },
                metadata: {
                  type: 'object',
                  description: 'Metadata values to update',
                },
              },
              required: ['dDocName', 'metadata'],
            },
          },
          {
            name: 'create-folder',
            description: 'Create a new folder in WebCenter Content',
            inputSchema: {
              type: 'object',
              properties: {
                folderName: {
                  type: 'string',
                  description: 'Name of the folder to create',
                },
                parentFolderGUID: {
                  type: 'string',
                  description: 'Parent folder GUID (optional)',
                },
                description: {
                  type: 'string',
                  description: 'Folder description (optional)',
                },
              },
              required: ['folderName'],
            },
          },
          {
            name: 'get-folder-info',
            description: 'Get information about a specific folder',
            inputSchema: {
              type: 'object',
              properties: {
                fFolderGUID: {
                  type: 'string',
                  description: 'Folder GUID',
                },
              },
              required: ['fFolderGUID'],
            },
          },
          {
            name: 'search-in-folder',
            description: 'Search for items within a specific folder',
            inputSchema: {
              type: 'object',
              properties: {
                fFolderGUID: {
                  type: 'string',
                  description: 'Folder GUID to search within',
                },
                query: {
                  type: 'string',
                  description: 'Search query (optional)',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results',
                  default: 10,
                },
              },
              required: ['fFolderGUID'],
            },
          },
          {
            name: 'checkout-document',
            description: 'Checkout a document for editing',
            inputSchema: {
              type: 'object',
              properties: {
                dDocName: {
                  type: 'string',
                  description: 'Document name (dDocName)',
                },
              },
              required: ['dDocName'],
            },
          },
          {
            name: 'reverse-checkout',
            description: 'Reverse checkout (undo checkout) of a document',
            inputSchema: {
              type: 'object',
              properties: {
                dDocName: {
                  type: 'string',
                  description: 'Document name (dDocName)',
                },
              },
              required: ['dDocName'],
            },
          },
          {
            name: 'get-document-capabilities',
            description: 'Get capabilities/permissions for a document',
            inputSchema: {
              type: 'object',
              properties: {
                dDocName: {
                  type: 'string',
                  description: 'Document name (dDocName)',
                },
              },
              required: ['dDocName'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search-documents':
            const searchOptions = {
              limit: args.limit || 10,
            };
            if (args.orderBy) {
              searchOptions.orderBy = args.orderBy;
            }
            const searchResults = await this.getWccClient().searchDocuments(
              args.query || '*',
              searchOptions
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(searchResults, null, 2),
                },
              ],
            };

          case 'get-document-metadata':
            const metadata = await this.getWccClient().getDocumentMetadata(args.dDocName);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(metadata, null, 2),
                },
              ],
            };

          case 'download-document':
            const stream = await this.getWccClient().downloadDocument(
              args.dDocName,
              args.version,
              args.rendition
            );
            
            // Ensure output directory exists
            const outputDir = path.dirname(args.outputPath);
            if (!existsSync(outputDir)) {
              mkdirSync(outputDir, { recursive: true });
            }

            // Save the file
            const chunks = [];
            for await (const chunk of stream) {
              chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            writeFileSync(args.outputPath, buffer);

            return {
              content: [
                {
                  type: 'text',
                  text: `Document downloaded successfully to: ${args.outputPath}`,
                },
              ],
            };

          case 'update-document-metadata':
            const updateResult = await this.getWccClient().updateDocumentMetadata(
              args.dDocName,
              args.metadata
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(updateResult, null, 2),
                },
              ],
            };

          case 'create-folder':
            const folderData = {
              fFolderName: args.folderName,
              fDescription: args.description || '',
            };
            if (args.parentFolderGUID) {
              folderData.fParentGUID = args.parentFolderGUID;
            }

            const folderResult = await this.getWccClient().createFolder(folderData);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(folderResult, null, 2),
                },
              ],
            };

          case 'get-folder-info':
            const folderInfo = await this.getWccClient().getFolderInfo(args.fFolderGUID);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(folderInfo, null, 2),
                },
              ],
            };

          case 'search-in-folder':
            const folderSearchResults = await this.getWccClient().searchInFolder(
              args.fFolderGUID,
              {
                query: args.query,
                limit: args.limit || 10,
              }
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(folderSearchResults, null, 2),
                },
              ],
            };

          case 'checkout-document':
            const checkoutResult = await this.getWccClient().checkoutDocument(args.dDocName);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(checkoutResult, null, 2),
                },
              ],
            };

          case 'reverse-checkout':
            const reverseCheckoutResult = await this.getWccClient().reverseCheckout(args.dDocName);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(reverseCheckoutResult, null, 2),
                },
              ],
            };

          case 'get-document-capabilities':
            const capabilities = await this.getWccClient().getDocumentCapabilities(args.dDocName);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(capabilities, null, 2),
                },
              ],
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  setupHttpServer() {
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.text());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        server: 'WebCenter Content MCP Server',
        port: this.port,
        timestamp: new Date().toISOString(),
      });
    });

    // Simple status endpoint for GUI
    this.app.get('/status', (req, res) => {
      res.json({
        running: true,
        mode: this.mode,
        port: this.port,
        capabilities: ['tools', 'resources'],
      });
    });

    // MCP HTTP endpoint for Claude Desktop
    this.app.post('/mcp', async (req, res) => {
      try {
        const mcpRequest = req.body;
        console.log('MCP HTTP request:', mcpRequest?.method);
        
        // Handle MCP protocol requests
        let result;
        
        switch (mcpRequest.method) {
          case 'initialize':
            result = {
              id: mcpRequest.id,
              result: {
                protocolVersion: '2025-01-01',
                capabilities: {
                  tools: {},
                  resources: {}
                },
                serverInfo: {
                  name: 'webcenter-content-mcp-server',
                  version: '1.0.0',
                },
              },
            };
            break;
            
          case 'tools/list':
            // Get tools from the MCP server
            const toolsResponse = await this.handleToolsList();
            result = {
              id: mcpRequest.id,
              result: toolsResponse,
            };
            break;
            
          case 'tools/call':
            // Handle tool calls
            const toolResult = await this.handleToolCall(mcpRequest.params);
            result = {
              id: mcpRequest.id,
              result: toolResult,
            };
            break;
            
          case 'resources/list':
            // Get resources from the MCP server
            const resourcesResponse = await this.handleResourcesList();
            result = {
              id: mcpRequest.id,
              result: resourcesResponse,
            };
            break;
            
          case 'resources/read':
            // Handle resource reads
            const resourceResult = await this.handleResourceRead(mcpRequest.params);
            result = {
              id: mcpRequest.id,
              result: resourceResult,
            };
            break;
            
          default:
            throw new Error(`Unknown method: ${mcpRequest.method}`);
        }
        
        res.json(result);
      } catch (error) {
        console.error('MCP HTTP request error:', error);
        res.status(500).json({
          id: req.body?.id || null,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message,
          },
        });
      }
    });

    // Handle GET requests to /mcp for information
    this.app.get('/mcp', (req, res) => {
      res.json({
        message: 'MCP (Model Context Protocol) HTTP Server',
        description: 'This endpoint accepts POST requests with MCP protocol messages.',
        version: '1.0.0',
        serverInfo: {
          name: 'webcenter-content-mcp-server',
          version: '1.0.0'
        },
        endpoints: {
          health: 'GET /health',
          status: 'GET /status',
          mcp: 'POST /mcp'
        },
        timestamp: new Date().toISOString()
      });
    });

    // Handle OPTIONS requests for CORS
    this.app.options('/mcp', (req, res) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.sendStatus(200);
    });
  }

  async startHttpServer() {
    if (!this.app) {
      this.setupHttpServer();
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.httpServer = this.app.listen(this.port, () => {
          console.log(`WebCenter Content MCP Server running on port ${this.port}`);
          resolve();
        });
        
        this.httpServer.on('error', (error) => {
          console.error('HTTP Server error:', error);
          reject(error);
        });
      } catch (error) {
        console.error('Failed to start HTTP server:', error);
        reject(error);
      }
    });
  }

  async stopHttpServer() {
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer.close(() => {
          console.log('HTTP Server stopped');
          resolve();
        });
      });
    }
  }

  getStatus() {
    return {
      running: this.mode === 'http' ? !!this.httpServer?.listening : true,
      port: this.port,
      mode: this.mode,
      endpoint: this.mode === 'http' ? `http://localhost:${this.port}/status` : 'stdio',
    };
  }

  async run() {
    console.log('Starting MCP Server...');
    
    if (this.mode === 'http') {
      console.log('Starting MCP Server in HTTP mode...');
      try {
        await this.startHttpServer();
        console.log('MCP Server started successfully in HTTP mode');
        // Keep process alive in HTTP mode
        process.stdin.resume();
        
        // Add periodic keepalive
        setInterval(() => {
          // Keepalive - server is running
        }, 30000);
        
      } catch (error) {
        console.error('Failed to start HTTP server:', error);
        process.exit(1);
      }
    } else {
      console.log('Starting MCP Server in stdio mode...');
      try {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        // Server running - no output to avoid contaminating stdio
      } catch (error) {
        console.error('Failed to start stdio transport:', error);
        process.exit(1);
      }
    }
  }
}

// Check if this file is being run directly
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

// Only run if this file is executed directly
if (isMainModule) {
  const port = process.env.MCP_PORT || 3999;
  const server = new WebCenterContentMCPServer(port);
  
  server.run().catch((error) => {
    console.error('MCP Server error:', error);
    process.exit(1);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down MCP Server...');
    if (server.mode === 'http') {
      await server.stopHttpServer();
    }
    process.exit(0);
  });
}

export default WebCenterContentMCPServer;