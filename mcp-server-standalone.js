#!/usr/bin/env node

// Standalone MCP server launcher for WebCenter Content
// This script can be used directly with Claude Desktop or other MCP clients

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the actual MCP server
const serverPath = path.join(__dirname, 'src', 'mcp-server.js');

// Spawn the MCP server with stdio inheritance for proper MCP protocol handling
const serverProcess = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: process.env
});

// Exit with the same code as the server
serverProcess.on('close', (code) => {
  process.exit(code || 0);
});

serverProcess.on('error', (error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});

// Handle signals
process.on('SIGINT', () => {
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  serverProcess.kill('SIGTERM');
});