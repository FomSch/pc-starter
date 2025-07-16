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
        this.server.listen(this.port, () => {
            console.log(`🌐 Web dashboard running at http://localhost:${this.port}`);
            console.log(`📊 Dashboard URL: http://localhost:${this.port}/dashboard`);
        });

        // Broadcast updates every 30 seconds
        setInterval(() => {
            this.broadcastUpdate();
        }, 30000);
    }

    getURL() {
        return `http://localhost:${this.port}/dashboard`;
    }
}

module.exports = WebServer;