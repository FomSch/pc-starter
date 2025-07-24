// Test setup file
import { vi } from 'vitest';

// Mock child_process globally
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock config.json
vi.mock('../config.json', () => ({
  default: {
    serverip: '192.168.1.100'
  }
}));

// Mock fs for shell script paths
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true)
}));

// Mock path module
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  __dirname: '/test'
}));

// Global test utilities
global.mockExec = (error = null, stdout = '', stderr = '') => {
  const { exec } = require('child_process');
  exec.mockImplementation((command, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    // Simulate async execution
    setTimeout(() => {
      if (callback) {
        callback(error, stdout, stderr);
      }
    }, 10);
    
    // Return a mock child process
    return {
      on: vi.fn(),
      kill: vi.fn()
    };
  });
};

global.mockExecTimeout = () => {
  const { exec } = require('child_process');
  exec.mockImplementation((command, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    // Simulate timeout
    const timeoutError = new Error('Command failed: timeout');
    timeoutError.killed = true;
    timeoutError.signal = 'SIGTERM';
    
    setTimeout(() => {
      if (callback) {
        callback(timeoutError, '', '');
      }
    }, 10);
    
    return {
      on: vi.fn(),
      kill: vi.fn()
    };
  });
};

global.mockExecError = (errorMessage = 'Script execution failed') => {
  const { exec } = require('child_process');
  exec.mockImplementation((command, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    const error = new Error(errorMessage);
    error.code = 1;
    
    setTimeout(() => {
      if (callback) {
        callback(error, '', errorMessage);
      }
    }, 10);
    
    return {
      on: vi.fn(),
      kill: vi.fn()
    };
  });
};