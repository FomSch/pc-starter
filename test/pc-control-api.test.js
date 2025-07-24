import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { exec } from 'child_process';

// Import WebServer class
const WebServer = require('../webserver.js');

describe('PC Control API Endpoints', () => {
  let app;
  let webServer;
  let mockDatabase;
  let mockMonitor;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create mock database and monitor
    mockDatabase = {
      getTemperatureData: vi.fn(),
      getTemperatureStats: vi.fn(),
      exportToCSV: vi.fn()
    };
    
    mockMonitor = {
      getCPUTemp: vi.fn(),
      getTempStatus: vi.fn(),
      getSystemStats: vi.fn()
    };
    
    // Create WebServer instance
    webServer = new WebServer(mockDatabase, mockMonitor);
    app = webServer.app;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/pc/start', () => {
    it('should successfully execute PC start command', async () => {
      // Mock successful execution
      mockExec(null, 'PC start initiated', '');
      
      const response = await request(app)
        .post('/api/pc/start')
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        message: 'PC start command executed successfully',
        timestamp: expect.any(String),
        status: 'starting'
      });
      
      // Verify exec was called with correct script
      expect(exec).toHaveBeenCalledWith(
        'bash "/test/shellscripts/post.sh"',
        { timeout: 30000 },
        expect.any(Function)
      );
    });

    it('should handle script execution timeout', async () => {
      // Mock timeout error
      mockExecTimeout();
      
      const response = await request(app)
        .post('/api/pc/start')
        .expect(408);
      
      expect(response.body).toEqual({
        success: false,
        message: 'PC start command timed out after 30 seconds',
        timestamp: expect.any(String),
        status: 'timeout'
      });
    });

    it('should handle script execution error', async () => {
      // Mock execution error
      mockExecError('GPIO permission denied');
      
      const response = await request(app)
        .post('/api/pc/start')
        .expect(500);
      
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to execute PC start command',
        error: 'GPIO permission denied',
        timestamp: expect.any(String),
        status: 'error'
      });
    });

    it('should handle process spawn error', async () => {
      // Mock process error
      const { exec } = require('child_process');
      exec.mockImplementation(() => {
        const mockChild = {
          on: vi.fn((event, callback) => {
            if (event === 'error') {
              setTimeout(() => callback(new Error('ENOENT: no such file or directory')), 10);
            }
          }),
          kill: vi.fn()
        };
        return mockChild;
      });
      
      const response = await request(app)
        .post('/api/pc/start')
        .expect(500);
      
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to start PC control process',
        error: 'ENOENT: no such file or directory',
        timestamp: expect.any(String),
        status: 'error'
      });
    });

    it('should include stdout and stderr in console logs on success', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      mockExec(null, 'GPIO pin activated', 'Warning: deprecated function');
      
      await request(app)
        .post('/api/pc/start')
        .expect(200);
      
      expect(consoleSpy).toHaveBeenCalledWith('PC start script completed successfully');
      expect(consoleSpy).toHaveBeenCalledWith('Start script stdout:', 'GPIO pin activated');
      expect(consoleSpy).toHaveBeenCalledWith('Start script stderr:', 'Warning: deprecated function');
      
      consoleSpy.mockRestore();
    });
  });

  describe('POST /api/pc/shutdown', () => {
    it('should successfully execute PC shutdown command', async () => {
      // Mock successful execution
      mockExec(null, 'PC shutdown initiated', '');
      
      const response = await request(app)
        .post('/api/pc/shutdown')
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        message: 'PC shutdown command executed successfully',
        timestamp: expect.any(String),
        status: 'shutting_down'
      });
      
      // Verify exec was called with correct script
      expect(exec).toHaveBeenCalledWith(
        'bash "/test/shellscripts/shutdown.sh"',
        { timeout: 30000 },
        expect.any(Function)
      );
    });

    it('should handle script execution timeout', async () => {
      // Mock timeout error
      mockExecTimeout();
      
      const response = await request(app)
        .post('/api/pc/shutdown')
        .expect(408);
      
      expect(response.body).toEqual({
        success: false,
        message: 'PC shutdown command timed out after 30 seconds',
        timestamp: expect.any(String),
        status: 'timeout'
      });
    });

    it('should handle script execution error', async () => {
      // Mock execution error
      mockExecError('SSH connection failed');
      
      const response = await request(app)
        .post('/api/pc/shutdown')
        .expect(500);
      
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to execute PC shutdown command',
        error: 'SSH connection failed',
        timestamp: expect.any(String),
        status: 'error'
      });
    });

    it('should handle process spawn error', async () => {
      // Mock process error
      const { exec } = require('child_process');
      exec.mockImplementation(() => {
        const mockChild = {
          on: vi.fn((event, callback) => {
            if (event === 'error') {
              setTimeout(() => callback(new Error('Permission denied')), 10);
            }
          }),
          kill: vi.fn()
        };
        return mockChild;
      });
      
      const response = await request(app)
        .post('/api/pc/shutdown')
        .expect(500);
      
      expect(response.body).toEqual({
        success: false,
        message: 'Failed to start PC control process',
        error: 'Permission denied',
        timestamp: expect.any(String),
        status: 'error'
      });
    });
  });

  describe('GET /api/pc/status', () => {
    it('should return ONLINE status when ping succeeds', async () => {
      // Mock successful ping
      mockExec(null, 'PING 192.168.1.100 (192.168.1.100): 56 data bytes', '');
      
      const response = await request(app)
        .get('/api/pc/status')
        .expect(200);
      
      expect(response.body).toEqual({
        pcStatus: 'ONLINE',
        pcIP: '192.168.1.100',
        timestamp: expect.any(String),
        botStatus: 'ONLINE'
      });
      
      // Verify ping command was called
      expect(exec).toHaveBeenCalledWith(
        'ping -c 1 192.168.1.100',
        expect.any(Function)
      );
    });

    it('should return OFFLINE status when ping fails', async () => {
      // Mock failed ping
      mockExecError('ping: cannot resolve 192.168.1.100: Unknown host');
      
      const response = await request(app)
        .get('/api/pc/status')
        .expect(200);
      
      expect(response.body).toEqual({
        pcStatus: 'OFFLINE',
        pcIP: '192.168.1.100',
        timestamp: expect.any(String),
        botStatus: 'ONLINE'
      });
    });
  });

  describe('Socket.IO Integration', () => {
    it('should broadcast PC status after start command', async () => {
      // Mock the broadcastPCStatus method
      const broadcastSpy = vi.spyOn(webServer, 'broadcastPCStatus').mockImplementation(() => {});
      
      mockExec(null, 'PC start initiated', '');
      
      await request(app)
        .post('/api/pc/start')
        .expect(200);
      
      // Wait for the setTimeout to trigger
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      expect(broadcastSpy).toHaveBeenCalled();
      
      broadcastSpy.mockRestore();
    });

    it('should broadcast PC status after shutdown command', async () => {
      // Mock the broadcastPCStatus method
      const broadcastSpy = vi.spyOn(webServer, 'broadcastPCStatus').mockImplementation(() => {});
      
      mockExec(null, 'PC shutdown initiated', '');
      
      await request(app)
        .post('/api/pc/shutdown')
        .expect(200);
      
      // Wait for the setTimeout to trigger
      await new Promise(resolve => setTimeout(resolve, 2100));
      
      expect(broadcastSpy).toHaveBeenCalled();
      
      broadcastSpy.mockRestore();
    });
  });

  describe('Error Response Format Validation', () => {
    it('should always include required fields in error responses', async () => {
      mockExecError('Test error');
      
      const response = await request(app)
        .post('/api/pc/start')
        .expect(500);
      
      // Verify all required fields are present
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('error');
      
      // Verify timestamp is valid ISO string
      expect(() => new Date(response.body.timestamp)).not.toThrow();
    });

    it('should always include required fields in success responses', async () => {
      mockExec(null, 'Success', '');
      
      const response = await request(app)
        .post('/api/pc/start')
        .expect(200);
      
      // Verify all required fields are present
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('status');
      
      // Verify timestamp is valid ISO string
      expect(() => new Date(response.body.timestamp)).not.toThrow();
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous start requests', async () => {
      mockExec(null, 'PC start initiated', '');
      
      const requests = Array(3).fill().map(() => 
        request(app).post('/api/pc/start')
      );
      
      const responses = await Promise.all(requests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
      
      // Exec should be called for each request
      expect(exec).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed start and shutdown requests', async () => {
      mockExec(null, 'Command executed', '');
      
      const startRequest = request(app).post('/api/pc/start');
      const shutdownRequest = request(app).post('/api/pc/shutdown');
      
      const [startResponse, shutdownResponse] = await Promise.all([
        startRequest,
        shutdownRequest
      ]);
      
      expect(startResponse.status).toBe(200);
      expect(startResponse.body.status).toBe('starting');
      
      expect(shutdownResponse.status).toBe(200);
      expect(shutdownResponse.body.status).toBe('shutting_down');
    });
  });
});