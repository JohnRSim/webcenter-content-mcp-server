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
              version: {
                type: 'string',
                description: 'Document version (optional)',
              },
              createPrimaryMetaFile: {
                type: 'boolean',
                description: 'Create primary meta file (optional)',
              },
              createAlternateMetaFile: {
                type: 'boolean',
                description: 'Create alternate meta file (optional)',
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
              testedCapabilities: {
                type: 'string',
                description: 'Comma-separated list of capabilities to test',
              },
            },
            required: ['dDocName', 'testedCapabilities'],
          },
        },
        {
          name: 'delete-document',
          description: 'Delete a document from WebCenter Content',
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
            },
            required: ['dDocName'],
          },
        },
        {
          name: 'upload-document-revision',
          description: 'Upload a new revision of a document',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name (dDocName)',
              },
              filePath: {
                type: 'string',
                description: 'Path to the file to upload',
              },
              metadata: {
                type: 'object',
                description: 'Document metadata',
              },
            },
            required: ['dDocName', 'filePath', 'metadata'],
          },
        },
        {
          name: 'download-document-by-revision-id',
          description: 'Download document by revision ID',
          inputSchema: {
            type: 'object',
            properties: {
              dID: {
                type: 'string',
                description: 'Document revision ID',
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
            required: ['dID', 'outputPath'],
          },
        },
        {
          name: 'update-document-by-revision-id',
          description: 'Update document by revision ID',
          inputSchema: {
            type: 'object',
            properties: {
              dID: {
                type: 'string',
                description: 'Document revision ID',
              },
              metadata: {
                type: 'object',
                description: 'Updated metadata',
              },
              createPrimaryMetaFile: {
                type: 'boolean',
                description: 'Create primary meta file (optional)',
              },
              createAlternateMetaFile: {
                type: 'boolean',
                description: 'Create alternate meta file (optional)',
              },
            },
            required: ['dID', 'metadata'],
          },
        },
        {
          name: 'resubmit-conversion',
          description: 'Resubmit failed conversion',
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
              alwaysResubmit: {
                type: 'boolean',
                description: 'Always resubmit flag (optional)',
              },
            },
            required: ['dDocName'],
          },
        },
        {
          name: 'resubmit-conversion-by-revision-id',
          description: 'Resubmit failed conversion by revision ID',
          inputSchema: {
            type: 'object',
            properties: {
              dID: {
                type: 'string',
                description: 'Document revision ID',
              },
            },
            required: ['dID'],
          },
        },
        {
          name: 'update-storage-tier',
          description: 'Change storage tier for a document',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name (dDocName)',
              },
              storageTier: {
                type: 'string',
                description: 'Storage tier',
              },
              version: {
                type: 'string',
                description: 'Document version (optional)',
              },
            },
            required: ['dDocName', 'storageTier'],
          },
        },
        {
          name: 'update-storage-tier-by-revision-id',
          description: 'Change storage tier by revision ID',
          inputSchema: {
            type: 'object',
            properties: {
              dID: {
                type: 'string',
                description: 'Document revision ID',
              },
              storageTier: {
                type: 'string',
                description: 'Storage tier',
              },
            },
            required: ['dID', 'storageTier'],
          },
        },
        {
          name: 'restore-from-archive',
          description: 'Restore document from archive',
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
              hours: {
                type: 'number',
                description: 'Hours to restore for (optional)',
              },
            },
            required: ['dDocName'],
          },
        },
        {
          name: 'restore-from-archive-by-revision-id',
          description: 'Restore document from archive by revision ID',
          inputSchema: {
            type: 'object',
            properties: {
              dID: {
                type: 'string',
                description: 'Document revision ID',
              },
              hours: {
                type: 'number',
                description: 'Hours to restore for (optional)',
              },
            },
            required: ['dID'],
          },
        },
        {
          name: 'delete-folder',
          description: 'Delete a folder',
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
          name: 'get-folder-file-info',
          description: 'Get file info in folder',
          inputSchema: {
            type: 'object',
            properties: {
              fFileGUID: {
                type: 'string',
                description: 'File GUID',
              },
            },
            required: ['fFileGUID'],
          },
        },
        {
          name: 'delete-folder-file',
          description: 'Delete file in folder',
          inputSchema: {
            type: 'object',
            properties: {
              fFileGUID: {
                type: 'string',
                description: 'File GUID',
              },
            },
            required: ['fFileGUID'],
          },
        },
        {
          name: 'create-file-link',
          description: 'Create file link in folder',
          inputSchema: {
            type: 'object',
            properties: {
              fFolderGUID: {
                type: 'string',
                description: 'Folder GUID',
              },
              dDocName: {
                type: 'string',
                description: 'Document name',
              },
              fFileType: {
                type: 'string',
                description: 'File type (optional)',
              },
              ConflictResolutionMethod: {
                type: 'string',
                description: 'Conflict resolution method (optional)',
              },
            },
            required: ['fFolderGUID', 'dDocName'],
          },
        },
        {
          name: 'get-folder-capabilities',
          description: 'Test folder capabilities',
          inputSchema: {
            type: 'object',
            properties: {
              fFolderGUID: {
                type: 'string',
                description: 'Folder GUID',
              },
              testedCapabilities: {
                type: 'string',
                description: 'Comma-separated list of capabilities to test',
              },
            },
            required: ['fFolderGUID', 'testedCapabilities'],
          },
        },
        {
          name: 'create-public-link-for-file',
          description: 'Create public link for file',
          inputSchema: {
            type: 'object',
            properties: {
              fFileGUID: {
                type: 'string',
                description: 'File GUID',
              },
              publicLinkData: {
                type: 'object',
                description: 'Public link data',
              },
            },
            required: ['fFileGUID', 'publicLinkData'],
          },
        },
        {
          name: 'get-public-links-for-file',
          description: 'List public links for file',
          inputSchema: {
            type: 'object',
            properties: {
              fFileGUID: {
                type: 'string',
                description: 'File GUID',
              },
              offset: {
                type: 'number',
                description: 'Offset for pagination (optional)',
              },
              limit: {
                type: 'number',
                description: 'Limit for pagination (optional)',
              },
            },
            required: ['fFileGUID'],
          },
        },
        {
          name: 'create-public-link-for-folder',
          description: 'Create public link for folder',
          inputSchema: {
            type: 'object',
            properties: {
              fFolderGUID: {
                type: 'string',
                description: 'Folder GUID',
              },
              publicLinkData: {
                type: 'object',
                description: 'Public link data',
              },
            },
            required: ['fFolderGUID', 'publicLinkData'],
          },
        },
        {
          name: 'get-public-links-for-folder',
          description: 'List public links for folder',
          inputSchema: {
            type: 'object',
            properties: {
              fFolderGUID: {
                type: 'string',
                description: 'Folder GUID',
              },
              offset: {
                type: 'number',
                description: 'Offset for pagination (optional)',
              },
              limit: {
                type: 'number',
                description: 'Limit for pagination (optional)',
              },
            },
            required: ['fFolderGUID'],
          },
        },
        {
          name: 'get-public-link-info',
          description: 'Get public link info',
          inputSchema: {
            type: 'object',
            properties: {
              dLinkID: {
                type: 'string',
                description: 'Link ID',
              },
            },
            required: ['dLinkID'],
          },
        },
        {
          name: 'create-application-link',
          description: 'Create application link',
          inputSchema: {
            type: 'object',
            properties: {
              fFolderGUID: {
                type: 'string',
                description: 'Folder GUID',
              },
              applicationLinkData: {
                type: 'object',
                description: 'Application link data',
              },
            },
            required: ['fFolderGUID', 'applicationLinkData'],
          },
        },
        {
          name: 'get-application-links-for-folder',
          description: 'List application links for folder',
          inputSchema: {
            type: 'object',
            properties: {
              fFolderGUID: {
                type: 'string',
                description: 'Folder GUID',
              },
              offset: {
                type: 'number',
                description: 'Offset for pagination (optional)',
              },
              limit: {
                type: 'number',
                description: 'Limit for pagination (optional)',
              },
            },
            required: ['fFolderGUID'],
          },
        },
        {
          name: 'get-application-link-info',
          description: 'Get application link info',
          inputSchema: {
            type: 'object',
            properties: {
              dAppLinkID: {
                type: 'string',
                description: 'Application link ID',
              },
            },
            required: ['dAppLinkID'],
          },
        },
        {
          name: 'delete-application-link',
          description: 'Delete application link',
          inputSchema: {
            type: 'object',
            properties: {
              dAppLinkID: {
                type: 'string',
                description: 'Application link ID',
              },
            },
            required: ['dAppLinkID'],
          },
        },
        {
          name: 'refresh-application-link-token',
          description: 'Refresh application link access token',
          inputSchema: {
            type: 'object',
            properties: {
              dAppLinkID: {
                type: 'string',
                description: 'Application link ID',
              },
              refreshData: {
                type: 'object',
                description: 'Refresh token data',
              },
            },
            required: ['dAppLinkID', 'refreshData'],
          },
        },
        {
          name: 'start-bulk-delete-job',
          description: 'Start bulk delete job',
          inputSchema: {
            type: 'object',
            properties: {
              jobRequest: {
                type: 'object',
                description: 'Job request data',
              },
            },
            required: ['jobRequest'],
          },
        },
        {
          name: 'start-bulk-download-job',
          description: 'Start bulk download job',
          inputSchema: {
            type: 'object',
            properties: {
              jobRequest: {
                type: 'object',
                description: 'Job request data',
              },
            },
            required: ['jobRequest'],
          },
        },
        {
          name: 'start-bulk-add-category-job',
          description: 'Start bulk add category job',
          inputSchema: {
            type: 'object',
            properties: {
              jobRequest: {
                type: 'object',
                description: 'Job request data',
              },
            },
            required: ['jobRequest'],
          },
        },
        {
          name: 'start-bulk-remove-category-job',
          description: 'Start bulk remove category job',
          inputSchema: {
            type: 'object',
            properties: {
              jobRequest: {
                type: 'object',
                description: 'Job request data',
              },
            },
            required: ['jobRequest'],
          },
        },
        {
          name: 'cancel-background-job',
          description: 'Cancel a background job',
          inputSchema: {
            type: 'object',
            properties: {
              dJobID: {
                type: 'string',
                description: 'Job ID',
              },
            },
            required: ['dJobID'],
          },
        },
        {
          name: 'get-background-job-status',
          description: 'Get status of a background job',
          inputSchema: {
            type: 'object',
            properties: {
              dJobID: {
                type: 'string',
                description: 'Job ID',
              },
            },
            required: ['dJobID'],
          },
        },
        {
          name: 'download-background-job-package',
          description: 'Download background job package',
          inputSchema: {
            type: 'object',
            properties: {
              dJobID: {
                type: 'string',
                description: 'Job ID',
              },
              outputPath: {
                type: 'string',
                description: 'Local path to save the package',
              },
            },
            required: ['dJobID', 'outputPath'],
          },
        },
        {
          name: 'create-taxonomy',
          description: 'Create a taxonomy',
          inputSchema: {
            type: 'object',
            properties: {
              taxonomyData: {
                type: 'object',
                description: 'Taxonomy creation data',
              },
            },
            required: ['taxonomyData'],
          },
        },
        {
          name: 'get-taxonomy',
          description: 'Get a taxonomy',
          inputSchema: {
            type: 'object',
            properties: {
              dTaxonomyGUID: {
                type: 'string',
                description: 'Taxonomy GUID',
              },
            },
            required: ['dTaxonomyGUID'],
          },
        },
        {
          name: 'update-taxonomy',
          description: 'Update a taxonomy',
          inputSchema: {
            type: 'object',
            properties: {
              dTaxonomyGUID: {
                type: 'string',
                description: 'Taxonomy GUID',
              },
              taxonomyData: {
                type: 'object',
                description: 'Taxonomy update data',
              },
            },
            required: ['dTaxonomyGUID', 'taxonomyData'],
          },
        },
        {
          name: 'get-document-types',
          description: 'List document types',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get-document-config-info',
          description: 'Get configuration info',
          inputSchema: {
            type: 'object',
            properties: {
              rowLimit: {
                type: 'number',
                description: 'Row limit (optional)',
              },
              includeResultSets: {
                type: 'string',
                description: 'Include result sets (optional)',
              },
            },
          },
        },
        {
          name: 'get-document-meta-info',
          description: 'Get metadata fields info',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'query-data-source',
          description: 'Query data source',
          inputSchema: {
            type: 'object',
            properties: {
              dataSource: {
                type: 'string',
                description: 'Data source name',
              },
              whereClause: {
                type: 'string',
                description: 'Where clause (optional)',
              },
              orderClause: {
                type: 'string',
                description: 'Order clause (optional)',
              },
              maxRows: {
                type: 'number',
                description: 'Maximum rows (optional)',
              },
              startRow: {
                type: 'number',
                description: 'Start row (optional)',
              },
            },
            required: ['dataSource'],
          },
        },
        {
          name: 'create-workflow',
          description: 'Create a new workflow',
          inputSchema: {
            type: 'object',
            properties: {
              workflowData: {
                type: 'object',
                description: 'Workflow data',
              },
            },
            required: ['workflowData'],
          },
        },
        {
          name: 'get-workflow',
          description: 'Get workflow information',
          inputSchema: {
            type: 'object',
            properties: {
              dWfName: {
                type: 'string',
                description: 'Workflow name',
              },
            },
            required: ['dWfName'],
          },
        },
        {
          name: 'update-workflow',
          description: 'Edit workflow',
          inputSchema: {
            type: 'object',
            properties: {
              dWfName: {
                type: 'string',
                description: 'Workflow name',
              },
              workflowData: {
                type: 'object',
                description: 'Workflow update data',
              },
            },
            required: ['dWfName', 'workflowData'],
          },
        },
        {
          name: 'approve-workflow',
          description: 'Approve workflow for document',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name',
              },
            },
            required: ['dDocName'],
          },
        },
        {
          name: 'reject-workflow',
          description: 'Reject workflow for document',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name',
              },
              rejectMessage: {
                type: 'string',
                description: 'Rejection message (optional)',
              },
            },
            required: ['dDocName'],
          },
        },
        {
          name: 'add-attachment',
          description: 'Add attachment to document',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name',
              },
              extRenditionName: {
                type: 'string',
                description: 'External rendition name',
              },
              filePath: {
                type: 'string',
                description: 'Path to attachment file',
              },
              extRenditionDescription: {
                type: 'string',
                description: 'External rendition description (optional)',
              },
              version: {
                type: 'string',
                description: 'Version (optional)',
              },
            },
            required: ['dDocName', 'extRenditionName', 'filePath'],
          },
        },
        {
          name: 'get-attachments',
          description: 'List attachments for document',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name',
              },
            },
            required: ['dDocName'],
          },
        },
        {
          name: 'download-attachment',
          description: 'Download attachment',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name',
              },
              extRenditionName: {
                type: 'string',
                description: 'External rendition name',
              },
              outputPath: {
                type: 'string',
                description: 'Local path to save the attachment',
              },
            },
            required: ['dDocName', 'extRenditionName', 'outputPath'],
          },
        },
        {
          name: 'delete-attachment',
          description: 'Delete attachment',
          inputSchema: {
            type: 'object',
            properties: {
              dDocName: {
                type: 'string',
                description: 'Document name',
              },
              extRenditionName: {
                type: 'string',
                description: 'External rendition name',
              },
            },
            required: ['dDocName', 'extRenditionName'],
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
            args.metadata,
            args.version,
            args.createPrimaryMetaFile,
            args.createAlternateMetaFile
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
          const folderResult = await this.getWccClient().createFolder(
            args.parentFolderGUID,
            args.folderName,
            null, // fTargetGUID
            null, // ConflictResolutionMethod
            null  // isForceInheritSecurityForFolderCreation
          );
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
          const capabilities = await this.getWccClient().getDocumentCapabilities(args.dDocName, args.testedCapabilities);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(capabilities, null, 2),
              },
            ],
          };

        case 'delete-document':
          const deleteResult = await this.getWccClient().deleteDocument(args.dDocName, args.version);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(deleteResult, null, 2),
              },
            ],
          };

        case 'upload-document-revision':
          const revisionResult = await this.getWccClient().uploadDocumentRevision(args.dDocName, args.filePath, args.metadata);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(revisionResult, null, 2),
              },
            ],
          };

        case 'download-document-by-revision-id':
          const revisionStream = await this.getWccClient().downloadDocumentByRevisionId(args.dID, args.rendition);
          
          const revisionOutputDir = path.dirname(args.outputPath);
          if (!existsSync(revisionOutputDir)) {
            mkdirSync(revisionOutputDir, { recursive: true });
          }

          const revisionChunks = [];
          for await (const chunk of revisionStream) {
            revisionChunks.push(chunk);
          }
          const revisionBuffer = Buffer.concat(revisionChunks);
          writeFileSync(args.outputPath, revisionBuffer);

          return {
            content: [
              {
                type: 'text',
                text: `Document downloaded successfully to: ${args.outputPath}`,
              },
            ],
          };

        case 'update-document-by-revision-id':
          const updateByIdResult = await this.getWccClient().updateDocumentByRevisionId(
            args.dID,
            args.metadata,
            args.createPrimaryMetaFile,
            args.createAlternateMetaFile
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(updateByIdResult, null, 2),
              },
            ],
          };

        case 'resubmit-conversion':
          const resubmitResult = await this.getWccClient().resubmitConversion(
            args.dDocName,
            args.version,
            args.alwaysResubmit
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(resubmitResult, null, 2),
              },
            ],
          };

        case 'resubmit-conversion-by-revision-id':
          const resubmitByIdResult = await this.getWccClient().resubmitConversionByRevisionId(args.dID);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(resubmitByIdResult, null, 2),
              },
            ],
          };

        case 'update-storage-tier':
          const storageResult = await this.getWccClient().updateStorageTier(
            args.dDocName,
            args.storageTier,
            args.version
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(storageResult, null, 2),
              },
            ],
          };

        case 'update-storage-tier-by-revision-id':
          const storageByIdResult = await this.getWccClient().updateStorageTierByRevisionId(
            args.dID,
            args.storageTier
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(storageByIdResult, null, 2),
              },
            ],
          };

        case 'restore-from-archive':
          const restoreResult = await this.getWccClient().restoreFromArchive(
            args.dDocName,
            args.version,
            args.hours
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(restoreResult, null, 2),
              },
            ],
          };

        case 'restore-from-archive-by-revision-id':
          const restoreByIdResult = await this.getWccClient().restoreFromArchiveByRevisionId(
            args.dID,
            args.hours
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(restoreByIdResult, null, 2),
              },
            ],
          };

        case 'delete-folder':
          const deleteFolderResult = await this.getWccClient().deleteFolder(args.fFolderGUID);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(deleteFolderResult, null, 2),
              },
            ],
          };

        case 'get-folder-file-info':
          const folderFileInfo = await this.getWccClient().getFolderFileInfo(args.fFileGUID);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(folderFileInfo, null, 2),
              },
            ],
          };

        case 'delete-folder-file':
          const deleteFolderFileResult = await this.getWccClient().deleteFolderFile(args.fFileGUID);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(deleteFolderFileResult, null, 2),
              },
            ],
          };

        case 'create-file-link':
          const fileLinkResult = await this.getWccClient().createFileLink(
            args.fFolderGUID,
            args.dDocName,
            args.fFileType,
            args.ConflictResolutionMethod
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(fileLinkResult, null, 2),
              },
            ],
          };

        case 'get-folder-capabilities':
          const folderCapabilities = await this.getWccClient().getFolderCapabilities(
            args.fFolderGUID,
            args.testedCapabilities
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(folderCapabilities, null, 2),
              },
            ],
          };

        case 'create-public-link-for-file':
          const publicLinkFileResult = await this.getWccClient().createPublicLinkForFile(
            args.fFileGUID,
            args.publicLinkData
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(publicLinkFileResult, null, 2),
              },
            ],
          };

        case 'get-public-links-for-file':
          const publicLinksFile = await this.getWccClient().getPublicLinksForFile(
            args.fFileGUID,
            args.offset,
            args.limit
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(publicLinksFile, null, 2),
              },
            ],
          };

        case 'create-public-link-for-folder':
          const publicLinkFolderResult = await this.getWccClient().createPublicLinkForFolder(
            args.fFolderGUID,
            args.publicLinkData
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(publicLinkFolderResult, null, 2),
              },
            ],
          };

        case 'get-public-links-for-folder':
          const publicLinksFolder = await this.getWccClient().getPublicLinksForFolder(
            args.fFolderGUID,
            args.offset,
            args.limit
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(publicLinksFolder, null, 2),
              },
            ],
          };

        case 'get-public-link-info':
          const publicLinkInfo = await this.getWccClient().getPublicLinkInfo(args.dLinkID);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(publicLinkInfo, null, 2),
              },
            ],
          };

        case 'create-application-link':
          const appLinkResult = await this.getWccClient().createApplicationLink(
            args.fFolderGUID,
            args.applicationLinkData
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(appLinkResult, null, 2),
              },
            ],
          };

        case 'get-application-links-for-folder':
          const appLinksFolder = await this.getWccClient().getApplicationLinksForFolder(
            args.fFolderGUID,
            args.offset,
            args.limit
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(appLinksFolder, null, 2),
              },
            ],
          };

        case 'get-application-link-info':
          const appLinkInfo = await this.getWccClient().getApplicationLinkInfo(args.dAppLinkID);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(appLinkInfo, null, 2),
              },
            ],
          };

        case 'delete-application-link':
          const deleteAppLinkResult = await this.getWccClient().deleteApplicationLink(args.dAppLinkID);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(deleteAppLinkResult, null, 2),
              },
            ],
          };

        case 'refresh-application-link-token':
          const refreshTokenResult = await this.getWccClient().refreshApplicationLinkToken(
            args.dAppLinkID,
            args.refreshData
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(refreshTokenResult, null, 2),
              },
            ],
          };

        case 'start-bulk-delete-job':
          const bulkDeleteResult = await this.getWccClient().startBulkDeleteJob(args.jobRequest);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(bulkDeleteResult, null, 2),
              },
            ],
          };

        case 'start-bulk-download-job':
          const bulkDownloadResult = await this.getWccClient().startBulkDownloadJob(args.jobRequest);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(bulkDownloadResult, null, 2),
              },
            ],
          };

        case 'start-bulk-add-category-job':
          const bulkAddCategoryResult = await this.getWccClient().startBulkAddCategoryJob(args.jobRequest);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(bulkAddCategoryResult, null, 2),
              },
            ],
          };

        case 'start-bulk-remove-category-job':
          const bulkRemoveCategoryResult = await this.getWccClient().startBulkRemoveCategoryJob(args.jobRequest);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(bulkRemoveCategoryResult, null, 2),
              },
            ],
          };

        case 'cancel-background-job':
          const cancelJobResult = await this.getWccClient().cancelBackgroundJob(args.dJobID);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(cancelJobResult, null, 2),
              },
            ],
          };

        case 'get-background-job-status':
          const jobStatus = await this.getWccClient().getBackgroundJobStatus(args.dJobID);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(jobStatus, null, 2),
              },
            ],
          };

        case 'download-background-job-package':
          const packageStream = await this.getWccClient().downloadBackgroundJobPackage(args.dJobID);
          
          const packageDir = path.dirname(args.outputPath);
          if (!existsSync(packageDir)) {
            mkdirSync(packageDir, { recursive: true });
          }

          const packageChunks = [];
          for await (const chunk of packageStream) {
            packageChunks.push(chunk);
          }
          const packageBuffer = Buffer.concat(packageChunks);
          writeFileSync(args.outputPath, packageBuffer);

          return {
            content: [
              {
                type: 'text',
                text: `Package downloaded successfully to: ${args.outputPath}`,
              },
            ],
          };

        case 'create-taxonomy':
          const taxonomyResult = await this.getWccClient().createTaxonomy(args.taxonomyData);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(taxonomyResult, null, 2),
              },
            ],
          };

        case 'get-taxonomy':
          const taxonomyInfo = await this.getWccClient().getTaxonomy(args.dTaxonomyGUID);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(taxonomyInfo, null, 2),
              },
            ],
          };

        case 'update-taxonomy':
          const updateTaxonomyResult = await this.getWccClient().updateTaxonomy(
            args.dTaxonomyGUID,
            args.taxonomyData
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(updateTaxonomyResult, null, 2),
              },
            ],
          };

        case 'get-document-types':
          const docTypes = await this.getWccClient().getDocumentTypes();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(docTypes, null, 2),
              },
            ],
          };

        case 'get-document-config-info':
          const configInfo = await this.getWccClient().getDocumentConfigInfo(
            args.rowLimit,
            args.includeResultSets
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(configInfo, null, 2),
              },
            ],
          };

        case 'get-document-meta-info':
          const metaInfo = await this.getWccClient().getDocumentMetaInfo();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(metaInfo, null, 2),
              },
            ],
          };

        case 'query-data-source':
          const dataSourceResult = await this.getWccClient().queryDataSource(
            args.dataSource,
            args.whereClause,
            args.orderClause,
            args.maxRows,
            args.startRow
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(dataSourceResult, null, 2),
              },
            ],
          };

        case 'create-workflow':
          const workflowResult = await this.getWccClient().createWorkflow(args.workflowData);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(workflowResult, null, 2),
              },
            ],
          };

        case 'get-workflow':
          const workflowInfo = await this.getWccClient().getWorkflow(args.dWfName);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(workflowInfo, null, 2),
              },
            ],
          };

        case 'update-workflow':
          const updateWorkflowResult = await this.getWccClient().updateWorkflow(
            args.dWfName,
            args.workflowData
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(updateWorkflowResult, null, 2),
              },
            ],
          };

        case 'approve-workflow':
          const approveResult = await this.getWccClient().approveWorkflow(args.dDocName);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(approveResult, null, 2),
              },
            ],
          };

        case 'reject-workflow':
          const rejectResult = await this.getWccClient().rejectWorkflow(
            args.dDocName,
            args.rejectMessage
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(rejectResult, null, 2),
              },
            ],
          };

        case 'add-attachment':
          const attachmentResult = await this.getWccClient().addAttachment(
            args.dDocName,
            args.extRenditionName,
            args.filePath,
            args.extRenditionDescription,
            args.version
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(attachmentResult, null, 2),
              },
            ],
          };

        case 'get-attachments':
          const attachments = await this.getWccClient().getAttachments(args.dDocName);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(attachments, null, 2),
              },
            ],
          };

        case 'download-attachment':
          const attachmentStream = await this.getWccClient().downloadAttachment(
            args.dDocName,
            args.extRenditionName
          );
          
          const attachmentDir = path.dirname(args.outputPath);
          if (!existsSync(attachmentDir)) {
            mkdirSync(attachmentDir, { recursive: true });
          }

          const attachmentChunks = [];
          for await (const chunk of attachmentStream) {
            attachmentChunks.push(chunk);
          }
          const attachmentBuffer = Buffer.concat(attachmentChunks);
          writeFileSync(args.outputPath, attachmentBuffer);

          return {
            content: [
              {
                type: 'text',
                text: `Attachment downloaded successfully to: ${args.outputPath}`,
              },
            ],
          };

        case 'delete-attachment':
          const deleteAttachmentResult = await this.getWccClient().deleteAttachment(
            args.dDocName,
            args.extRenditionName
          );
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(deleteAttachmentResult, null, 2),
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
                version: {
                  type: 'string',
                  description: 'Document version (optional)',
                },
                createPrimaryMetaFile: {
                  type: 'boolean',
                  description: 'Create primary meta file (optional)',
                },
                createAlternateMetaFile: {
                  type: 'boolean',
                  description: 'Create alternate meta file (optional)',
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
              args.metadata,
              args.version,
              args.createPrimaryMetaFile,
              args.createAlternateMetaFile
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
            const capabilities = await this.getWccClient().getDocumentCapabilities(args.dDocName, args.testedCapabilities);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(capabilities, null, 2),
                },
              ],
            };

          case 'delete-document':
            const deleteResult = await this.getWccClient().deleteDocument(args.dDocName, args.version);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(deleteResult, null, 2),
                },
              ],
            };

          case 'upload-document-revision':
            const revisionResult = await this.getWccClient().uploadDocumentRevision(args.dDocName, args.filePath, args.metadata);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(revisionResult, null, 2),
                },
              ],
            };

          case 'download-document-by-revision-id':
            const revisionStream = await this.getWccClient().downloadDocumentByRevisionId(args.dID, args.rendition);
            
            const revisionOutputDir = path.dirname(args.outputPath);
            if (!existsSync(revisionOutputDir)) {
              mkdirSync(revisionOutputDir, { recursive: true });
            }

            const revisionChunks = [];
            for await (const chunk of revisionStream) {
              revisionChunks.push(chunk);
            }
            const revisionBuffer = Buffer.concat(revisionChunks);
            writeFileSync(args.outputPath, revisionBuffer);

            return {
              content: [
                {
                  type: 'text',
                  text: `Document downloaded successfully to: ${args.outputPath}`,
                },
              ],
            };

          case 'update-document-by-revision-id':
            const updateByIdResult = await this.getWccClient().updateDocumentByRevisionId(
              args.dID,
              args.metadata,
              args.createPrimaryMetaFile,
              args.createAlternateMetaFile
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(updateByIdResult, null, 2),
                },
              ],
            };

          case 'resubmit-conversion':
            const resubmitResult = await this.getWccClient().resubmitConversion(
              args.dDocName,
              args.version,
              args.alwaysResubmit
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(resubmitResult, null, 2),
                },
              ],
            };

          case 'resubmit-conversion-by-revision-id':
            const resubmitByIdResult = await this.getWccClient().resubmitConversionByRevisionId(args.dID);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(resubmitByIdResult, null, 2),
                },
              ],
            };

          case 'update-storage-tier':
            const storageResult = await this.getWccClient().updateStorageTier(
              args.dDocName,
              args.storageTier,
              args.version
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(storageResult, null, 2),
                },
              ],
            };

          case 'update-storage-tier-by-revision-id':
            const storageByIdResult = await this.getWccClient().updateStorageTierByRevisionId(
              args.dID,
              args.storageTier
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(storageByIdResult, null, 2),
                },
              ],
            };

          case 'restore-from-archive':
            const restoreResult = await this.getWccClient().restoreFromArchive(
              args.dDocName,
              args.version,
              args.hours
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(restoreResult, null, 2),
                },
              ],
            };

          case 'restore-from-archive-by-revision-id':
            const restoreByIdResult = await this.getWccClient().restoreFromArchiveByRevisionId(
              args.dID,
              args.hours
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(restoreByIdResult, null, 2),
                },
              ],
            };

          case 'delete-folder':
            const deleteFolderResult = await this.getWccClient().deleteFolder(args.fFolderGUID);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(deleteFolderResult, null, 2),
                },
              ],
            };

          case 'get-folder-file-info':
            const folderFileInfo = await this.getWccClient().getFolderFileInfo(args.fFileGUID);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(folderFileInfo, null, 2),
                },
              ],
            };

          case 'delete-folder-file':
            const deleteFolderFileResult = await this.getWccClient().deleteFolderFile(args.fFileGUID);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(deleteFolderFileResult, null, 2),
                },
              ],
            };

          case 'create-file-link':
            const fileLinkResult = await this.getWccClient().createFileLink(
              args.fFolderGUID,
              args.dDocName,
              args.fFileType,
              args.ConflictResolutionMethod
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(fileLinkResult, null, 2),
                },
              ],
            };

          case 'get-folder-capabilities':
            const folderCapabilities = await this.getWccClient().getFolderCapabilities(
              args.fFolderGUID,
              args.testedCapabilities
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(folderCapabilities, null, 2),
                },
              ],
            };

          case 'create-public-link-for-file':
            const publicLinkFileResult = await this.getWccClient().createPublicLinkForFile(
              args.fFileGUID,
              args.publicLinkData
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(publicLinkFileResult, null, 2),
                },
              ],
            };

          case 'get-public-links-for-file':
            const publicLinksFile = await this.getWccClient().getPublicLinksForFile(
              args.fFileGUID,
              args.offset,
              args.limit
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(publicLinksFile, null, 2),
                },
              ],
            };

          case 'create-public-link-for-folder':
            const publicLinkFolderResult = await this.getWccClient().createPublicLinkForFolder(
              args.fFolderGUID,
              args.publicLinkData
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(publicLinkFolderResult, null, 2),
                },
              ],
            };

          case 'get-public-links-for-folder':
            const publicLinksFolder = await this.getWccClient().getPublicLinksForFolder(
              args.fFolderGUID,
              args.offset,
              args.limit
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(publicLinksFolder, null, 2),
                },
              ],
            };

          case 'get-public-link-info':
            const publicLinkInfo = await this.getWccClient().getPublicLinkInfo(args.dLinkID);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(publicLinkInfo, null, 2),
                },
              ],
            };

          case 'create-application-link':
            const appLinkResult = await this.getWccClient().createApplicationLink(
              args.fFolderGUID,
              args.applicationLinkData
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(appLinkResult, null, 2),
                },
              ],
            };

          case 'get-application-links-for-folder':
            const appLinksFolder = await this.getWccClient().getApplicationLinksForFolder(
              args.fFolderGUID,
              args.offset,
              args.limit
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(appLinksFolder, null, 2),
                },
              ],
            };

          case 'get-application-link-info':
            const appLinkInfo = await this.getWccClient().getApplicationLinkInfo(args.dAppLinkID);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(appLinkInfo, null, 2),
                },
              ],
            };

          case 'delete-application-link':
            const deleteAppLinkResult = await this.getWccClient().deleteApplicationLink(args.dAppLinkID);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(deleteAppLinkResult, null, 2),
                },
              ],
            };

          case 'refresh-application-link-token':
            const refreshTokenResult = await this.getWccClient().refreshApplicationLinkToken(
              args.dAppLinkID,
              args.refreshData
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(refreshTokenResult, null, 2),
                },
              ],
            };

          case 'start-bulk-delete-job':
            const bulkDeleteResult = await this.getWccClient().startBulkDeleteJob(args.jobRequest);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(bulkDeleteResult, null, 2),
                },
              ],
            };

          case 'start-bulk-download-job':
            const bulkDownloadResult = await this.getWccClient().startBulkDownloadJob(args.jobRequest);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(bulkDownloadResult, null, 2),
                },
              ],
            };

          case 'start-bulk-add-category-job':
            const bulkAddCategoryResult = await this.getWccClient().startBulkAddCategoryJob(args.jobRequest);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(bulkAddCategoryResult, null, 2),
                },
              ],
            };

          case 'start-bulk-remove-category-job':
            const bulkRemoveCategoryResult = await this.getWccClient().startBulkRemoveCategoryJob(args.jobRequest);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(bulkRemoveCategoryResult, null, 2),
                },
              ],
            };

          case 'cancel-background-job':
            const cancelJobResult = await this.getWccClient().cancelBackgroundJob(args.dJobID);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(cancelJobResult, null, 2),
                },
              ],
            };

          case 'get-background-job-status':
            const jobStatus = await this.getWccClient().getBackgroundJobStatus(args.dJobID);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(jobStatus, null, 2),
                },
              ],
            };

          case 'download-background-job-package':
            const packageStream = await this.getWccClient().downloadBackgroundJobPackage(args.dJobID);
            
            const packageOutputDir = path.dirname(args.outputPath);
            if (!existsSync(packageOutputDir)) {
              mkdirSync(packageOutputDir, { recursive: true });
            }

            const packageChunks = [];
            for await (const chunk of packageStream) {
              packageChunks.push(chunk);
            }
            const packageBuffer = Buffer.concat(packageChunks);
            writeFileSync(args.outputPath, packageBuffer);

            return {
              content: [
                {
                  type: 'text',
                  text: `Package downloaded successfully to: ${args.outputPath}`,
                },
              ],
            };

          case 'create-taxonomy':
            const taxonomyResult = await this.getWccClient().createTaxonomy(args.taxonomyData);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(taxonomyResult, null, 2),
                },
              ],
            };

          case 'get-taxonomy':
            const taxonomyInfo = await this.getWccClient().getTaxonomy(args.dTaxonomyGUID);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(taxonomyInfo, null, 2),
                },
              ],
            };

          case 'update-taxonomy':
            const updateTaxonomyResult = await this.getWccClient().updateTaxonomy(
              args.dTaxonomyGUID,
              args.taxonomyData
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(updateTaxonomyResult, null, 2),
                },
              ],
            };

          case 'get-document-types':
            const docTypes = await this.getWccClient().getDocumentTypes();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(docTypes, null, 2),
                },
              ],
            };

          case 'get-document-config-info':
            const configInfo = await this.getWccClient().getDocumentConfigInfo(
              args.rowLimit,
              args.includeResultSets
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(configInfo, null, 2),
                },
              ],
            };

          case 'get-document-meta-info':
            const metaInfo = await this.getWccClient().getDocumentMetaInfo();
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(metaInfo, null, 2),
                },
              ],
            };

          case 'query-data-source':
            const dataSourceResult = await this.getWccClient().queryDataSource(
              args.dataSource,
              args.whereClause,
              args.orderClause,
              args.maxRows,
              args.startRow
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(dataSourceResult, null, 2),
                },
              ],
            };

          case 'create-workflow':
            const workflowResult = await this.getWccClient().createWorkflow(args.workflowData);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(workflowResult, null, 2),
                },
              ],
            };

          case 'get-workflow':
            const workflowInfo = await this.getWccClient().getWorkflow(args.dWfName);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(workflowInfo, null, 2),
                },
              ],
            };

          case 'update-workflow':
            const updateWorkflowResult = await this.getWccClient().updateWorkflow(
              args.dWfName,
              args.workflowData
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(updateWorkflowResult, null, 2),
                },
              ],
            };

          case 'approve-workflow':
            const approveResult = await this.getWccClient().approveWorkflow(args.dDocName);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(approveResult, null, 2),
                },
              ],
            };

          case 'reject-workflow':
            const rejectResult = await this.getWccClient().rejectWorkflow(
              args.dDocName,
              args.rejectMessage
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(rejectResult, null, 2),
                },
              ],
            };

          case 'add-attachment':
            const attachmentResult = await this.getWccClient().addAttachment(
              args.dDocName,
              args.extRenditionName,
              args.filePath,
              args.extRenditionDescription,
              args.version
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(attachmentResult, null, 2),
                },
              ],
            };

          case 'get-attachments':
            const attachments = await this.getWccClient().getAttachments(args.dDocName);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(attachments, null, 2),
                },
              ],
            };

          case 'download-attachment':
            const attachmentStream = await this.getWccClient().downloadAttachment(
              args.dDocName,
              args.extRenditionName
            );
            
            const attachmentOutputDir = path.dirname(args.outputPath);
            if (!existsSync(attachmentOutputDir)) {
              mkdirSync(attachmentOutputDir, { recursive: true });
            }

            const attachmentChunks = [];
            for await (const chunk of attachmentStream) {
              attachmentChunks.push(chunk);
            }
            const attachmentBuffer = Buffer.concat(attachmentChunks);
            writeFileSync(args.outputPath, attachmentBuffer);

            return {
              content: [
                {
                  type: 'text',
                  text: `Attachment downloaded successfully to: ${args.outputPath}`,
                },
              ],
            };

          case 'delete-attachment':
            const deleteAttachmentResult = await this.getWccClient().deleteAttachment(
              args.dDocName,
              args.extRenditionName
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(deleteAttachmentResult, null, 2),
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