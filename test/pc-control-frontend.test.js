import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock fetch globally
global.fetch = vi.fn();

// Mock confirm dialog
global.confirm = vi.fn();

// Mock alert dialog
global.alert = vi.fn();

describe('PC Control Frontend Functionality', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    // Create a new DOM for each test
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Test Dashboard</title>
        </head>
        <body>
          <button id="startPCBtn" class="btn btn-success" onclick="startPC()">🚀 Start PC</button>
          <button id="shutdownPCBtn" class="btn btn-danger" onclick="shutdownPC()">🔴 Shutdown PC</button>
          <script>
            // Button state management
            function updateButtonState(button, state, text, disabled) {
              button.textContent = text;
              button.disabled = disabled;
              
              // Remove all state classes
              button.classList.remove('btn-loading', 'btn-success', 'btn-danger', 'btn-warning', 'btn-secondary');
              
              switch (state) {
                case 'loading':
                case 'starting':
                case 'shutting-down':
                  button.classList.add('btn-loading', 'btn-warning');
                  break;
                case 'error':
                  button.classList.add('btn-danger');
                  break;
                case 'online':
                  button.classList.add('btn-secondary');
                  break;
                case 'offline':
                  button.classList.add('btn-secondary');
                  break;
                default:
                  // Default states
                  if (button.id === 'startPCBtn') {
                    button.classList.add('btn-success');
                  } else if (button.id === 'shutdownPCBtn') {
                    button.classList.add('btn-danger');
                  }
              }
            }

            // PC Control Functions
            async function startPC() {
              const startBtn = document.getElementById('startPCBtn');
              
              // Prevent multiple clicks
              if (startBtn.disabled) {
                return;
              }
              
              // Set loading state with immediate feedback
              updateButtonState(startBtn, 'loading', '⏳ Starting...', true);
              
              try {
                const response = await fetch('/api/pc/start', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
                
                if (!response.ok) {
                  throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const result = await response.json();
                
                if (result.success) {
                  // Update to starting state as per requirement 2.4
                  updateButtonState(startBtn, 'starting', '⏳ Starting...', true);
                  
                  // Set up timeout for starting operation (2 minutes)
                  const startTimeout = setTimeout(() => {
                    // Check if still in starting state
                    if (startBtn.classList.contains('btn-loading')) {
                      updateButtonState(startBtn, 'error', '⏰ Start Timeout', false);
                      setTimeout(() => {
                        updatePCButtonStates();
                      }, 3000);
                    }
                  }, 120000); // 2 minutes timeout
                  
                  // Store timeout ID for potential cleanup
                  startBtn.dataset.timeoutId = startTimeout;
                  
                } else {
                  // Show error state with specific message if available
                  const errorMsg = result.message || 'Start Failed';
                  updateButtonState(startBtn, 'error', \`❌ \${errorMsg}\`, false);
                  
                  // Reset to default state after showing error
                  setTimeout(() => {
                    updatePCButtonStates();
                  }, 3000);
                }
                
              } catch (error) {
                console.error('Error starting PC:', error);
                
                // Provide specific error feedback to user
                let errorMsg = 'Start Failed';
                if (error.message.includes('Failed to fetch')) {
                  errorMsg = 'Network Error';
                } else if (error.message.includes('timeout')) {
                  errorMsg = 'Request Timeout';
                }
                
                updateButtonState(startBtn, 'error', \`❌ \${errorMsg}\`, false);
                
                // Reset to default state after showing error
                setTimeout(() => {
                  updatePCButtonStates();
                }, 3000);
              }
            }
            
            async function shutdownPC() {
              const shutdownBtn = document.getElementById('shutdownPCBtn');
              
              // Prevent multiple clicks
              if (shutdownBtn.disabled) {
                return;
              }
              
              if (!confirm('🔴 Are you sure you want to shutdown the PC?\\n\\nThis will power off the PC completely.')) {
                return;
              }
              
              // Set loading state with immediate feedback
              updateButtonState(shutdownBtn, 'loading', '⏳ Shutting Down...', true);
              
              try {
                const response = await fetch('/api/pc/shutdown', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
                
                if (!response.ok) {
                  throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const result = await response.json();
                
                if (result.success) {
                  // Update to shutting down state as per requirement 5.4
                  updateButtonState(shutdownBtn, 'shutting-down', '⏳ Shutting Down...', true);
                  
                  // Set up timeout for shutdown operation (90 seconds)
                  const shutdownTimeout = setTimeout(() => {
                    // Check if still in shutting down state
                    if (shutdownBtn.classList.contains('btn-loading')) {
                      updateButtonState(shutdownBtn, 'error', '⏰ Shutdown Timeout', false);
                      setTimeout(() => {
                        updatePCButtonStates();
                      }, 3000);
                    }
                  }, 90000); // 90 seconds timeout
                  
                  // Store timeout ID for potential cleanup
                  shutdownBtn.dataset.timeoutId = shutdownTimeout;
                  
                } else {
                  // Show error state with specific message if available
                  const errorMsg = result.message || 'Shutdown Failed';
                  updateButtonState(shutdownBtn, 'error', \`❌ \${errorMsg}\`, false);
                  
                  // Reset to default state after showing error
                  setTimeout(() => {
                    updatePCButtonStates();
                  }, 3000);
                }
                
              } catch (error) {
                console.error('Error shutting down PC:', error);
                
                // Provide specific error feedback to user
                let errorMsg = 'Shutdown Failed';
                if (error.message.includes('Failed to fetch')) {
                  errorMsg = 'Network Error';
                } else if (error.message.includes('timeout')) {
                  errorMsg = 'Request Timeout';
                }
                
                updateButtonState(shutdownBtn, 'error', \`❌ \${errorMsg}\`, false);
                
                // Reset to default state after showing error
                setTimeout(() => {
                  updatePCButtonStates();
                }, 3000);
              }
            }

            // Update PC button states based on current PC status
            async function updatePCButtonStates() {
              try {
                const response = await fetch('/api/pc/status');
                
                if (!response.ok) {
                  throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
                
                const status = await response.json();
                const startBtn = document.getElementById('startPCBtn');
                const shutdownBtn = document.getElementById('shutdownPCBtn');
                
                if (status.pcStatus === 'ONLINE') {
                  updateButtonState(startBtn, 'online', '✅ PC Online', true);
                  updateButtonState(shutdownBtn, 'default', '🔴 Shutdown PC', false);
                } else {
                  updateButtonState(startBtn, 'default', '🚀 Start PC', false);
                  updateButtonState(shutdownBtn, 'offline', '⚫ PC Offline', true);
                }
                
              } catch (error) {
                console.error('Error checking PC status for button states:', error);
                // Reset to default states on error
                const startBtn = document.getElementById('startPCBtn');
                const shutdownBtn = document.getElementById('shutdownPCBtn');
                updateButtonState(startBtn, 'default', '🚀 Start PC', false);
                updateButtonState(shutdownBtn, 'default', '🔴 Shutdown PC', false);
              }
            }

            // Update PC button states directly from status data (for real-time updates)
            function updatePCButtonStatesFromStatus(data) {
              const startBtn = document.getElementById('startPCBtn');
              const shutdownBtn = document.getElementById('shutdownPCBtn');
              
              // Don't update if buttons are in loading states (user initiated action)
              if (startBtn.classList.contains('btn-loading') || shutdownBtn.classList.contains('btn-loading')) {
                return;
              }
              
              if (data.pcStatus === 'ONLINE') {
                updateButtonState(startBtn, 'online', '✅ PC Online', true);
                updateButtonState(shutdownBtn, 'default', '🔴 Shutdown PC', false);
              } else {
                updateButtonState(startBtn, 'default', '🚀 Start PC', false);
                updateButtonState(shutdownBtn, 'offline', '⚫ PC Offline', true);
              }
            }

            // Make functions available globally for testing
            window.startPC = startPC;
            window.shutdownPC = shutdownPC;
            window.updateButtonState = updateButtonState;
            window.updatePCButtonStates = updatePCButtonStates;
            window.updatePCButtonStatesFromStatus = updatePCButtonStatesFromStatus;
          </script>
        </body>
      </html>
    `, {
      url: 'http://localhost:3001',
      runScripts: 'dangerously',
      resources: 'usable'
    });

    document = dom.window.document;
    window = dom.window;
    
    // Set up global objects for the test environment
    global.document = document;
    global.window = window;
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset fetch mock
    fetch.mockClear();
    confirm.mockClear();
    alert.mockClear();
  });

  afterEach(() => {
    dom.window.close();
    vi.restoreAllMocks();
  });

  describe('Button State Management', () => {
    it('should update button to loading state correctly', () => {
      const startBtn = document.getElementById('startPCBtn');
      
      window.updateButtonState(startBtn, 'loading', '⏳ Starting...', true);
      
      expect(startBtn.textContent).toBe('⏳ Starting...');
      expect(startBtn.disabled).toBe(true);
      expect(startBtn.classList.contains('btn-loading')).toBe(true);
      expect(startBtn.classList.contains('btn-warning')).toBe(true);
      expect(startBtn.classList.contains('btn-success')).toBe(false);
    });

    it('should update button to error state correctly', () => {
      const startBtn = document.getElementById('startPCBtn');
      
      window.updateButtonState(startBtn, 'error', '❌ Start Failed', false);
      
      expect(startBtn.textContent).toBe('❌ Start Failed');
      expect(startBtn.disabled).toBe(false);
      expect(startBtn.classList.contains('btn-danger')).toBe(true);
      expect(startBtn.classList.contains('btn-loading')).toBe(false);
    });

    it('should update button to online state correctly', () => {
      const startBtn = document.getElementById('startPCBtn');
      
      window.updateButtonState(startBtn, 'online', '✅ PC Online', true);
      
      expect(startBtn.textContent).toBe('✅ PC Online');
      expect(startBtn.disabled).toBe(true);
      expect(startBtn.classList.contains('btn-secondary')).toBe(true);
    });

    it('should reset button to default state correctly', () => {
      const startBtn = document.getElementById('startPCBtn');
      const shutdownBtn = document.getElementById('shutdownPCBtn');
      
      window.updateButtonState(startBtn, 'default', '🚀 Start PC', false);
      window.updateButtonState(shutdownBtn, 'default', '🔴 Shutdown PC', false);
      
      expect(startBtn.classList.contains('btn-success')).toBe(true);
      expect(shutdownBtn.classList.contains('btn-danger')).toBe(true);
    });
  });

  describe('Start PC Button Interactions', () => {
    it('should prevent multiple clicks when button is disabled', async () => {
      const startBtn = document.getElementById('startPCBtn');
      startBtn.disabled = true;
      
      await window.startPC();
      
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should set loading state immediately on click', async () => {
      const startBtn = document.getElementById('startPCBtn');
      
      // Mock successful API response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'starting' })
      });
      
      const startPromise = window.startPC();
      
      // Check immediate state change
      expect(startBtn.textContent).toBe('⏳ Starting...');
      expect(startBtn.disabled).toBe(true);
      expect(startBtn.classList.contains('btn-loading')).toBe(true);
      
      await startPromise;
    });

    it('should handle successful start command', async () => {
      const startBtn = document.getElementById('startPCBtn');
      
      // Mock successful API response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: true, 
          message: 'PC start command executed successfully',
          status: 'starting' 
        })
      });
      
      await window.startPC();
      
      expect(fetch).toHaveBeenCalledWith('/api/pc/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      expect(startBtn.textContent).toBe('⏳ Starting...');
      expect(startBtn.disabled).toBe(true);
      expect(startBtn.classList.contains('btn-loading')).toBe(true);
    });

    it('should handle API error response', async () => {
      const startBtn = document.getElementById('startPCBtn');
      
      // Mock API error response
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });
      
      await window.startPC();
      
      expect(startBtn.textContent).toBe('❌ Start Failed');
      expect(startBtn.disabled).toBe(false);
      expect(startBtn.classList.contains('btn-danger')).toBe(true);
    });

    it('should handle network error', async () => {
      const startBtn = document.getElementById('startPCBtn');
      
      // Mock network error
      fetch.mockRejectedValueOnce(new Error('Failed to fetch'));
      
      await window.startPC();
      
      expect(startBtn.textContent).toBe('❌ Network Error');
      expect(startBtn.disabled).toBe(false);
      expect(startBtn.classList.contains('btn-danger')).toBe(true);
    });

    it('should handle API failure response', async () => {
      const startBtn = document.getElementById('startPCBtn');
      
      // Mock API failure response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          success: false, 
          message: 'GPIO permission denied' 
        })
      });
      
      await window.startPC();
      
      expect(startBtn.textContent).toBe('❌ GPIO permission denied');
      expect(startBtn.disabled).toBe(false);
      expect(startBtn.classList.contains('btn-danger')).toBe(true);
    });

    it('should set up timeout for start operation', async () => {
      const startBtn = document.getElementById('startPCBtn');
      
      // Mock successful API response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'starting' })
      });
      
      await window.startPC();
      
      // Check that timeout ID is stored
      expect(startBtn.dataset.timeoutId).toBeDefined();
      expect(parseInt(startBtn.dataset.timeoutId)).toBeGreaterThan(0);
    });
  });

  describe('Shutdown PC Button Interactions', () => {
    it('should show confirmation dialog before shutdown', async () => {
      confirm.mockReturnValue(false); // User cancels
      
      await window.shutdownPC();
      
      expect(confirm).toHaveBeenCalledWith(
        '🔴 Are you sure you want to shutdown the PC?\n\nThis will power off the PC completely.'
      );
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should proceed with shutdown when confirmed', async () => {
      const shutdownBtn = document.getElementById('shutdownPCBtn');
      
      confirm.mockReturnValue(true); // User confirms
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'shutting_down' })
      });
      
      await window.shutdownPC();
      
      expect(confirm).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith('/api/pc/shutdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      expect(shutdownBtn.textContent).toBe('⏳ Shutting Down...');
      expect(shutdownBtn.disabled).toBe(true);
    });

    it('should prevent multiple clicks when button is disabled', async () => {
      const shutdownBtn = document.getElementById('shutdownPCBtn');
      shutdownBtn.disabled = true;
      
      await window.shutdownPC();
      
      expect(confirm).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should handle shutdown API error', async () => {
      const shutdownBtn = document.getElementById('shutdownPCBtn');
      
      confirm.mockReturnValue(true);
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });
      
      await window.shutdownPC();
      
      expect(shutdownBtn.textContent).toBe('❌ Shutdown Failed');
      expect(shutdownBtn.disabled).toBe(false);
      expect(shutdownBtn.classList.contains('btn-danger')).toBe(true);
    });

    it('should set up timeout for shutdown operation', async () => {
      const shutdownBtn = document.getElementById('shutdownPCBtn');
      
      confirm.mockReturnValue(true);
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, status: 'shutting_down' })
      });
      
      await window.shutdownPC();
      
      // Check that timeout ID is stored
      expect(shutdownBtn.dataset.timeoutId).toBeDefined();
      expect(parseInt(shutdownBtn.dataset.timeoutId)).toBeGreaterThan(0);
    });
  });

  describe('PC Status Updates', () => {
    it('should update buttons when PC is online', async () => {
      const startBtn = document.getElementById('startPCBtn');
      const shutdownBtn = document.getElementById('shutdownPCBtn');
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pcStatus: 'ONLINE' })
      });
      
      await window.updatePCButtonStates();
      
      expect(startBtn.textContent).toBe('✅ PC Online');
      expect(startBtn.disabled).toBe(true);
      expect(startBtn.classList.contains('btn-secondary')).toBe(true);
      
      expect(shutdownBtn.textContent).toBe('🔴 Shutdown PC');
      expect(shutdownBtn.disabled).toBe(false);
      expect(shutdownBtn.classList.contains('btn-danger')).toBe(true);
    });

    it('should update buttons when PC is offline', async () => {
      const startBtn = document.getElementById('startPCBtn');
      const shutdownBtn = document.getElementById('shutdownPCBtn');
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pcStatus: 'OFFLINE' })
      });
      
      await window.updatePCButtonStates();
      
      expect(startBtn.textContent).toBe('🚀 Start PC');
      expect(startBtn.disabled).toBe(false);
      expect(startBtn.classList.contains('btn-success')).toBe(true);
      
      expect(shutdownBtn.textContent).toBe('⚫ PC Offline');
      expect(shutdownBtn.disabled).toBe(true);
      expect(shutdownBtn.classList.contains('btn-secondary')).toBe(true);
    });

    it('should handle status check API error', async () => {
      const startBtn = document.getElementById('startPCBtn');
      const shutdownBtn = document.getElementById('shutdownPCBtn');
      
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      await window.updatePCButtonStates();
      
      // Should reset to default states on error
      expect(startBtn.textContent).toBe('🚀 Start PC');
      expect(startBtn.disabled).toBe(false);
      expect(shutdownBtn.textContent).toBe('🔴 Shutdown PC');
      expect(shutdownBtn.disabled).toBe(false);
    });
  });

  describe('Real-time Status Updates', () => {
    it('should update buttons from socket data when PC comes online', () => {
      const startBtn = document.getElementById('startPCBtn');
      const shutdownBtn = document.getElementById('shutdownPCBtn');
      
      window.updatePCButtonStatesFromStatus({ pcStatus: 'ONLINE' });
      
      expect(startBtn.textContent).toBe('✅ PC Online');
      expect(startBtn.disabled).toBe(true);
      expect(shutdownBtn.textContent).toBe('🔴 Shutdown PC');
      expect(shutdownBtn.disabled).toBe(false);
    });

    it('should update buttons from socket data when PC goes offline', () => {
      const startBtn = document.getElementById('startPCBtn');
      const shutdownBtn = document.getElementById('shutdownPCBtn');
      
      window.updatePCButtonStatesFromStatus({ pcStatus: 'OFFLINE' });
      
      expect(startBtn.textContent).toBe('🚀 Start PC');
      expect(startBtn.disabled).toBe(false);
      expect(shutdownBtn.textContent).toBe('⚫ PC Offline');
      expect(shutdownBtn.disabled).toBe(true);
    });

    it('should not update buttons when they are in loading state', () => {
      const startBtn = document.getElementById('startPCBtn');
      const shutdownBtn = document.getElementById('shutdownPCBtn');
      
      // Set buttons to loading state
      startBtn.classList.add('btn-loading');
      shutdownBtn.classList.add('btn-loading');
      
      const originalStartText = startBtn.textContent;
      const originalShutdownText = shutdownBtn.textContent;
      
      window.updatePCButtonStatesFromStatus({ pcStatus: 'ONLINE' });
      
      // Buttons should not change when in loading state
      expect(startBtn.textContent).toBe(originalStartText);
      expect(shutdownBtn.textContent).toBe(originalShutdownText);
    });
  });

  describe('Button State Transitions', () => {
    it('should transition through all start button states correctly', async () => {
      const startBtn = document.getElementById('startPCBtn');
      
      // Initial state
      expect(startBtn.textContent).toBe('🚀 Start PC');
      expect(startBtn.disabled).toBe(false);
      expect(startBtn.classList.contains('btn-success')).toBe(true);
      
      // Loading state
      window.updateButtonState(startBtn, 'loading', '⏳ Starting...', true);
      expect(startBtn.textContent).toBe('⏳ Starting...');
      expect(startBtn.disabled).toBe(true);
      expect(startBtn.classList.contains('btn-loading')).toBe(true);
      
      // Starting state
      window.updateButtonState(startBtn, 'starting', '⏳ Starting...', true);
      expect(startBtn.textContent).toBe('⏳ Starting...');
      expect(startBtn.disabled).toBe(true);
      expect(startBtn.classList.contains('btn-loading')).toBe(true);
      
      // Online state (PC started successfully)
      window.updateButtonState(startBtn, 'online', '✅ PC Online', true);
      expect(startBtn.textContent).toBe('✅ PC Online');
      expect(startBtn.disabled).toBe(true);
      expect(startBtn.classList.contains('btn-secondary')).toBe(true);
    });

    it('should transition through all shutdown button states correctly', async () => {
      const shutdownBtn = document.getElementById('shutdownPCBtn');
      
      // Initial state
      expect(shutdownBtn.textContent).toBe('🔴 Shutdown PC');
      expect(shutdownBtn.disabled).toBe(false);
      expect(shutdownBtn.classList.contains('btn-danger')).toBe(true);
      
      // Loading state
      window.updateButtonState(shutdownBtn, 'loading', '⏳ Shutting Down...', true);
      expect(shutdownBtn.textContent).toBe('⏳ Shutting Down...');
      expect(shutdownBtn.disabled).toBe(true);
      expect(shutdownBtn.classList.contains('btn-loading')).toBe(true);
      
      // Shutting down state
      window.updateButtonState(shutdownBtn, 'shutting-down', '⏳ Shutting Down...', true);
      expect(shutdownBtn.textContent).toBe('⏳ Shutting Down...');
      expect(shutdownBtn.disabled).toBe(true);
      expect(shutdownBtn.classList.contains('btn-loading')).toBe(true);
      
      // Offline state (PC shutdown successfully)
      window.updateButtonState(shutdownBtn, 'offline', '⚫ PC Offline', true);
      expect(shutdownBtn.textContent).toBe('⚫ PC Offline');
      expect(shutdownBtn.disabled).toBe(true);
      expect(shutdownBtn.classList.contains('btn-secondary')).toBe(true);
    });

    it('should handle error state transitions correctly', () => {
      const startBtn = document.getElementById('startPCBtn');
      const shutdownBtn = document.getElementById('shutdownPCBtn');
      
      // Error states
      window.updateButtonState(startBtn, 'error', '❌ Start Failed', false);
      expect(startBtn.textContent).toBe('❌ Start Failed');
      expect(startBtn.disabled).toBe(false);
      expect(startBtn.classList.contains('btn-danger')).toBe(true);
      
      window.updateButtonState(shutdownBtn, 'error', '❌ Shutdown Failed', false);
      expect(shutdownBtn.textContent).toBe('❌ Shutdown Failed');
      expect(shutdownBtn.disabled).toBe(false);
      expect(shutdownBtn.classList.contains('btn-danger')).toBe(true);
    });
  });
});