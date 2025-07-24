const discord = require("discord.js");
const fs = require("fs");
var cp = require('child_process');
const { MessageActionRow, MessageButton } = require('discord.js');
const path = require('path');
const PiMonitor = require('./monitor.js');
const TemperatureDB = require('./database.js');
const WebServer = require('./webserver.js');

var client = new discord.Client({
	intents: ["GUILDS", "GUILD_MESSAGES"]
});

//variables
var prefix = "";
var token = "";
var globalsec = "";
var required_role = "";
var channelid = "";
var serverip = "";

//Load config
var config = require("./config.json");
loadconfig();

// Initialize monitoring, database, and web server
const monitor = new PiMonitor();
const database = new TemperatureDB();
const webServer = new WebServer(database, monitor);

client.on("ready", async () => {
	console.log("Bot ready");
	
	// Start web server
	webServer.start();
	
	updatePresence();
	let channel = await client.channels.fetch(channelid);
	if (channel && channel.type === "GUILD_TEXT") {
		ensureServerControlMessage(channel);
	}
});

client.on('messageCreate', msg => {
	console.log(`[Test] Nachricht empfangen: ${msg.content} | Von: ${msg.author.tag}`);
});

client.on("messageCreate", async (msg) => {

	if (msg.author.bot || !msg.content.startsWith(prefix)) {
		return;
	}

	var args = [];
	var command = msg.content.toLowerCase().substring(prefix.length);
	args = command.split(" ");

	msg.delete();

	// ------------------------

	if (args[0] == "setchannel") {

		if (!msg.member.permissions.has('ADMINISTRATOR')) {
			sendMessage(msg.channel, `You dont have the permission to use this command. Use \`\`${prefix}help\`\` for available commands or ask a Staff member for help`, globalsec);
			return;
		}

		if (args.length != 1) {
			sendMessage(msg.channel, `This command functions without arguments. Please use \`\`${prefix}help\`\``, globalsec);
			return;
		}

		if (config.channel == msg.channel.id) {
			sendMessage(msg.channel, `Channel is already set to ` + msg.channel.name, globalsec);
		}

		else {
			config.channel = msg.channel.id;
			channelid = msg.channel.id;
			save(__dirname + "/config.json", config);

			sendMessage(msg.channel, `Set channel to ` + msg.channel.name + " :speech_left:", globalsec);
			ensureServerControlMessage(msg.channel);
		}
		return;
	}

	// ------------------------

	if (msg.channel.id != channelid) {
		sendMessage(msg.channel, `Please use the correct channel.`, globalsec);
		return;
	}

	switch (args[0]) {

		case ("help"):

			if (required_role.use && !msg.member.roles.cache.find(role => role.name === required_role.name)) {
				sendMessage(msg.channel, `Sorry, you don't have the right privileges. You can ask a Staff member for help.`, globalsec);
				return;
			}

			if (args.length != 1) {
				sendMessage(msg.channel, `This command functions without arguments. Please use \`\`${prefix}help\`\``, globalsec);
				return;
			}

			if (args.length != 1) {
				sendMessage(msg.channel, `This command functions without arguments. Please use \`\`${prefix}help\`\``, globalsec);
				return;
			}

			var help = `**__USABLE COMMANDS__**\n1. \`\`${prefix}post\`\`\n2. \`\`${prefix}reboot\`\`\n3. \`\`${prefix}shutdown\`\`\n4. \`\`${prefix}status\`\`\n5. \`\`${prefix}temp\`\`\n6. \`\`${prefix}monitor\`\`\n7. \`\`${prefix}dashboard\`\``;

			if (msg.member.permissions.has("ADMINISTRATOR")) {
				help += `\n\n**__COMMANDS FOR ADMINISTRATOR__**\n1. \`\`${prefix}force-shutdown\`\`\n2. \`\`${prefix}setchannel\`\`\n3. \`\`${prefix}reload\`\`\n4. \`\`${prefix}ping\`\``;
			}

			sendMessage(msg.channel, help, globalsec * 2);
			break;

		case ("status"):

			if (required_role.use && !msg.member.roles.cache.find(role => role.name === required_role.name)) {
				sendMessage(msg.channel, `Sorry, you don't have the right privileges. Use \`\`${prefix}help\`\` for available commands`, globalsec);
				return;
			}

			if (args.length != 1) {
				sendMessage(msg.channel, `This command functions without arguments. Please use \`\`${prefix}help\`\``, globalsec);
				return;
			}

			cp.exec('ping -c 1 ' + serverip, function (err) {
				let statusMsg = err ? 'Server ist aktuell OFFLINE. :octagonal_sign:' : 'Server ist aktuell ONLINE. :white_check_mark:';
				sendMessage(msg.channel, statusMsg, globalsec);
			});
			return;

		case ("post"):

			if (required_role.use && !msg.member.roles.cache.find(role => role.name === required_role.name)) {
				sendMessage(msg.channel, `Sorry, you don't have the right privileges. Use \`\`${prefix}help\`\` for available commands`, globalsec);
				return;
			}

			if (args.length != 1) {
				sendMessage(msg.channel, `This command functions without arguments. Please use \`\`${prefix}help\`\``, globalsec);
				return;
			}

			if (config.status != "off") {

				if (config.status == "on") {
					sendMessage(msg.channel, `The server is already up and running. :white_check_mark:`, globalsec);
				}

				else {
					preoperr(msg.channel);
				}
				return;
			}

			cp.exec(__dirname + "/shellscripts/post.sh", function (err) {
				if (err != null) {
					sendMessage(msg.channel, `An error occured :exclamation: \n\`\`${err}\`\``, globalsec * 2);
					return;
				}
			});

			sendMessage(msg.channel, `The server is posting now. :warning:`, globalsec);
			config.status = "posting";
			save(__dirname + "/config.json", config);

			afterposton(msg.channel);
			logActivity('Server wurde gestartet (Textbefehl)');
			break;

		case ("reboot"):

			if (required_role.use && !msg.member.roles.cache.find(role => role.name === required_role.name)) {
				sendMessage(msg.channel, `Sorry, you don't have the right privileges. Use \`\`${prefix}help\`\` for available commands`, globalsec);
				return;
			}

			if (args.length != 1) {
				sendMessage(msg.channel, `This command functions without arguments. Please use \`\`${prefix}help\`\``, globalsec);
				return;
			}

			if (config.status != "on") {

				if (config.status == "off") {
					sendMessage(msg.channel, `The server is shut down. Use \`\`${prefix}post\`\` instead. :octagonal_sign:`, globalsec);
				}

				else {
					preoperr(msg.channel);
				}

				return;
			}

			cp.exec(__dirname + "/shellscripts/reboot.sh", function (err, stdout, stderr) {
				console.log(stdout);
				console.log(stderr);

				if (err != null) {
					sendMessage(msg.channel, `An error occured :exclamation: \n\`\`${err}\`\``, globalsec * 2);
					return;
				}
			});

			sendMessage(msg.channel, `The server is rebooting now. :warning:`, globalsec);
			config.status = "rebooting";
			save(__dirname + "/config.json", config);

			afterreboot(msg.channel);
			logActivity('Server wurde neugestartet (Textbefehl)');
			break;

		case ("shutdown"):

			if (required_role.use && !msg.member.roles.cache.find(role => role.name === required_role.name)) {
				sendMessage(msg.channel, `Sorry, you don't have the right privileges. Use \`\`${prefix}help\`\` for available commands`, globalsec);
				return;
			}

			if (args.length != 1) {
				sendMessage(msg.channel, `This command functions without arguments. Please use \`\`${prefix}help\`\``, globalsec);
				return;
			}

			if (config.status != "on") {
				if (config.status == "off") {
					sendMessage(msg.channel, `The server is already shut down. :octagonal_sign:`, globalsec);
				}

				else {
					preoperr(msg.channel);
				}

				return;
			}

			cp.exec(__dirname + "/shellscripts/shutdown.sh", function (err, stdout, stderr) {
				console.log(stdout);
				console.log(stderr);

				if (err != null) {
					sendMessage(msg.channel, `An error occured :exclamation: \n\`\`${err}\`\``, globalsec * 2);
					return;
				}
			});

			config.status = "shutting";
			save(__dirname + "/config.json", config);
			sendMessage(msg.channel, `The server is shutting down now. :warning:`, globalsec);

			aftershutoff(msg.channel);
			logActivity('Server wurde heruntergefahren (Textbefehl)');
			break;

		case ("force-shutdown"):

			if (!msg.member.permissions.has('ADMINISTRATOR')) {
				sendMessage(msg.channel, `You dont have the permission to use this command. Use \`\`${prefix}help\`\` for available commands or ask a Staff member for help`, globalsec);
				return;
			}

			if (args.length != 1) {
				sendMessage(msg.channel, `This command functions without arguments. Please use \`\`${prefix}help\`\``, globalsec);
				return;
			}

			cp.exec(__dirname + "/shellscripts/force-shutdown.sh", function (err, stdout, stderr) {
				console.log(stdout);
				console.log(stderr);

				if (err != null) {
					sendMessage(msg.channel, `An error occured :exclamation: \n\`\`${err}\`\``, globalsec * 2);
					return;
				}
			});

			config.status = "off";
			save(__dirname + "/config.json", config);
			sendMessage(msg.channel, `The server is being forced to shut down now. :octagonal_sign:`, globalsec);
			break;

		case ("ping"):

			if (!msg.member.permissions.has('ADMINISTRATOR')) {
				sendMessage(msg.channel, `You dont have the permission to use this command. Use \`\`${prefix}help\`\` for available commands or ask a Staff member for help`, globalsec);
				return;
			}

			if (args.length != 1) {
				sendMessage(msg.channel, `This command functions without arguments. Please use \`\`${prefix}help\`\``, globalsec);
				return;
			}

			cp.exec("ping -c 3 " + serverip, function (err, stdout, stderr) {
				console.log(stdout);
				console.log(stderr);

				if (err != null) {
					sendMessage(msg.channel, `An error occured :exclamation: \n\`\`${err}\`\``, globalsec * 2);
					return;
				}

				else {
					sendMessage(msg.channel, `The Server is currently online :white_check_mark:\n\`\`${stdout}\`\``, globalsec * 2);
					return;
				}
			});
			break;

		case ("temp"):

			if (required_role.use && !msg.member.roles.cache.find(role => role.name === required_role.name)) {
				sendMessage(msg.channel, `Sorry, you don't have the right privileges. Use \`\`${prefix}help\`\` for available commands`, globalsec);
				return;
			}

			if (args.length == 1) {
				// Basic temperature check
				const temp = await monitor.getCPUTemp();
				const tempStatus = monitor.getTempStatus(temp);

				if (temp === null) {
					sendMessage(msg.channel, `🌡️ **Pi Temperature:** Unable to read temperature`, globalsec);
				} else {
					sendMessage(msg.channel, `🌡️ **Pi Temperature:** ${temp}°C ${tempStatus.emoji} (${tempStatus.status})`, globalsec);
				}
			} else if (args.length == 2 && args[1] === "history") {
				// Temperature history
				const history = await monitor.getTemperatureHistory(6);
				const historyText = monitor.formatTemperatureHistory(history);
				sendMessage(msg.channel, historyText, globalsec * 3);
			} else {
				sendMessage(msg.channel, `Usage: \`\`${prefix}temp\`\` or \`\`${prefix}temp history\`\``, globalsec);
			}
			break;

		case ("monitor"):

			if (required_role.use && !msg.member.roles.cache.find(role => role.name === required_role.name)) {
				sendMessage(msg.channel, `Sorry, you don't have the right privileges. Use \`\`${prefix}help\`\` for available commands`, globalsec);
				return;
			}

			if (args.length != 1) {
				sendMessage(msg.channel, `This command functions without arguments. Please use \`\`${prefix}help\`\``, globalsec);
				return;
			}

			const temp = await monitor.getCPUTemp();
			const tempStatus = monitor.getTempStatus(temp);
			const systemStats = await monitor.getSystemStats();

			let monitorMsg = `📊 **Raspberry Pi Status**\n`;

			if (temp !== null) {
				monitorMsg += `🌡️ Temperature: ${temp}°C ${tempStatus.emoji} (${tempStatus.status})\n`;
			} else {
				monitorMsg += `🌡️ Temperature: Unable to read\n`;
			}

			if (systemStats) {
				if (systemStats.memTotal && systemStats.memUsed) {
					monitorMsg += `💾 Memory: ${systemStats.memUsed}MB / ${systemStats.memTotal}MB (${systemStats.memUsage}%)\n`;
				}
				if (systemStats.uptime) {
					monitorMsg += `⏱️ Uptime: ${systemStats.uptime}\n`;
				}
				if (systemStats.cpuLoad !== undefined) {
					monitorMsg += `🖥️ CPU Load: ${systemStats.cpuLoad}%\n`;
				}
			}

			// Add server status
			monitorMsg += `🖥️ Server Status: ${config.status.toUpperCase()}`;

			sendMessage(msg.channel, monitorMsg, globalsec * 2);
			break;

		case ("dashboard"):

			if (required_role.use && !msg.member.roles.cache.find(role => role.name === required_role.name)) {
				sendMessage(msg.channel, `Sorry, you don't have the right privileges. Use \`\`${prefix}help\`\` for available commands`, globalsec);
				return;
			}

			if (args.length != 1) {
				sendMessage(msg.channel, `This command functions without arguments. Please use \`\`${prefix}help\`\``, globalsec);
				return;
			}

			const dashboardURL = webServer.getURL();
			sendMessage(msg.channel, `📊 **Temperature Dashboard**\nAccess your interactive dashboard here:\n${dashboardURL}\n\n🔥 **Features:**\n• Real-time temperature graphs\n• Historical data analysis\n• Export to CSV\n• Mobile responsive`, globalsec * 3);
			break;

		case ("reload"):

			if (!msg.member.permissions.has('ADMINISTRATOR')) {
				sendMessage(msg.channel, `You dont have the permission to use this command. Use \`\`${prefix}help\`\` for available commands or ask a Staff member for help`, globalsec);
				return;
			}

			if (args.length != 1) {
				sendMessage(msg.channel, `This command functions without arguments. Please use \`\`${prefix}reload\`\``, globalsec);
				return;
			}

			delete require.cache[require.resolve("./config.json")];
			config = require("./config.json");
			loadconfig();

			sendMessage(msg.channel, `The files have been reloaded. :recycle:`, globalsec);

			client.login(token);
			break;

		default:

			sendMessage(msg.channel, `No command found. Use \`\`${prefix}help\`\` for available commands`, globalsec);
			break;
	}
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isButton()) return;
	if (interaction.channel.id !== channelid) return;
	if (required_role.use && !interaction.member.roles.cache.find(role => role.name === required_role.name)) {
		await interaction.reply({ content: `Sorry, du hast keine Berechtigung.`, ephemeral: true });
		return;
	}
	switch (interaction.customId) {
		case 'start':
			if (config.status !== 'off') {
				await interaction.reply({ content: 'Server ist bereits an oder wird gerade gestartet.', ephemeral: true });
				return;
			}
			logActivity('Server wurde gestartet (Button)');
			cp.exec(__dirname + '/shellscripts/post.sh', function (err) {
				if (err) {
					interaction.followUp({ content: `Fehler beim Starten: \`${err}\``, ephemeral: true });
					return;
				}
			});
			config.status = 'posting';
			save(__dirname + '/config.json', config);
			updatePresence();
			afterposton(interaction.channel);
			await interaction.reply({ content: 'Server wird gestartet...', ephemeral: true });
			break;
		case 'stop':
			if (config.status !== 'on') {
				await interaction.reply({ content: 'Server ist bereits aus oder wird gerade heruntergefahren.', ephemeral: true });
				return;
			}
			logActivity('Server wurde heruntergefahren (Button)');
			cp.exec(__dirname + '/shellscripts/shutdown.sh', function (err) {
				if (err) {
					interaction.followUp({ content: `Fehler beim Herunterfahren: \`${err}\``, ephemeral: true });
					return;
				}
			});
			config.status = 'shutting';
			save(__dirname + '/config.json', config);
			updatePresence();
			aftershutoff(interaction.channel);
			await interaction.reply({ content: 'Server wird heruntergefahren...', ephemeral: true });
			break;
		case 'reboot':
			if (config.status !== 'on') {
				await interaction.reply({ content: 'Server ist nicht an.', ephemeral: true });
				return;
			}
			logActivity('Server wurde neugestartet (Button)');
			cp.exec(__dirname + '/shellscripts/reboot.sh', function (err) {
				if (err) {
					interaction.followUp({ content: `Fehler beim Reboot: \`${err}\``, ephemeral: true });
					return;
				}
			});
			config.status = 'rebooting';
			save(__dirname + '/config.json', config);
			updatePresence();
			afterreboot(interaction.channel);
			await interaction.reply({ content: 'Server wird neugestartet...', ephemeral: true });
			break;
		case 'status':
			cp.exec('ping -c 1 ' + serverip, function (err) {
				let statusMsg = err ? 'Server ist aktuell OFFLINE. :octagonal_sign:' : 'Server ist aktuell ONLINE. :white_check_mark:';
				interaction.reply({ content: statusMsg, ephemeral: true });
			});
			break;
		case 'temp':
			const temp = await monitor.getCPUTemp();
			const tempStatus = monitor.getTempStatus(temp);

			if (temp === null) {
				await interaction.reply({ content: `🌡️ **Pi Temperature:** Unable to read temperature`, ephemeral: true });
			} else {
				await interaction.reply({ content: `🌡️ **Pi Temperature:** ${temp}°C ${tempStatus.emoji} (${tempStatus.status})`, ephemeral: true });
			}
			break;
		case 'monitor':
			const monitorTemp = await monitor.getCPUTemp();
			const monitorTempStatus = monitor.getTempStatus(monitorTemp);
			const systemStats = await monitor.getSystemStats();

			let monitorMsg = `📊 **Raspberry Pi Status**\n`;

			if (monitorTemp !== null) {
				monitorMsg += `🌡️ Temperature: ${monitorTemp}°C ${monitorTempStatus.emoji} (${monitorTempStatus.status})\n`;
			} else {
				monitorMsg += `🌡️ Temperature: Unable to read\n`;
			}

			if (systemStats) {
				if (systemStats.memTotal && systemStats.memUsed) {
					monitorMsg += `💾 Memory: ${systemStats.memUsed}MB / ${systemStats.memTotal}MB (${systemStats.memUsage}%)\n`;
				}
				if (systemStats.uptime) {
					monitorMsg += `⏱️ Uptime: ${systemStats.uptime}\n`;
				}
				if (systemStats.cpuLoad !== undefined) {
					monitorMsg += `🖥️ CPU Load: ${systemStats.cpuLoad}%\n`;
				}
			}

			monitorMsg += `🖥️ Server Status: ${config.status.toUpperCase()}`;

			await interaction.reply({ content: monitorMsg, ephemeral: true });
			break;
		case 'temp_history':
			const history = await monitor.getTemperatureHistory(6);
			const historyText = monitor.formatTemperatureHistory(history);
			await interaction.reply({ content: historyText, ephemeral: true });
			break;
		case 'dashboard':
			const dashboardURL = webServer.getURL();
			await interaction.reply({ 
				content: `📊 **Temperature Dashboard**\nAccess your interactive dashboard here:\n${dashboardURL}\n\n🔥 **Features:**\n• Real-time temperature graphs\n• Historical data analysis\n• Export to CSV\n• Mobile responsive`, 
				ephemeral: true 
			});
			break;
		default:
			await interaction.reply({ content: 'Unbekannter Button.', ephemeral: true });
	}
});

// ------------------------

function preoperr(c) {

	if (config.status == "posting") {
		sendMessage(c, `The server is currently posting. :warning:\nPlease wait for the previous operation to finish!`, globalsec);
	}

	else if (config.status == "shutting") {
		sendMessage(c, `The server is currently shutting down. :warning:\nPlease wait for the previous operation to finish!`, globalsec);
	}

	else {
		sendMessage(c, `The server is currently rebooting. :warning:\nPlease wait for the previous operation to finish!`, globalsec);
	}

	return;
}

function afterposton(channel, attempts = 0, maxAttempts = 30, delayMs = 10000) {
	if (attempts >= maxAttempts) {
		config.status = "off";
		save(__dirname + "/config.json", config);
		updatePresence();
		sendMessage(channel, "Der Server antwortet nach " + maxAttempts + " Versuchen nicht auf Ping. Bitte überprüfe die Hardware oder das Netzwerkkabel. :octagonal_sign:", globalsec);
		return;
	}

	cp.exec("ping -c 3 " + serverip, function (err, stdout, stderr) {
		if (err != null) {
			// Optional: Log den Fehler für Debugging
			console.log(`Ping-Versuch ${attempts + 1} fehlgeschlagen:`, stderr || err);

			// Warte und versuche es erneut
			setTimeout(() => afterposton(channel, attempts + 1, maxAttempts, delayMs), delayMs);
			return;
		} else {
			config.status = "on";
			save(__dirname + "/config.json", config);
			updatePresence();
			sendMessage(channel, "Der Post war erfolgreich. Der Server ist online. :white_check_mark:", globalsec);
			
			// Notify webserver of status change
			webServer.notifyPCStatusChange('online');
			return;
		}
	});
}

/*
function afterposton(c) {
	cp.exec("ping -c 3 " + serverip, function(err, stdout, stderr) {
		console.log(stdout);
		console.log(stderr);

		if (err != null) {
			afterposton(c);
			return;
		}

		else {
			config.status = "on";
			save(__dirname + "/config.json", config);
			sendMessage(c, `The post was succesful. The server is online. :white_check_mark:`, globalsec);
			return;
		}
	});
}
*/

function aftershutoff(c) {
	cp.exec("ping -c 3 " + serverip, function (err, stdout, stderr) {
		console.log(stdout);
		console.log(stderr);

		if (err != null) {
			config.status = "off";
			save(__dirname + "/config.json", config);
			updatePresence();
			sendMessage(c, `The shutdown was succesful. The server is offline. :octagonal_sign:`, globalsec);
			
			// Notify webserver of status change
			webServer.notifyPCStatusChange('offline');
			return;
		}

		else {
			aftershutoff(c);
			return;
		}
	});
}

function afterreboot(c) {

	cp.exec("ping -c 3 " + serverip, function (err, stdout, stderr) {
		console.log(stdout);
		console.log(stderr);

		if (err != null) {
			afterrebooton(c);
			return;
		}

		else {
			afterreboot(c);
			return;
		}
	});
}

function afterrebooton(c) {

	cp.exec("ping -c 3 " + serverip, function (err, stdout, stderr) {
		console.log(stdout);
		console.log(stderr);

		if (err != null) {
			afterrebooton(c);
			return;
		}

		else {
			config.status = "on";
			save(__dirname + "/config.json", config);
			updatePresence();
			sendMessage(c, `The reboot was succesful. The server is online. :white_check_mark:`, globalsec);
			
			// Notify webserver of status change
			webServer.notifyPCStatusChange('online');
			return;
		}
	});
}

// ------------------------

function save(fileName, obj) {

	var jsonContent = JSON.stringify(obj);
	fs.writeFile(fileName, jsonContent, 'utf8', function (err) {
		if (err) {
			console.log("An error occured while writing JSON Object to File.");
			return console.log(err);
		}
	});
}

function loadconfig() {

	prefix = config.prefix;
	token = config.token;
	globalsec = config.globalsec;
	channelid = config.channel;
	required_role = config.required_role;
	serverip = config.serverip;
}

async function sendMessage(c, text, sec) {

	c.send(text).then(msg => {
		setTimeout(() => msg.delete(), sec * 1000);
	});
}

// Presence-Update Funktion
async function updatePresence() {
	if (!client.user) return;

	const temp = await monitor.getCPUTemp();
	const tempStatus = monitor.getTempStatus(temp);
	const tempDisplay = temp !== null ? `${temp}°C ${tempStatus.emoji}` : 'N/A';

	if (config.status === "on") {
		client.user.setPresence({
			status: "online",
			activities: [{ name: `PC: AN | Pi: ${tempDisplay}`, type: "WATCHING" }]
		});
	} else if (config.status === "off") {
		client.user.setPresence({
			status: "idle",
			activities: [{ name: `PC: AUS | Pi: ${tempDisplay}`, type: "WATCHING" }]
		});
	} else if (config.status === "posting") {
		client.user.setPresence({
			status: "dnd",
			activities: [{ name: `PC: STARTET... | Pi: ${tempDisplay}`, type: "WATCHING" }]
		});
	} else if (config.status === "shutting") {
		client.user.setPresence({
			status: "dnd",
			activities: [{ name: `PC: FÄHRT RUNTER... | Pi: ${tempDisplay}`, type: "WATCHING" }]
		});
	} else if (config.status === "rebooting") {
		client.user.setPresence({
			status: "dnd",
			activities: [{ name: `PC: REBOOT... | Pi: ${tempDisplay}`, type: "WATCHING" }]
		});
	} else {
		client.user.setPresence({
			status: "idle",
			activities: [{ name: `Status unbekannt | Pi: ${tempDisplay}`, type: "WATCHING" }]
		});
	}
}

// Regelmäßiger Ping-Check alle 2 Stunden
setInterval(() => {
	cp.exec("ping -c 3 " + serverip, function (err) {
		if (err != null) {
			// PC ist aus
			if (config.status !== "off") {
				logActivity('Serverstatus automatisch auf AUS gesetzt (ungeplant)');
				config.status = "off";
				save(__dirname + "/config.json", config);
				updatePresence();
				console.log("[AutoCheck] PC ist aus. Status korrigiert.");
				
				// Notify webserver of status change
				webServer.notifyPCStatusChange('offline');
			}
		} else {
			// PC ist an
			if (config.status !== "on") {
				logActivity('Serverstatus automatisch auf AN gesetzt (ungeplant)');
				config.status = "on";
				save(__dirname + "/config.json", config);
				updatePresence();
				console.log("[AutoCheck] PC ist an. Status korrigiert.");
				
				// Notify webserver of status change
				webServer.notifyPCStatusChange('online');
			}
		}
	});
}, 2 * 60 * 60 * 1000); // alle 2 Stunden

// Temperature monitoring and alerts every 5 minutes
setInterval(async () => {
	const temp = await monitor.getCPUTemp();
	if (temp !== null) {
		// Get system stats for database logging
		const systemStats = await monitor.getSystemStats();
		const tempStatus = monitor.getTempStatus(temp);
		
		// Save temperature to file-based history (existing)
		await monitor.saveTemperatureHistory(temp);
		
		// Save temperature to database (new)
		database.logTemperature(temp, tempStatus.status, systemStats);

		// Check for temperature alerts
		let alertMessage = null;
		let shouldAlert = false;

		if (temp >= 80) {
			alertMessage = `🚨 **CRITICAL TEMPERATURE WARNING**\nPi temperature: ${temp}°C 🔥\nImmediate action required! Check cooling system!`;
			shouldAlert = true;
			logActivity(`Kritische Temperatur erreicht: ${temp}°C`);
		} else if (temp >= 70) {
			alertMessage = `⚠️ **HIGH TEMPERATURE WARNING**\nPi temperature: ${temp}°C 🟠\nConsider checking ventilation and cooling.`;
			shouldAlert = true;
			logActivity(`Hohe Temperatur erreicht: ${temp}°C`);
		}

		// Send alert to channel if needed
		if (shouldAlert && channelid) {
			try {
				const channel = await client.channels.fetch(channelid);
				if (channel && channel.type === "GUILD_TEXT") {
					channel.send(alertMessage);
				}
			} catch (error) {
				console.log('Error sending temperature alert:', error.message);
			}
		}

		// Update presence with current temperature
		updatePresence();

		console.log(`[TempMonitor] Current temperature: ${temp}°C`);
	}
}, 5 * 60 * 1000); // alle 5 Minuten

async function ensureServerControlMessage(channel) {
	let serverControlMessageId = config.serverControlMessageId;
	let message;
	if (serverControlMessageId) {
		try {
			message = await channel.messages.fetch(serverControlMessageId);
		} catch (e) {
			// Nachricht existiert nicht mehr
		}
	}
	const row = new MessageActionRow().addComponents(
		new MessageButton().setCustomId('start').setLabel('Start').setStyle('SUCCESS'),
		new MessageButton().setCustomId('stop').setLabel('Stop').setStyle('DANGER'),
		new MessageButton().setCustomId('reboot').setLabel('Reboot').setStyle('PRIMARY'),
		new MessageButton().setCustomId('status').setLabel('Status').setStyle('SECONDARY')
	);
	const monitorRow = new MessageActionRow().addComponents(
		new MessageButton().setCustomId('temp').setLabel('🌡️ Temp').setStyle('SECONDARY'),
		new MessageButton().setCustomId('monitor').setLabel('📊 Monitor').setStyle('SECONDARY'),
		new MessageButton().setCustomId('temp_history').setLabel('📈 History').setStyle('SECONDARY'),
		new MessageButton().setCustomId('dashboard').setLabel('🌐 Dashboard').setStyle('SECONDARY')
	);
	if (!message) {
		// Sende neue Servercontrol-Nachricht mit Buttons
		let newMsg = await channel.send({
			content: '**SERVERCONTROL & MONITORING**\nHier steuerst du den Server und überwachst das System. Verwende die Buttons unten.',
			components: [row, monitorRow]
		});
		config.serverControlMessageId = newMsg.id;
		save(__dirname + '/config.json', config);
	} else {
		// Stelle sicher, dass die Buttons vorhanden sind
		await message.edit({
			content: '**SERVERCONTROL & MONITORING**\nHier steuerst du den Server und überwachst das System. Verwende die Buttons unten.',
			components: [row, monitorRow]
		});
	}
}

// Logging-Funktion
function logActivity(eventText) {
	const logPath = path.join(__dirname, 'activity.log');
	const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
	const entry = `[${timestamp}] ${eventText}\n`;
	fs.appendFile(logPath, entry, err => {
		if (err) console.error('Fehler beim Schreiben ins Log:', err);
	});
}

client.login(token);
