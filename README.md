# dc-rpi-remote-pc-start
bridge between discord and a raspberry pi to hardware post a connected computer

## Requirements
You need NodeJS and NPM installed. On newer Raspbian versions you will need to install WiringPi manually.

# Hardware Installation
1 coming soon...

# Software Installation
1 Start by cloning the repository and installing the packages
```
git clone https://github.com/King007t/dc-rpi-remote-pc-start.git
cd dc-rpi-remote-pc-start
npm install
```
2 to be able to connect to a Discord server you will need a bot token.
[Here's a guide](#0) on how to get a token. Store your token as a string called `token` inside `config.json`. Fill out the rest of your config file too. 

Your config file (config.json) will look something like this:
```
{
	"prefix":"!",			//prefix for recognition of bot commands
	"token":"random_characters",	//discord bot token to connect to
	"globalsec":"5",		//seconds a message from the bot will be displayed
	"status":"off",			//current status of the server "off" or "on"
	"channel":"",			//can be left blank (can be added by sending the **setchannel** command into the desired channel)
	"serverip":"0.0.0.0",		//local ip adress of the computer to be controlled
	"required_role": {
		"use":true,		//true or false defines if a role is required to use the bot
		"name":"ServerManager"	//name of the required role
	}
}
```

3 Start the bot by running the following command within the dc-rpi-remote-pc-start directory
```
node index.js
```
**OR** Make the bot run in the background and on system startup by creating a systemd service

Step 1: Create a new systemd service for dc-rpi-remote-pc-start
```
sudo nano /lib/systemd/system/dc-rpi-remote-pc-start.service 
```

Step 2: Paste the following content and replace User and Group with your own username
```
[Unit]
Description=dc-rpi-remote-pc-start
[Service]
Type=simple
Restart=on-failure
RestartSec=5
StartLimitInterval=60s
StartLimitBurst=3
User=[username]
Group=[username]
Environment=TERM=xterm
ExecStart=node /home/[username]/dc-rpi-remote-pc-start/
ExecReload=/bin/kill -s HUP $MAINPID
ExecStop=/bin/kill -s TERM $MAINPID
[Install]
WantedBy=multi-user.target
```

Step 3: Press Ctrl + x,y (to save), Enter (to save with the same name)

Step 4: Enable the new dc-rpi-remote-pc-start service (optional but will make the bot start on boot)
```
sudo systemctl enable dc-rpi-remote-pc-start.service
```

Step 5: Reload the Systemd Daemon (Do this every time you modify a server file)
```
sudo systemctl daemon-reload
```

Step 6: start the dc-rpi-remote-pc-start service. You can use start, stop, restart or status. You don't have to run it manually again if it's enabled to start on boot (Step 4).
```
sudo systemctl start dc-rpi-remote-pc-start.service
```

## Available commands
_NOTE! The default prefix is !. The prefix must be used before the command for it to work._

COMMANDS FOR SET ROLE
* **post** - turns the connected computer on
* **reboot** - reboots the connected computer
* **shutdown** - turns the connected computer off safely
* **status** - tells if the connected computer is turned on or off

COMMANDS FOR ADMINISTRATOR
* **force-shutdown** - forces the connected computer to turn off instantly
* **setchannel** - will set bot command channel to current channel
* **reload** - reload all external configuration files
* **ping** - pings the provided ip adress
