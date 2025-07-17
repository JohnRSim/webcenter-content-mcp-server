import axios from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';

export class WebCenterContentClient {
  constructor(baseUrl, username, password) {
    // Validate required parameters
    if (!baseUrl) {
      throw new Error('WebCenter Content base URL is required');
    }
    if (!username) {
      throw new Error('WebCenter Content username is required');
    }
    if (!password) {
      throw new Error('WebCenter Content password is required');
    }

    this.baseUrl = baseUrl;
    this.username = username;
    this.password = password;
    this.authToken = null;
    
    // Create axios instance with basic auth
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      auth: {
        username: username,
        password: password
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Test connection to WebCenter Content server
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    try {
      // Try a simple API call to test connectivity
      const response = await this.axiosInstance.get('/about');
      return {
        success: true,
        message: 'Connection successful',
        serverInfo: response.data
      };
    } catch (error) {
      // If /about doesn't exist, try a simple search
      try {
        const response = await this.axiosInstance.get('/files/search/items', {
          params: { q: '*', limit: 1 }
        });
        return {
          success: true,
          message: 'Connection successful (via search endpoint)',
          serverInfo: { status: 'Connected' }
        };
      } catch (searchError) {
        return {
          success: false,
          message: `Connection failed: ${error.message}`,
          error: error.response?.data || error.message
        };
      }
    }
  }

  /**
   * Upload a new document to WebCenter Content
   * @param {string} filePath - Path to the file to upload
   * @param {Object} metadata - Document metadata
   * @returns {Promise<Object>} Upload response
   */
  async uploadDocument(filePath, metadata) {
    const formData = new FormData();
    formData.append('primaryFile', createReadStream(filePath));
    formData.append('metadataValues', JSON.stringify(metadata));

    const response = await this.axiosInstance.post('/files/data', formData, {
      headers: {
        ...formData.getHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data;
  }

  /**
   * Download document content
   * @param {string} dDocName - Document name
   * @param {string} version - Document version (optional)
   * @param {string} rendition - Rendition type (optional)
   * @returns {Promise<Buffer>} File content
   */
  async downloadDocument(dDocName, version = null, rendition = null) {
    const params = {};
    if (version) params.version = version;
    if (rendition) params.rendition = rendition;

    const response = await this.axiosInstance.get(`/files/${dDocName}/data`, {
      params,
      responseType: 'stream'
    });

    return response.data;
  }

  /**
   * Build a properly formatted search query for WebCenter Content
   * @param {Object} querySpec - Query specification
   * @param {string} querySpec.text - Simple text to search for (optional)
   * @param {Object} querySpec.filters - Metadata filters (optional)
   * @returns {string} Formatted query string
   */
  buildSearchQuery(querySpec) {
    const { text, filters } = querySpec;
    let queryParts = [];
    
    // Add text search if provided
    if (text) {
      queryParts.push(`<qsch>${text}</qsch>`);
    }
    
    // Add metadata filters if provided
    if (filters && Object.keys(filters).length > 0) {
      const filterClauses = [];
      
      for (const [field, criteria] of Object.entries(filters)) {
        if (criteria.operator === 'contains') {
          filterClauses.push(`${field} <contains> \`${criteria.value}\``);
        } else if (criteria.operator === 'equals') {
          filterClauses.push(`${field} <equals> \`${criteria.value}\``);
        }
      }
      
      if (filterClauses.length > 0) {
        queryParts.push(filterClauses.join(' <AND> '));
      }
    }
    
    // Join all parts with AND
    return queryParts.join(' <AND> ');
  }

  /**
   * Search for documents globally
   * @param {string} query - Search query (use buildSearchQuery for complex queries)
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchDocuments(query, options = {}) {
    // Auto-format simple queries that aren't already formatted
    let formattedQuery = query;
    if (query && query !== '*' && !query.includes('<') && !query.includes('>')) {
      formattedQuery = `<qsch>${query}</qsch>`;
    }
    
    const params = {
      q: formattedQuery,
      ...options
    };
    
    const response = await this.axiosInstance.get('/files/search/items', { params });
    return response.data;
  }

  /**
   * Get document metadata
   * @param {string} dDocName - Document name
   * @returns {Promise<Object>} Document metadata
   */
  async getDocumentMetadata(dDocName) {
    const response = await this.axiosInstance.get(`/files/${dDocName}`);
    return response.data;
  }

  /**
   * Update document metadata
   * @param {string} dDocName - Document name
   * @param {Object} metadata - Updated metadata
   * @param {string} version - Document version (optional)
   * @param {boolean} createPrimaryMetaFile - Create primary meta file (optional)
   * @param {boolean} createAlternateMetaFile - Create alternate meta file (optional)
   * @returns {Promise<Object>} Update response
   */
  async updateDocumentMetadata(dDocName, metadata, version = null, createPrimaryMetaFile = null, createAlternateMetaFile = null) {
    const params = {};
    if (version) params.version = version;
    if (createPrimaryMetaFile !== null) params.createPrimaryMetaFile = createPrimaryMetaFile;
    if (createAlternateMetaFile !== null) params.createAlternateMetaFile = createAlternateMetaFile;

    const response = await this.axiosInstance.put(`/files/${dDocName}`, metadata, { params });
    return response.data;
  }

  /**
   * Create a new folder
   * @param {Object} folderData - Folder creation data
   * @returns {Promise<Object>} Folder creation response
   */
  async createFolder(folderData) {
    const response = await this.axiosInstance.post('/folders', folderData);
    return response.data;
  }

  /**
   * Get folder information
   * @param {string} fFolderGUID - Folder GUID
   * @returns {Promise<Object>} Folder information
   */
  async getFolderInfo(fFolderGUID) {
    const response = await this.axiosInstance.get(`/folders/${fFolderGUID}`);
    return response.data;
  }

  /**
   * Search within folders
   * @param {string} fFolderGUID - Folder GUID
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchInFolder(fFolderGUID, options = {}) {
    const params = {
      fFolderGUID,
      ...options
    };

    const response = await this.axiosInstance.get('/folders/search/items', { params });
    return response.data;
  }

  /**
   * List work in progress items
   * @param {Object} options - List options
   * @returns {Promise<Object>} Work in progress items
   */
  async listWorkInProgress(options = {}) {
    const response = await this.axiosInstance.get('/files/workInProgress/items', {
      params: options
    });
    return response.data;
  }

  /**
   * Checkout a document
   * @param {string} dDocName - Document name
   * @returns {Promise<Object>} Checkout response
   */
  async checkoutDocument(dDocName) {
    const response = await this.axiosInstance.post(`/files/${dDocName}/checkout`);
    return response.data;
  }

  /**
   * Reverse checkout (undo checkout)
   * @param {string} dDocName - Document name
   * @returns {Promise<Object>} Reverse checkout response
   */
  async reverseCheckout(dDocName) {
    const response = await this.axiosInstance.post(`/files/${dDocName}/reverseCheckout`);
    return response.data;
  }

  /**
   * Delete document
   * @param {string} dDocName - Document name
   * @param {string} version - Document version (optional)
   * @returns {Promise<Object>} Delete response
   */
  async deleteDocument(dDocName, version = null) {
    const params = {};
    if (version) params.version = version;

    const response = await this.axiosInstance.delete(`/files/${dDocName}`, { params });
    return response.data;
  }

  /**
   * Upload a new revision of a document
   * @param {string} dDocName - Document name
   * @param {string} filePath - Path to the file to upload
   * @param {Object} metadata - Document metadata
   * @returns {Promise<Object>} Upload response
   */
  async uploadDocumentRevision(dDocName, filePath, metadata) {
    const formData = new FormData();
    formData.append('primaryFile', createReadStream(filePath));
    formData.append('metadataValues', JSON.stringify(metadata));

    const response = await this.axiosInstance.post(`/files/${dDocName}/data`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data;
  }

  /**
   * Download document by revision ID
   * @param {string} dID - Document revision ID
   * @param {string} rendition - Rendition type (optional)
   * @returns {Promise<Buffer>} File content
   */
  async downloadDocumentByRevisionId(dID, rendition = null) {
    const params = {};
    if (rendition) params.rendition = rendition;

    const response = await this.axiosInstance.get(`/files/.by.did/${dID}/data`, {
      params,
      responseType: 'stream'
    });

    return response.data;
  }

  /**
   * Update document by revision ID
   * @param {string} dID - Document revision ID
   * @param {Object} metadata - Updated metadata
   * @param {boolean} createPrimaryMetaFile - Create primary meta file (optional)
   * @param {boolean} createAlternateMetaFile - Create alternate meta file (optional)
   * @returns {Promise<Object>} Update response
   */
  async updateDocumentByRevisionId(dID, metadata, createPrimaryMetaFile = null, createAlternateMetaFile = null) {
    const params = {};
    if (createPrimaryMetaFile !== null) params.createPrimaryMetaFile = createPrimaryMetaFile;
    if (createAlternateMetaFile !== null) params.createAlternateMetaFile = createAlternateMetaFile;

    const response = await this.axiosInstance.put(`/files/.by.did/${dID}`, metadata, { params });
    return response.data;
  }

  /**
   * Resubmit failed conversion
   * @param {string} dDocName - Document name
   * @param {string} version - Document version (optional)
   * @param {boolean} alwaysResubmit - Always resubmit flag (optional)
   * @returns {Promise<Object>} Resubmit response
   */
  async resubmitConversion(dDocName, version = null, alwaysResubmit = null) {
    const params = {};
    if (version) params.version = version;
    if (alwaysResubmit !== null) params.alwaysResubmit = alwaysResubmit;

    const response = await this.axiosInstance.post(`/files/${dDocName}/resubmitConversion`, null, { params });
    return response.data;
  }

  /**
   * Resubmit failed conversion by revision ID
   * @param {string} dID - Document revision ID
   * @returns {Promise<Object>} Resubmit response
   */
  async resubmitConversionByRevisionId(dID) {
    const response = await this.axiosInstance.post(`/files/.by.did/${dID}/resubmitConversion`);
    return response.data;
  }

  /**
   * Change storage tier
   * @param {string} dDocName - Document name
   * @param {string} storageTier - Storage tier
   * @param {string} version - Document version (optional)
   * @returns {Promise<Object>} Storage tier update response
   */
  async updateStorageTier(dDocName, storageTier, version = null) {
    const params = { storageTier };
    if (version) params.version = version;

    const response = await this.axiosInstance.post(`/files/${dDocName}/storage/.updateStorageTier`, null, { params });
    return response.data;
  }

  /**
   * Change storage tier by revision ID
   * @param {string} dID - Document revision ID
   * @param {string} storageTier - Storage tier
   * @returns {Promise<Object>} Storage tier update response
   */
  async updateStorageTierByRevisionId(dID, storageTier) {
    const params = { storageTier };

    const response = await this.axiosInstance.post(`/files/.by.did/${dID}/storage/.updateStorageTier`, null, { params });
    return response.data;
  }

  /**
   * Restore from archive
   * @param {string} dDocName - Document name
   * @param {string} version - Document version (optional)
   * @param {number} hours - Hours to restore for (optional)
   * @returns {Promise<Object>} Restore response
   */
  async restoreFromArchive(dDocName, version = null, hours = null) {
    const params = {};
    if (version) params.version = version;
    if (hours !== null) params.hours = hours;

    const response = await this.axiosInstance.post(`/files/${dDocName}/storage/.restoreFromArchive`, null, { params });
    return response.data;
  }

  /**
   * Restore from archive by revision ID
   * @param {string} dID - Document revision ID
   * @param {number} hours - Hours to restore for (optional)
   * @returns {Promise<Object>} Restore response
   */
  async restoreFromArchiveByRevisionId(dID, hours = null) {
    const params = {};
    if (hours !== null) params.hours = hours;

    const response = await this.axiosInstance.post(`/files/.by.did/${dID}/storage/.restoreFromArchive`, null, { params });
    return response.data;
  }

  /**
   * Checkout a document
   * @param {string} dDocName - Document name
   * @returns {Promise<Object>} Checkout response
   */
  async checkoutDocument(dDocName) {
    const response = await this.axiosInstance.post(`/files/${dDocName}/.checkout`);
    return response.data;
  }

  /**
   * Reverse checkout (undo checkout)
   * @param {string} dDocName - Document name
   * @returns {Promise<Object>} Reverse checkout response
   */
  async reverseCheckout(dDocName) {
    const response = await this.axiosInstance.post(`/files/${dDocName}/.undocheckout`);
    return response.data;
  }

  /**
   * Get document capabilities
   * @param {string} dDocName - Document name
   * @param {string} testedCapabilities - Comma-separated list of capabilities to test
   * @returns {Promise<Object>} Document capabilities
   */
  async getDocumentCapabilities(dDocName, testedCapabilities) {
    const params = { testedCapabilities };
    const response = await this.axiosInstance.get(`/files/${dDocName}/capabilities`, { params });
    return response.data;
  }

  // FOLDER OPERATIONS

  /**
   * Create a new folder
   * @param {string} fParentGUID - Parent folder GUID
   * @param {string} fFolderName - Folder name
   * @param {string} fTargetGUID - Target GUID for shortcut (optional)
   * @param {string} ConflictResolutionMethod - Conflict resolution method (optional)
   * @param {boolean} isForceInheritSecurityForFolderCreation - Force inherit security (optional)
   * @returns {Promise<Object>} Folder creation response
   */
  async createFolder(fParentGUID, fFolderName, fTargetGUID = null, ConflictResolutionMethod = null, isForceInheritSecurityForFolderCreation = null) {
    const params = { fParentGUID, fFolderName };
    if (fTargetGUID) params.fTargetGUID = fTargetGUID;
    if (ConflictResolutionMethod) params.ConflictResolutionMethod = ConflictResolutionMethod;
    if (isForceInheritSecurityForFolderCreation !== null) params.isForceInheritSecurityForFolderCreation = isForceInheritSecurityForFolderCreation;

    const response = await this.axiosInstance.post('/folders', null, { params });
    return response.data;
  }

  /**
   * Delete a folder
   * @param {string} fFolderGUID - Folder GUID
   * @returns {Promise<Object>} Delete response
   */
  async deleteFolder(fFolderGUID) {
    const response = await this.axiosInstance.delete(`/folders/${fFolderGUID}`);
    return response.data;
  }

  /**
   * Get file info in folder
   * @param {string} fFileGUID - File GUID
   * @returns {Promise<Object>} File information
   */
  async getFolderFileInfo(fFileGUID) {
    const response = await this.axiosInstance.get(`/folders/files/${fFileGUID}`);
    return response.data;
  }

  /**
   * Delete file in folder
   * @param {string} fFileGUID - File GUID
   * @returns {Promise<Object>} Delete response
   */
  async deleteFolderFile(fFileGUID) {
    const response = await this.axiosInstance.delete(`/folders/files/${fFileGUID}`);
    return response.data;
  }

  /**
   * Create file link
   * @param {string} fFolderGUID - Folder GUID
   * @param {string} dDocName - Document name
   * @param {string} fFileType - File type (optional)
   * @param {string} ConflictResolutionMethod - Conflict resolution method (optional)
   * @returns {Promise<Object>} File link creation response
   */
  async createFileLink(fFolderGUID, dDocName, fFileType = null, ConflictResolutionMethod = null) {
    const params = {};
    if (fFileType) params.fFileType = fFileType;
    if (ConflictResolutionMethod) params.ConflictResolutionMethod = ConflictResolutionMethod;

    const response = await this.axiosInstance.post(`/folders/${fFolderGUID}/${dDocName}/filelinks`, null, { params });
    return response.data;
  }

  /**
   * Test folder capabilities
   * @param {string} fFolderGUID - Folder GUID
   * @param {string} testedCapabilities - Comma-separated list of capabilities to test
   * @returns {Promise<Object>} Folder capabilities
   */
  async getFolderCapabilities(fFolderGUID, testedCapabilities) {
    const params = { testedCapabilities };
    const response = await this.axiosInstance.get(`/folders/${fFolderGUID}/capabilities`, { params });
    return response.data;
  }

  // PUBLIC LINKS

  /**
   * Create public link for file
   * @param {string} fFileGUID - File GUID
   * @param {Object} publicLinkData - Public link data
   * @returns {Promise<Object>} Public link creation response
   */
  async createPublicLinkForFile(fFileGUID, publicLinkData) {
    const response = await this.axiosInstance.post(`/publiclinks/.by.file/${fFileGUID}`, publicLinkData);
    return response.data;
  }

  /**
   * List public links for file
   * @param {string} fFileGUID - File GUID
   * @param {number} offset - Offset for pagination (optional)
   * @param {number} limit - Limit for pagination (optional)
   * @returns {Promise<Object>} Public links list
   */
  async getPublicLinksForFile(fFileGUID, offset = null, limit = null) {
    const params = {};
    if (offset !== null) params.offset = offset;
    if (limit !== null) params.limit = limit;

    const response = await this.axiosInstance.get(`/publiclinks/.by.file/${fFileGUID}`, { params });
    return response.data;
  }

  /**
   * Create public link for folder
   * @param {string} fFolderGUID - Folder GUID
   * @param {Object} publicLinkData - Public link data
   * @returns {Promise<Object>} Public link creation response
   */
  async createPublicLinkForFolder(fFolderGUID, publicLinkData) {
    const response = await this.axiosInstance.post(`/publiclinks/.by.folder/${fFolderGUID}`, publicLinkData);
    return response.data;
  }

  /**
   * List public links for folder
   * @param {string} fFolderGUID - Folder GUID
   * @param {number} offset - Offset for pagination (optional)
   * @param {number} limit - Limit for pagination (optional)
   * @returns {Promise<Object>} Public links list
   */
  async getPublicLinksForFolder(fFolderGUID, offset = null, limit = null) {
    const params = {};
    if (offset !== null) params.offset = offset;
    if (limit !== null) params.limit = limit;

    const response = await this.axiosInstance.get(`/publiclinks/.by.folder/${fFolderGUID}`, { params });
    return response.data;
  }

  /**
   * Get public link info
   * @param {string} dLinkID - Link ID
   * @returns {Promise<Object>} Public link information
   */
  async getPublicLinkInfo(dLinkID) {
    const response = await this.axiosInstance.get(`/publiclinks/${dLinkID}`);
    return response.data;
  }

  // APPLICATION LINKS

  /**
   * Create application link
   * @param {string} fFolderGUID - Folder GUID
   * @param {Object} applicationLinkData - Application link data
   * @returns {Promise<Object>} Application link creation response
   */
  async createApplicationLink(fFolderGUID, applicationLinkData) {
    const response = await this.axiosInstance.post(`/applinks/.by.folder/${fFolderGUID}`, applicationLinkData);
    return response.data;
  }

  /**
   * List application links for folder
   * @param {string} fFolderGUID - Folder GUID
   * @param {number} offset - Offset for pagination (optional)
   * @param {number} limit - Limit for pagination (optional)
   * @returns {Promise<Object>} Application links list
   */
  async getApplicationLinksForFolder(fFolderGUID, offset = null, limit = null) {
    const params = {};
    if (offset !== null) params.offset = offset;
    if (limit !== null) params.limit = limit;

    const response = await this.axiosInstance.get(`/applinks/.by.folder/${fFolderGUID}`, { params });
    return response.data;
  }

  /**
   * Get application link info
   * @param {string} dAppLinkID - Application link ID
   * @returns {Promise<Object>} Application link information
   */
  async getApplicationLinkInfo(dAppLinkID) {
    const response = await this.axiosInstance.get(`/applinks/${dAppLinkID}`);
    return response.data;
  }

  /**
   * Delete application link
   * @param {string} dAppLinkID - Application link ID
   * @returns {Promise<Object>} Delete response
   */
  async deleteApplicationLink(dAppLinkID) {
    const response = await this.axiosInstance.delete(`/applinks/${dAppLinkID}`);
    return response.data;
  }

  /**
   * Refresh application link access token
   * @param {string} dAppLinkID - Application link ID
   * @param {Object} refreshData - Refresh token data
   * @returns {Promise<Object>} Token refresh response
   */
  async refreshApplicationLinkToken(dAppLinkID, refreshData) {
    const response = await this.axiosInstance.post(`/applinks/${dAppLinkID}/.refreshAccessToken`, refreshData);
    return response.data;
  }

  // BACKGROUND JOBS

  /**
   * Start bulk delete job
   * @param {Object} jobRequest - Job request data
   * @returns {Promise<Object>} Job start response
   */
  async startBulkDeleteJob(jobRequest) {
    const response = await this.axiosInstance.post('/.bulk/.delete', jobRequest);
    return response.data;
  }

  /**
   * Start bulk download job
   * @param {Object} jobRequest - Job request data
   * @returns {Promise<Object>} Job start response
   */
  async startBulkDownloadJob(jobRequest) {
    const response = await this.axiosInstance.post('/.bulk/.download', jobRequest);
    return response.data;
  }

  /**
   * Start bulk add category job
   * @param {Object} jobRequest - Job request data
   * @returns {Promise<Object>} Job start response
   */
  async startBulkAddCategoryJob(jobRequest) {
    const response = await this.axiosInstance.post('/.bulk/categories/.add', jobRequest);
    return response.data;
  }

  /**
   * Start bulk remove category job
   * @param {Object} jobRequest - Job request data
   * @returns {Promise<Object>} Job start response
   */
  async startBulkRemoveCategoryJob(jobRequest) {
    const response = await this.axiosInstance.post('/.bulk/categories/.remove', jobRequest);
    return response.data;
  }

  /**
   * Cancel a background job
   * @param {string} dJobID - Job ID
   * @returns {Promise<Object>} Cancel response
   */
  async cancelBackgroundJob(dJobID) {
    const response = await this.axiosInstance.post(`/.bulk/${dJobID}/.cancel`);
    return response.data;
  }

  /**
   * Get status of a background job
   * @param {string} dJobID - Job ID
   * @returns {Promise<Object>} Job status
   */
  async getBackgroundJobStatus(dJobID) {
    const response = await this.axiosInstance.get(`/.bulk/${dJobID}`);
    return response.data;
  }

  /**
   * Download background job package
   * @param {string} dJobID - Job ID
   * @returns {Promise<Buffer>} Package content
   */
  async downloadBackgroundJobPackage(dJobID) {
    const response = await this.axiosInstance.get(`/.bulk/${dJobID}/package`, {
      responseType: 'stream'
    });
    return response.data;
  }

  // TAXONOMIES

  /**
   * Create a taxonomy
   * @param {Object} taxonomyData - Taxonomy creation data
   * @returns {Promise<Object>} Taxonomy creation response
   */
  async createTaxonomy(taxonomyData) {
    const response = await this.axiosInstance.post('/taxonomies', taxonomyData);
    return response.data;
  }

  /**
   * Get a taxonomy
   * @param {string} dTaxonomyGUID - Taxonomy GUID
   * @returns {Promise<Object>} Taxonomy information
   */
  async getTaxonomy(dTaxonomyGUID) {
    const response = await this.axiosInstance.get(`/taxonomies/${dTaxonomyGUID}`);
    return response.data;
  }

  /**
   * Update a taxonomy
   * @param {string} dTaxonomyGUID - Taxonomy GUID
   * @param {Object} taxonomyData - Taxonomy update data
   * @returns {Promise<Object>} Taxonomy update response
   */
  async updateTaxonomy(dTaxonomyGUID, taxonomyData) {
    const response = await this.axiosInstance.put(`/taxonomies/${dTaxonomyGUID}`, taxonomyData);
    return response.data;
  }

  // SYSTEM OPERATIONS

  /**
   * Create document profile
   * @param {FormData} profileData - Profile data as FormData
   * @returns {Promise<Object>} Profile creation response
   */
  async createDocumentProfile(profileData) {
    const response = await this.axiosInstance.post('/system/docProfiles', profileData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  /**
   * Get document profile
   * @param {string} dpName - Profile name
   * @returns {Promise<Object>} Profile information
   */
  async getDocumentProfile(dpName) {
    const response = await this.axiosInstance.get(`/system/docProfiles/${dpName}`);
    return response.data;
  }

  /**
   * Update document profile
   * @param {string} dpName - Profile name
   * @param {FormData} profileData - Profile data as FormData
   * @returns {Promise<Object>} Profile update response
   */
  async updateDocumentProfile(dpName, profileData) {
    const response = await this.axiosInstance.put(`/system/docProfiles/${dpName}`, profileData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  /**
   * Delete document profile
   * @param {string} dpName - Profile name
   * @returns {Promise<Object>} Delete response
   */
  async deleteDocumentProfile(dpName) {
    const response = await this.axiosInstance.delete(`/system/docProfiles/${dpName}`);
    return response.data;
  }

  /**
   * Query data source
   * @param {string} dataSource - Data source name
   * @param {string} whereClause - Where clause (optional)
   * @param {string} orderClause - Order clause (optional)
   * @param {number} maxRows - Maximum rows (optional)
   * @param {number} startRow - Start row (optional)
   * @returns {Promise<Object>} Query result
   */
  async queryDataSource(dataSource, whereClause = null, orderClause = null, maxRows = null, startRow = null) {
    const params = {};
    if (whereClause) params.whereClause = whereClause;
    if (orderClause) params.orderClause = orderClause;
    if (maxRows !== null) params.maxRows = maxRows;
    if (startRow !== null) params.startRow = startRow;

    const response = await this.axiosInstance.get(`/system/${dataSource}/items`, { params });
    return response.data;
  }

  /**
   * List document types
   * @returns {Promise<Object>} Document types list
   */
  async getDocumentTypes() {
    const response = await this.axiosInstance.get('/system/doctypes');
    return response.data;
  }

  /**
   * Create document type
   * @param {FormData} docTypeData - Document type data as FormData
   * @returns {Promise<Object>} Document type creation response
   */
  async createDocumentType(docTypeData) {
    const response = await this.axiosInstance.post('/system/doctypes', docTypeData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  /**
   * Update document type
   * @param {string} dDocType - Document type
   * @param {FormData} docTypeData - Document type data as FormData
   * @returns {Promise<Object>} Document type update response
   */
  async updateDocumentType(dDocType, docTypeData) {
    const response = await this.axiosInstance.put(`/system/doctypes/${dDocType}`, docTypeData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  /**
   * Delete document type
   * @param {string} dDocType - Document type
   * @returns {Promise<Object>} Delete response
   */
  async deleteDocumentType(dDocType) {
    const response = await this.axiosInstance.delete(`/system/doctypes/${dDocType}`);
    return response.data;
  }

  /**
   * Get configuration info
   * @param {number} rowLimit - Row limit (optional)
   * @param {string} includeResultSets - Include result sets (optional)
   * @returns {Promise<Object>} Configuration info
   */
  async getDocumentConfigInfo(rowLimit = null, includeResultSets = null) {
    const params = {};
    if (rowLimit !== null) params.rowLimit = rowLimit;
    if (includeResultSets) params.includeResultSets = includeResultSets;

    const response = await this.axiosInstance.get('/system/docConfigInfo', { params });
    return response.data;
  }

  /**
   * Get metadata fields info
   * @returns {Promise<Object>} Metadata info
   */
  async getDocumentMetaInfo() {
    const response = await this.axiosInstance.get('/system/docMetaInfo');
    return response.data;
  }

  // WORKFLOW OPERATIONS

  /**
   * Create a new workflow
   * @param {Object} workflowData - Workflow data
   * @returns {Promise<Object>} Workflow creation response
   */
  async createWorkflow(workflowData) {
    const formData = new FormData();
    Object.keys(workflowData).forEach(key => {
      formData.append(key, workflowData[key]);
    });

    const response = await this.axiosInstance.post('/workflow', formData, {
      headers: {
        ...formData.getHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  /**
   * Get workflow information
   * @param {string} dWfName - Workflow name
   * @returns {Promise<Object>} Workflow information
   */
  async getWorkflow(dWfName) {
    const response = await this.axiosInstance.get(`/workflows/${dWfName}`);
    return response.data;
  }

  /**
   * Edit workflow
   * @param {string} dWfName - Workflow name
   * @param {Object} workflowData - Workflow update data
   * @returns {Promise<Object>} Workflow update response
   */
  async updateWorkflow(dWfName, workflowData) {
    const response = await this.axiosInstance.put(`/workflows/${dWfName}`, workflowData);
    return response.data;
  }

  /**
   * Approve workflow for document
   * @param {string} dDocName - Document name
   * @returns {Promise<Object>} Workflow approval response
   */
  async approveWorkflow(dDocName) {
    const response = await this.axiosInstance.post(`/files/${dDocName}/workflow/.approve`);
    return response.data;
  }

  /**
   * Reject workflow for document
   * @param {string} dDocName - Document name
   * @param {string} rejectMessage - Rejection message (optional)
   * @returns {Promise<Object>} Workflow rejection response
   */
  async rejectWorkflow(dDocName, rejectMessage = null) {
    const params = {};
    if (rejectMessage) params.rejectMessage = rejectMessage;

    const response = await this.axiosInstance.post(`/files/${dDocName}/workflow/.reject`, null, { params });
    return response.data;
  }

  // ATTACHMENT OPERATIONS

  /**
   * Add attachment to document
   * @param {string} dDocName - Document name
   * @param {string} extRenditionName - External rendition name
   * @param {string} filePath - Path to attachment file
   * @param {string} extRenditionDescription - External rendition description (optional)
   * @param {string} version - Version (optional)
   * @returns {Promise<Object>} Attachment creation response
   */
  async addAttachment(dDocName, extRenditionName, filePath, extRenditionDescription = null, version = null) {
    const formData = new FormData();
    formData.append('extRenditionName', extRenditionName);
    formData.append('extRenditionFile', createReadStream(filePath));
    if (extRenditionDescription) formData.append('extRenditionDescription', extRenditionDescription);
    if (version) formData.append('version', version);

    const response = await this.axiosInstance.post(`/files/${dDocName}/attachments/data`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  /**
   * List attachments for document
   * @param {string} dDocName - Document name
   * @returns {Promise<Object>} Attachments list
   */
  async getAttachments(dDocName) {
    const response = await this.axiosInstance.get(`/files/${dDocName}/attachments/`);
    return response.data;
  }

  /**
   * Download attachment
   * @param {string} dDocName - Document name
   * @param {string} extRenditionName - External rendition name
   * @returns {Promise<Buffer>} Attachment content
   */
  async downloadAttachment(dDocName, extRenditionName) {
    const response = await this.axiosInstance.get(`/files/${dDocName}/attachments/${extRenditionName}/data`, {
      responseType: 'stream'
    });
    return response.data;
  }

  /**
   * Delete attachment
   * @param {string} dDocName - Document name
   * @param {string} extRenditionName - External rendition name
   * @returns {Promise<Object>} Delete response
   */
  async deleteAttachment(dDocName, extRenditionName) {
    const response = await this.axiosInstance.delete(`/files/${dDocName}/attachments/${extRenditionName}`);
    return response.data;
  }
}