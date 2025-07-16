const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, 'temperature.db');
        this.db = null;
        this.init();
    }

    init() {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
            } else {
                console.log('Connected to SQLite database');
                this.createTables();
            }
        });
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

        this.db.run(createTableSQL, (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            } else {
                console.log('Temperature logs table ready');
            }
        });
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

        this.db.run(insertSQL, values, function(err) {
            if (err) {
                console.error('Error logging temperature:', err.message);
            } else {
                console.log(`[DB] Temperature logged: ${temp}°C (ID: ${this.lastID})`);
            }
        });
    }

    getTemperatureData(hours = 24) {
        return new Promise((resolve, reject) => {
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

            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    getTemperatureStats(hours = 24) {
        return new Promise((resolve, reject) => {
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

            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows[0]);
                }
            });
        });
    }

    exportToCSV(hours = 24) {
        return new Promise((resolve, reject) => {
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

            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
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
                    
                    resolve(csv);
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err.message);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = Database;