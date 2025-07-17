# WebCenter Content MCP Server - Endpoint Documentation

This document provides comprehensive documentation for all 56 MCP tools available in the WebCenter Content MCP Server, covering the complete Oracle WebCenter Content REST API v1.1 specification.

## Tool Categories

- [Document Management](#document-management)
- [Storage Management](#storage-management)
- [Folder Operations](#folder-operations)
- [Public Link Management](#public-link-management)
- [Application Link Management](#application-link-management)
- [Background Job Management](#background-job-management)
- [Taxonomy Management](#taxonomy-management)
- [System Operations](#system-operations)
- [Workflow Management](#workflow-management)
- [Attachment Management](#attachment-management)

---

## Document Management

### search-documents
**Description**: Search for documents in WebCenter Content
**Parameters**:
- `query` (required): Search query string
- `limit` (optional): Maximum number of results (default: 10)
- `orderBy` (optional): Sort order (e.g., "dInDate desc")

### get-document-metadata
**Description**: Get metadata for a specific document
**Parameters**:
- `dDocName` (required): Document name (dDocName)

### download-document
**Description**: Download a document from WebCenter Content
**Parameters**:
- `dDocName` (required): Document name (dDocName)
- `version` (optional): Document version
- `rendition` (optional): Rendition type (primary, alternate, web, rendition:T)
- `outputPath` (required): Local path to save the downloaded file

### download-document-by-revision-id
**Description**: Download document by specific revision ID
**Parameters**:
- `dID` (required): Document revision ID
- `rendition` (optional): Rendition type
- `outputPath` (required): Local path to save the downloaded file

### update-document-metadata
**Description**: Update metadata for a document with versioning support
**Parameters**:
- `dDocName` (required): Document name (dDocName)
- `metadata` (required): Metadata values to update
- `version` (optional): Document version
- `createPrimaryMetaFile` (optional): Create primary meta file
- `createAlternateMetaFile` (optional): Create alternate meta file

### update-document-by-revision-id
**Description**: Update document by specific revision ID
**Parameters**:
- `dID` (required): Document revision ID
- `metadata` (required): Updated metadata
- `createPrimaryMetaFile` (optional): Create primary meta file
- `createAlternateMetaFile` (optional): Create alternate meta file

### delete-document
**Description**: Delete a document from WebCenter Content
**Parameters**:
- `dDocName` (required): Document name (dDocName)
- `version` (optional): Document version

### upload-document-revision
**Description**: Upload a new revision of an existing document
**Parameters**:
- `dDocName` (required): Document name (dDocName)
- `filePath` (required): Path to the file to upload
- `metadata` (required): Document metadata

### checkout-document
**Description**: Checkout a document for editing
**Parameters**:
- `dDocName` (required): Document name (dDocName)

### reverse-checkout
**Description**: Reverse checkout (undo checkout) of a document
**Parameters**:
- `dDocName` (required): Document name (dDocName)

### get-document-capabilities
**Description**: Get capabilities/permissions for a document
**Parameters**:
- `dDocName` (required): Document name (dDocName)
- `testedCapabilities` (required): Comma-separated list of capabilities to test

### resubmit-conversion
**Description**: Resubmit failed conversion for a document
**Parameters**:
- `dDocName` (required): Document name (dDocName)
- `version` (optional): Document version
- `alwaysResubmit` (optional): Always resubmit flag

### resubmit-conversion-by-revision-id
**Description**: Resubmit failed conversion by revision ID
**Parameters**:
- `dID` (required): Document revision ID

---

## Storage Management

### update-storage-tier
**Description**: Change storage tier for a document
**Parameters**:
- `dDocName` (required): Document name (dDocName)
- `storageTier` (required): Storage tier
- `version` (optional): Document version

### update-storage-tier-by-revision-id
**Description**: Change storage tier by revision ID
**Parameters**:
- `dID` (required): Document revision ID
- `storageTier` (required): Storage tier

### restore-from-archive
**Description**: Restore document from archive
**Parameters**:
- `dDocName` (required): Document name (dDocName)
- `version` (optional): Document version
- `hours` (optional): Hours to restore for

### restore-from-archive-by-revision-id
**Description**: Restore document from archive by revision ID
**Parameters**:
- `dID` (required): Document revision ID
- `hours` (optional): Hours to restore for

---

## Folder Operations

### create-folder
**Description**: Create a new folder in WebCenter Content
**Parameters**:
- `folderName` (required): Name of the folder to create
- `parentFolderGUID` (optional): Parent folder GUID
- `description` (optional): Folder description

### delete-folder
**Description**: Delete a folder
**Parameters**:
- `fFolderGUID` (required): Folder GUID

### get-folder-info
**Description**: Get information about a specific folder
**Parameters**:
- `fFolderGUID` (required): Folder GUID

### get-folder-file-info
**Description**: Get file info in folder
**Parameters**:
- `fFileGUID` (required): File GUID

### delete-folder-file
**Description**: Delete file in folder
**Parameters**:
- `fFileGUID` (required): File GUID

### search-in-folder
**Description**: Search for items within a specific folder
**Parameters**:
- `fFolderGUID` (required): Folder GUID to search within
- `query` (optional): Search query
- `limit` (optional): Maximum number of results (default: 10)

### create-file-link
**Description**: Create file link in folder
**Parameters**:
- `fFolderGUID` (required): Folder GUID
- `dDocName` (required): Document name
- `fFileType` (optional): File type
- `ConflictResolutionMethod` (optional): Conflict resolution method

### get-folder-capabilities
**Description**: Test folder capabilities
**Parameters**:
- `fFolderGUID` (required): Folder GUID
- `testedCapabilities` (required): Comma-separated list of capabilities to test

---

## Public Link Management

### create-public-link-for-file
**Description**: Create public link for file
**Parameters**:
- `fFileGUID` (required): File GUID
- `publicLinkData` (required): Public link data

### get-public-links-for-file
**Description**: List public links for file
**Parameters**:
- `fFileGUID` (required): File GUID
- `offset` (optional): Offset for pagination
- `limit` (optional): Limit for pagination

### create-public-link-for-folder
**Description**: Create public link for folder
**Parameters**:
- `fFolderGUID` (required): Folder GUID
- `publicLinkData` (required): Public link data

### get-public-links-for-folder
**Description**: List public links for folder
**Parameters**:
- `fFolderGUID` (required): Folder GUID
- `offset` (optional): Offset for pagination
- `limit` (optional): Limit for pagination

### get-public-link-info
**Description**: Get public link info
**Parameters**:
- `dLinkID` (required): Link ID

---

## Application Link Management

### create-application-link
**Description**: Create application link
**Parameters**:
- `fFolderGUID` (required): Folder GUID
- `applicationLinkData` (required): Application link data

### get-application-links-for-folder
**Description**: List application links for folder
**Parameters**:
- `fFolderGUID` (required): Folder GUID
- `offset` (optional): Offset for pagination
- `limit` (optional): Limit for pagination

### get-application-link-info
**Description**: Get application link info
**Parameters**:
- `dAppLinkID` (required): Application link ID

### delete-application-link
**Description**: Delete application link
**Parameters**:
- `dAppLinkID` (required): Application link ID

### refresh-application-link-token
**Description**: Refresh application link access token
**Parameters**:
- `dAppLinkID` (required): Application link ID
- `refreshData` (required): Refresh token data

---

## Background Job Management

### start-bulk-delete-job
**Description**: Start bulk delete job
**Parameters**:
- `jobRequest` (required): Job request data

### start-bulk-download-job
**Description**: Start bulk download job
**Parameters**:
- `jobRequest` (required): Job request data

### start-bulk-add-category-job
**Description**: Start bulk add category job
**Parameters**:
- `jobRequest` (required): Job request data

### start-bulk-remove-category-job
**Description**: Start bulk remove category job
**Parameters**:
- `jobRequest` (required): Job request data

### cancel-background-job
**Description**: Cancel a background job
**Parameters**:
- `dJobID` (required): Job ID

### get-background-job-status
**Description**: Get status of a background job
**Parameters**:
- `dJobID` (required): Job ID

### download-background-job-package
**Description**: Download background job package
**Parameters**:
- `dJobID` (required): Job ID
- `outputPath` (required): Local path to save the package

---

## Taxonomy Management

### create-taxonomy
**Description**: Create a taxonomy
**Parameters**:
- `taxonomyData` (required): Taxonomy creation data

### get-taxonomy
**Description**: Get a taxonomy
**Parameters**:
- `dTaxonomyGUID` (required): Taxonomy GUID

### update-taxonomy
**Description**: Update a taxonomy
**Parameters**:
- `dTaxonomyGUID` (required): Taxonomy GUID
- `taxonomyData` (required): Taxonomy update data

---

## System Operations

### get-document-types
**Description**: List document types
**Parameters**: None

### get-document-config-info
**Description**: Get configuration info
**Parameters**:
- `rowLimit` (optional): Row limit
- `includeResultSets` (optional): Include result sets

### get-document-meta-info
**Description**: Get metadata fields info
**Parameters**: None

### query-data-source
**Description**: Query data source
**Parameters**:
- `dataSource` (required): Data source name
- `whereClause` (optional): Where clause
- `orderClause` (optional): Order clause
- `maxRows` (optional): Maximum rows
- `startRow` (optional): Start row

---

## Workflow Management

### create-workflow
**Description**: Create a new workflow
**Parameters**:
- `workflowData` (required): Workflow data

### get-workflow
**Description**: Get workflow information
**Parameters**:
- `dWfName` (required): Workflow name

### update-workflow
**Description**: Edit workflow
**Parameters**:
- `dWfName` (required): Workflow name
- `workflowData` (required): Workflow update data

### approve-workflow
**Description**: Approve workflow for document
**Parameters**:
- `dDocName` (required): Document name

### reject-workflow
**Description**: Reject workflow for document
**Parameters**:
- `dDocName` (required): Document name
- `rejectMessage` (optional): Rejection message

---

## Attachment Management

### add-attachment
**Description**: Add attachment to document
**Parameters**:
- `dDocName` (required): Document name
- `extRenditionName` (required): External rendition name
- `filePath` (required): Path to attachment file
- `extRenditionDescription` (optional): External rendition description
- `version` (optional): Version

### get-attachments
**Description**: List attachments for document
**Parameters**:
- `dDocName` (required): Document name

### download-attachment
**Description**: Download attachment
**Parameters**:
- `dDocName` (required): Document name
- `extRenditionName` (required): External rendition name
- `outputPath` (required): Local path to save the attachment

### delete-attachment
**Description**: Delete attachment
**Parameters**:
- `dDocName` (required): Document name
- `extRenditionName` (required): External rendition name

---

## API Endpoint Mapping

This MCP server provides complete coverage of the Oracle WebCenter Content REST API v1.1 specification, including all 65+ documented endpoints across 9 major functional categories. Each MCP tool corresponds to one or more REST API endpoints, providing a comprehensive interface for WebCenter Content operations.

For detailed API specifications, refer to the Oracle WebCenter Content REST API documentation.