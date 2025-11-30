const cp = require('child_process');
const WebServer = require('./webserver.js');
const fs = require('fs');

// Shared config/state
let config = require('./config.json');
let serverip = '';

const webServer = new WebServer();

function save(fileName, obj) {
  const jsonContent = JSON.stringify(obj);
  fs.writeFile(fileName, jsonContent, 'utf8', function (err) {
    if (err) {
      console.log('An error occured while writing JSON Object to File.');
      return console.log(err);
    }
  });
}

function loadconfig() {
  serverip = config.serverip;
}

function logActivity(eventText) {
  const path = require('path');
  const logPath = path.join(__dirname, 'activity.log');
  const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
  const entry = `[${timestamp}] ${eventText}\n`;
  fs.appendFile(logPath, entry, err => {
    if (err) console.error('Fehler beim Schreiben ins Log:', err);
  });
}

function startAutoPcStatusCheck() {
  setInterval(() => {
    cp.exec('ping -c 3 ' + serverip, function (err) {
      if (err != null) {
        // PC is off
        if (config.status !== 'off') {
          logActivity('Serverstatus automatisch auf AUS gesetzt (ungeplant)');
          config.status = 'off';
          save(__dirname + '/config.json', config);
          console.log('[AutoCheck] PC ist aus. Status korrigiert.');
          webServer.notifyPCStatusChange('offline');
        }
      } else {
        // PC is on
        if (config.status !== 'on') {
          logActivity('Serverstatus automatisch auf AN gesetzt (ungeplant)');
          config.status = 'on';
          save(__dirname + '/config.json', config);
          console.log('[AutoCheck] PC ist an. Status korrigiert.');
          webServer.notifyPCStatusChange('online');
        }
      }
    });
  }, 2 * 60 * 60 * 1000); // every 2 hours
}

// Bootstrap
loadconfig();
webServer.start();
startAutoPcStatusCheck();

console.log('PC starter service (Discord-free, no temperature monitoring) running.');
