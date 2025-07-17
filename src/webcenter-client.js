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
          params: { query: '*', limit: 1 }
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
   * Search for documents globally
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchDocuments(query, options = {}) {
    const params = {
      query,
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
   * @returns {Promise<Object>} Update response
   */
  async updateDocumentMetadata(dDocName, metadata) {
    const response = await this.axiosInstance.patch(`/files/${dDocName}`, {
      metadataValues: metadata
    });
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
   * Get document capabilities
   * @param {string} dDocName - Document name
   * @returns {Promise<Object>} Document capabilities
   */
  async getDocumentCapabilities(dDocName) {
    const response = await this.axiosInstance.get(`/files/${dDocName}/capabilities`);
    return response.data;
  }
}