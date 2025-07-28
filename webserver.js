const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

class WebServer {
    constructor(database, monitor) {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server);
        this.database = database;
        this.monitor = monitor;
        this.port = 3001;

        this.setupRoutes();
        this.setupSocketIO();
    }

    setupRoutes() {
        // Middleware for JSON parsing
        this.app.use(express.json());

        // Serve static files
        this.app.use(express.static(path.join(__dirname, 'public')));

        // API Routes
        this.app.get('/api/temperature/:hours?', async (req, res) => {
            try {
                const hours = parseInt(req.params.hours) || 24;
                const data = await this.database.getTemperatureData(hours);
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/stats/:hours?', async (req, res) => {
            try {
                const hours = parseInt(req.params.hours) || 24;
                const stats = await this.database.getTemperatureStats(hours);
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/current', async (req, res) => {
            try {
                const temp = await this.monitor.getCPUTemp();
                const tempStatus = this.monitor.getTempStatus(temp);
                const systemStats = await this.monitor.getSystemStats();

                res.json({
                    temperature: temp,
                    status: tempStatus.status,
                    emoji: tempStatus.emoji,
                    systemStats: systemStats,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/export/:hours?', async (req, res) => {
            try {
                const hours = parseInt(req.params.hours) || 24;
                const csv = await this.database.exportToCSV(hours);

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="temperature_data_${hours}h.csv"`);
                res.send(csv);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Main dashboard route
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
        });

        this.app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
        });

        // PC status endpoint (same logic as Discord bot)
        this.app.get('/api/pc/status', (req, res) => {
            const { exec } = require('child_process');
            const config = require('./config.json');

            exec(`ping -c 1 ${config.serverip}`, (err) => {
                res.json({
                    pcStatus: err ? 'OFFLINE' : 'ONLINE',
                    pcIP: config.serverip,
                    timestamp: new Date().toISOString(),
                    botStatus: 'ONLINE' // Bot is online if this responds
                });
            });
        });

        // PC control endpoints
        // GET endpoint for direct PC start via URL - shows HTML page
        this.app.get('/start-pc', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'pc-start.html'));
        });

        // API endpoint for direct PC start via URL
        this.app.get('/api/pc/start', (req, res) => {
            const { exec } = require('child_process');
            const scriptPath = path.join(__dirname, 'shellscripts', 'post.sh');

            console.log('PC start command initiated via GET request');

            // Execute the start script with 30-second timeout
            const child = exec(`bash "${scriptPath}"`, { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('PC start script error:', error);

                    // Handle timeout specifically
                    if (error.killed && error.signal === 'SIGTERM') {
                        return res.status(408).json({
                            success: false,
                            message: 'PC start command timed out after 30 seconds',
                            timestamp: new Date().toISOString(),
                            status: 'timeout'
                        });
                    }

                    return res.status(500).json({
                        success: false,
                        message: 'Failed to execute PC start command',
                        error: error.message,
                        timestamp: new Date().toISOString(),
                        status: 'error'
                    });
                }

                console.log('PC start script completed successfully');
                if (stdout) console.log('Start script stdout:', stdout);
                if (stderr) console.log('Start script stderr:', stderr);

                res.json({
                    success: true,
                    message: 'PC start command executed successfully',
                    timestamp: new Date().toISOString(),
                    status: 'starting'
                });

                // Broadcast immediate status update after start command
                setTimeout(() => {
                    this.broadcastPCStatus();
                }, 2000);
            });

            // Handle process errors
            child.on('error', (error) => {
                console.error('PC start process error:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: 'Failed to start PC control process',
                        error: error.message,
                        timestamp: new Date().toISOString(),
                        status: 'error'
                    });
                }
            });
        });

        this.app.post('/api/pc/start', (req, res) => {
            const { exec } = require('child_process');
            const scriptPath = path.join(__dirname, 'shellscripts', 'post.sh');

            console.log('PC start command initiated');

            // Execute the start script with 30-second timeout
            const child = exec(`bash "${scriptPath}"`, { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('PC start script error:', error);

                    // Handle timeout specifically
                    if (error.killed && error.signal === 'SIGTERM') {
                        return res.status(408).json({
                            success: false,
                            message: 'PC start command timed out after 30 seconds',
                            timestamp: new Date().toISOString(),
                            status: 'timeout'
                        });
                    }

                    return res.status(500).json({
                        success: false,
                        message: 'Failed to execute PC start command',
                        error: error.message,
                        timestamp: new Date().toISOString(),
                        status: 'error'
                    });
                }

                console.log('PC start script completed successfully');
                if (stdout) console.log('Start script stdout:', stdout);
                if (stderr) console.log('Start script stderr:', stderr);

                res.json({
                    success: true,
                    message: 'PC start command executed successfully',
                    timestamp: new Date().toISOString(),
                    status: 'starting'
                });

                // Broadcast immediate status update after start command
                setTimeout(() => {
                    this.broadcastPCStatus();
                }, 2000);
            });

            // Handle process errors
            child.on('error', (error) => {
                console.error('PC start process error:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: 'Failed to start PC control process',
                        error: error.message,
                        timestamp: new Date().toISOString(),
                        status: 'error'
                    });
                }
            });
        });

        this.app.post('/api/pc/shutdown', (req, res) => {
            const { exec } = require('child_process');
            const scriptPath = path.join(__dirname, 'shellscripts', 'shutdown.sh');

            console.log('PC shutdown command initiated');

            // Execute the shutdown script with 30-second timeout
            const child = exec(`bash "${scriptPath}"`, { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('PC shutdown script error:', error);

                    // Handle timeout specifically
                    if (error.killed && error.signal === 'SIGTERM') {
                        return res.status(408).json({
                            success: false,
                            message: 'PC shutdown command timed out after 30 seconds',
                            timestamp: new Date().toISOString(),
                            status: 'timeout'
                        });
                    }

                    return res.status(500).json({
                        success: false,
                        message: 'Failed to execute PC shutdown command',
                        error: error.message,
                        timestamp: new Date().toISOString(),
                        status: 'error'
                    });
                }

                console.log('PC shutdown script completed successfully');
                if (stdout) console.log('Shutdown script stdout:', stdout);
                if (stderr) console.log('Shutdown script stderr:', stderr);

                res.json({
                    success: true,
                    message: 'PC shutdown command executed successfully',
                    timestamp: new Date().toISOString(),
                    status: 'shutting_down'
                });

                // Broadcast immediate status update after shutdown command
                setTimeout(() => {
                    this.broadcastPCStatus();
                }, 2000);
            });

            // Handle process errors
            child.on('error', (error) => {
                console.error('PC shutdown process error:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: 'Failed to start PC control process',
                        error: error.message,
                        timestamp: new Date().toISOString(),
                        status: 'error'
                    });
                }
            });
        });

        // Server control endpoints
        this.app.post('/api/server/restart', (req, res) => {
            try {
                // This would restart the bot process
                res.json({ success: true, message: 'Bot restart initiated' });
                setTimeout(() => {
                    process.exit(0); // Exit gracefully, systemd will restart
                }, 1000);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    setupSocketIO() {
        this.io.on('connection', (socket) => {
            console.log('Client connected to dashboard');

            socket.on('disconnect', () => {
                console.log('Client disconnected from dashboard');
            });
        });
    }

    async broadcastUpdate() {
        try {
            const temp = await this.monitor.getCPUTemp();
            const tempStatus = this.monitor.getTempStatus(temp);
            const systemStats = await this.monitor.getSystemStats();

            const update = {
                temperature: temp,
                status: tempStatus.status,
                emoji: tempStatus.emoji,
                systemStats: systemStats,
                timestamp: new Date().toISOString()
            };

            this.io.emit('temperatureUpdate', update);

            // Also broadcast PC status update
            await this.broadcastPCStatus();
        } catch (error) {
            console.error('Error broadcasting update:', error.message);
        }
    }

    async broadcastPCStatus() {
        try {
            const { exec } = require('child_process');
            const config = require('./config.json');

            exec(`ping -c 1 ${config.serverip}`, (err) => {
                const pcStatus = {
                    pcStatus: err ? 'OFFLINE' : 'ONLINE',
                    pcIP: config.serverip,
                    timestamp: new Date().toISOString(),
                    botStatus: 'ONLINE'
                };

                console.log(`[WebServer] Broadcasting PC status: ${pcStatus.pcStatus}`);
                this.io.emit('pcStatusUpdate', pcStatus);
            });
        } catch (error) {
            console.error('Error broadcasting PC status:', error.message);
        }
    }

    // Method to get current PC status synchronously for API calls
    getCurrentPCStatus() {
        return new Promise((resolve) => {
            const { exec } = require('child_process');
            const config = require('./config.json');

            exec(`ping -c 1 ${config.serverip}`, (err) => {
                resolve({
                    pcStatus: err ? 'OFFLINE' : 'ONLINE',
                    pcIP: config.serverip,
                    timestamp: new Date().toISOString(),
                    botStatus: 'ONLINE'
                });
            });
        });
    }

    // Method to be called from index.js when PC status changes
    notifyPCStatusChange(status) {
        const pcStatus = {
            pcStatus: status.toUpperCase(),
            pcIP: require('./config.json').serverip,
            timestamp: new Date().toISOString(),
            botStatus: 'ONLINE'
        };

        console.log(`[WebServer] PC status change notification: ${pcStatus.pcStatus}`);
        this.io.emit('pcStatusUpdate', pcStatus);
    }

    start() {
        this.server.listen(this.port, '0.0.0.0', () => {
            console.log(`🌐 Web dashboard running at http://localhost:${this.port}`);
            console.log(`📊 Dashboard URL: http://localhost:${this.port}/dashboard`);

            // Try to get the Pi's IP address for remote access
            const { networkInterfaces } = require('os');
            const nets = networkInterfaces();
            let ipAddress = 'localhost';

            // Find a non-internal IPv4 address
            for (const name of Object.keys(nets)) {
                for (const net of nets[name]) {
                    if (net.family === 'IPv4' && !net.internal) {
                        ipAddress = net.address;
                        break;
                    }
                }
            }

            console.log(`🌍 Remote access URL: http://${ipAddress}:${this.port}/dashboard`);
        });

        // Broadcast updates every 30 seconds
        setInterval(() => {
            this.broadcastUpdate();
        }, 30000);

        // Additional PC status checking every 2 minutes for more responsive button updates
        setInterval(() => {
            this.broadcastPCStatus();
        }, 120000); // 2 minutes

        // Initial PC status broadcast after startup
        setTimeout(() => {
            this.broadcastPCStatus();
        }, 5000);
    }

    getURL() {
        // Try to get the Pi's IP address for remote access
        const { networkInterfaces } = require('os');
        const nets = networkInterfaces();
        let ipAddress = 'localhost';

        // Find a non-internal IPv4 address
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    ipAddress = net.address;
                    break;
                }
            }
        }

        return `http://${ipAddress}:${this.port}/dashboard`;
    }
}

module.exports = WebServer;