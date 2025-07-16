const Database = require('better-sqlite3');
const path = require('path');

class TemperatureDB {
    constructor() {
        this.dbPath = path.join(__dirname, 'temperature.db');
        this.db = null;
        this.init();
    }

    init() {
        try {
            this.db = new Database(this.dbPath);
            console.log('Connected to SQLite database');
            this.createTables();
        } catch (err) {
            console.error('Error opening database:', err.message);
        }
    }

    createTables() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS temperature_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                temperature REAL,
                status TEXT,
                cpu_load REAL,
                memory_usage REAL,
                memory_total REAL,
                uptime TEXT
            )
        `;

        try {
            this.db.exec(createTableSQL);
            console.log('Temperature logs table ready');
        } catch (err) {
            console.error('Error creating table:', err.message);
        }
    }

    logTemperature(temp, status, systemStats = {}) {
        const insertSQL = `
            INSERT INTO temperature_logs (temperature, status, cpu_load, memory_usage, memory_total, uptime)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const values = [
            temp,
            status,
            systemStats.cpuLoad || null,
            systemStats.memUsage || null,
            systemStats.memTotal || null,
            systemStats.uptime || null
        ];

        try {
            const info = this.db.prepare(insertSQL).run(...values);
            console.log(`[DB] Temperature logged: ${temp}°C (ID: ${info.lastInsertRowid})`);
        } catch (err) {
            console.error('Error logging temperature:', err.message);
        }
    }

    getTemperatureData(hours = 24) {
        const query = `
            SELECT 
                datetime(timestamp, 'localtime') as timestamp,
                temperature,
                status,
                cpu_load,
                memory_usage,
                memory_total
            FROM temperature_logs 
            WHERE timestamp >= datetime('now', '-${hours} hours')
            ORDER BY timestamp ASC
        `;

        try {
            return this.db.prepare(query).all();
        } catch (err) {
            console.error('Error getting temperature data:', err.message);
            return [];
        }
    }

    getTemperatureStats(hours = 24) {
        const query = `
            SELECT 
                COUNT(*) as count,
                MIN(temperature) as min_temp,
                MAX(temperature) as max_temp,
                AVG(temperature) as avg_temp,
                MIN(datetime(timestamp, 'localtime')) as first_reading,
                MAX(datetime(timestamp, 'localtime')) as last_reading
            FROM temperature_logs 
            WHERE timestamp >= datetime('now', '-${hours} hours')
        `;

        try {
            return this.db.prepare(query).get();
        } catch (err) {
            console.error('Error getting temperature stats:', err.message);
            return {
                count: 0,
                min_temp: null,
                max_temp: null,
                avg_temp: null,
                first_reading: null,
                last_reading: null
            };
        }
    }

    exportToCSV(hours = 24) {
        const query = `
            SELECT 
                datetime(timestamp, 'localtime') as timestamp,
                temperature,
                status,
                cpu_load,
                memory_usage,
                memory_total,
                uptime
            FROM temperature_logs 
            WHERE timestamp >= datetime('now', '-${hours} hours')
            ORDER BY timestamp ASC
        `;

        try {
            const rows = this.db.prepare(query).all();
            
            // Convert to CSV format
            const headers = ['Timestamp', 'Temperature', 'Status', 'CPU Load', 'Memory Usage', 'Memory Total', 'Uptime'];
            let csv = headers.join(',') + '\n';
            
            rows.forEach(row => {
                csv += [
                    row.timestamp,
                    row.temperature,
                    row.status,
                    row.cpu_load || '',
                    row.memory_usage || '',
                    row.memory_total || '',
                    row.uptime || ''
                ].join(',') + '\n';
            });
            
            return csv;
        } catch (err) {
            console.error('Error exporting to CSV:', err.message);
            return 'Error generating CSV';
        }
    }

    close() {
        if (this.db) {
            try {
                this.db.close();
                console.log('Database connection closed');
            } catch (err) {
                console.error('Error closing database:', err.message);
            }
        }
    }
}

module.exports = TemperatureDB;