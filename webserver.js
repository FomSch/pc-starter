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

        this.app.get('/api/server/status', (req, res) => {
            res.json({
                status: 'running',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                pid: process.pid
            });
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
        } catch (error) {
            console.error('Error broadcasting update:', error.message);
        }
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