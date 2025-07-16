const fs = require('fs').promises;
const { exec } = require('child_process');
const path = require('path');

class PiMonitor {
    constructor() {
        this.historyFile = path.join(__dirname, 'monitoring_history.json');
        this.maxHistoryEntries = 288; // 24 hours of 5-minute intervals
    }

    async getCPUTemp() {
        try {
            const temp = await fs.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8');
            return parseFloat((parseInt(temp.trim()) / 1000).toFixed(1));
        } catch (error) {
            console.log('Error reading CPU temperature:', error.message);
            return null;
        }
    }

    async getSystemStats() {
        return new Promise((resolve) => {
            exec('free -m && uptime && cat /proc/loadavg', (err, stdout, stderr) => {
                if (err) {
                    console.log('Error getting system stats:', err.message);
                    resolve(null);
                    return;
                }
                resolve(this.parseSystemData(stdout));
            });
        });
    }

    parseSystemData(output) {
        const lines = output.split('\n');
        const stats = {};

        try {
            // Parse memory info (free -m output)
            const memLine = lines.find(line => line.includes('Mem:'));
            if (memLine) {
                const memParts = memLine.split(/\s+/);
                stats.memTotal = parseInt(memParts[1]);
                stats.memUsed = parseInt(memParts[2]);
                stats.memUsage = Math.round((stats.memUsed / stats.memTotal) * 100);
            }

            // Parse uptime
            const uptimeLine = lines.find(line => line.includes('up'));
            if (uptimeLine) {
                stats.uptime = this.parseUptime(uptimeLine);
            }

            // Parse CPU load
            const loadLine = lines.find(line => line.match(/^\d+\.\d+/));
            if (loadLine) {
                const loadAvg = parseFloat(loadLine.split(' ')[0]);
                stats.cpuLoad = Math.round(loadAvg * 100);
            }
        } catch (error) {
            console.log('Error parsing system data:', error.message);
        }

        return stats;
    }

    parseUptime(uptimeLine) {
        const uptimeMatch = uptimeLine.match(/up\s+(.+?),\s+\d+\s+user/);
        if (uptimeMatch) {
            return uptimeMatch[1].trim();
        }
        return 'Unknown';
    }

    getTempStatus(temp) {
        if (temp === null) return { emoji: '❓', status: 'Unknown', color: 'GREY' };
        if (temp < 60) return { emoji: '❄️', status: 'Normal', color: 'GREEN' };
        if (temp < 70) return { emoji: '🌡️', status: 'Warm', color: 'YELLOW' };
        if (temp < 80) return { emoji: '🟠', status: 'Hot', color: 'ORANGE' };
        return { emoji: '🔥', status: 'Critical', color: 'RED' };
    }

    async saveTemperatureHistory(temp) {
        if (temp === null) return;

        try {
            let history = { temperatures: [], timestamps: [] };
            
            try {
                const data = await fs.readFile(this.historyFile, 'utf8');
                history = JSON.parse(data);
            } catch (error) {
                // File doesn't exist yet, use empty history
            }

            const now = new Date().toISOString();
            history.temperatures.push(temp);
            history.timestamps.push(now);

            // Keep only last maxHistoryEntries
            if (history.temperatures.length > this.maxHistoryEntries) {
                history.temperatures = history.temperatures.slice(-this.maxHistoryEntries);
                history.timestamps = history.timestamps.slice(-this.maxHistoryEntries);
            }

            await fs.writeFile(this.historyFile, JSON.stringify(history, null, 2));
        } catch (error) {
            console.log('Error saving temperature history:', error.message);
        }
    }

    async getTemperatureHistory(hours = 6) {
        try {
            const data = await fs.readFile(this.historyFile, 'utf8');
            const history = JSON.parse(data);
            
            const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
            const recentData = [];

            for (let i = 0; i < history.timestamps.length; i++) {
                const timestamp = new Date(history.timestamps[i]);
                if (timestamp >= cutoffTime) {
                    recentData.push({
                        temp: history.temperatures[i],
                        time: timestamp
                    });
                }
            }

            return recentData;
        } catch (error) {
            console.log('Error reading temperature history:', error.message);
            return [];
        }
    }

    formatTemperatureHistory(historyData) {
        if (historyData.length === 0) {
            return 'No temperature history available.';
        }

        let output = '📈 **Temperature History (Last 6 Hours)**\n';
        
        // Group by hour and show hourly averages
        const hourlyData = {};
        historyData.forEach(entry => {
            const hour = entry.time.getHours();
            const key = `${hour.toString().padStart(2, '0')}:00`;
            if (!hourlyData[key]) {
                hourlyData[key] = [];
            }
            hourlyData[key].push(entry.temp);
        });

        Object.entries(hourlyData).forEach(([time, temps]) => {
            const avgTemp = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
            const tempStatus = this.getTempStatus(parseFloat(avgTemp));
            output += `${time} - ${avgTemp}°C ${tempStatus.emoji}\n`;
        });

        // Show current temperature
        const latest = historyData[historyData.length - 1];
        if (latest) {
            const currentStatus = this.getTempStatus(latest.temp);
            output += `\n**Current:** ${latest.temp}°C ${currentStatus.emoji} (${currentStatus.status})`;
        }

        return output;
    }
}

module.exports = PiMonitor;