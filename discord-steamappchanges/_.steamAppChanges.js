const Discord = require('discord.js');
const WebSocket = require('ws');
const childProcess = require('child_process');
const request = require('request');
const fs = require('fs');
const client = new Discord.Client();

const config = require('./config.json');

var ws = undefined;
var appNames = {};

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.once('ready', () => {
	console.log('Getting applist from Steam API');

	request('https://api.steampowered.com/ISteamApps/GetAppList/v2', (err, res, body) => {
		if (err) return console.error(err);

		var json = undefined;
		try {
			json = JSON.parse(body);
		} catch(err) {};

		if (!json || !json.applist || !json.applist.apps || json.applist.apps.length < 1) {
			console.log('Malformed Steam API response\n\n' + body);

			console.log('Using last saved app list');

			if (!fs.existsSync('./apps.json')) return console.log('Could not find apps.json');

			appNames = JSON.parse(fs.readFileSync('./apps.json'));
		} else {
			for (let i = 0; i < json.applist.apps.length; i++) appNames[json.applist.apps[i].appid] = json.applist.apps[i].name;
			fs.writeFileSync('./apps.json', JSON.stringify(appNames, null, 4));

			console.log('Saved applist in apps.json');
		}
		if (!appNames) return console.log('Failed to get apps from Steam API and couldnt get apps.json');

		startChildProcess();
	});
});

client.on('message', async (msg) => {
	if (!msg.guild) return;
	if (msg.author.id !== '138377192278196225') return;

	if (msg.content.match(new RegExp('<@!?(' + client.user.id + ')>'))) {
		msg.channel.send('My prefix is: `' + config.prefix + '`');
		return;
	}

	if (msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'update') {
		var m = await msg.channel.send('Updating app list...');
		var old = Object.keys(appNames).length;

		request('https://api.steampowered.com/ISteamApps/GetAppList/v2', (err, res, body) => {
			if (err) return console.error(err);

			var json = undefined;
			try {
				json = JSON.parse(body);
			} catch(err) {};

			if (!json || !json.applist || !json.applist.apps || json.applist.apps.length < 1) {
				m.edit('Invalid Steam API response');
				return;
			}

			appNames = {};
			for (let i = 0; i < json.applist.apps.length; i++) appNames[json.applist.apps[i].appid] = json.applist.apps[i].name;
			fs.writeFileSync('./apps.json', JSON.stringify(appNames, null, 4));

			m.edit('Successfully updated app list. Old length: ' + old + '. New length: ' + Object.keys(appNames).length);
		});
	} else if (command === 'reboot') {
		await msg.channel.send('Rebooting');
		process.exit(); // Should automatically start up again
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => {
	// There should never be an error unless it is a connection error
	restartWebSocket();

	console.error(error);
});

client.login(config.botToken).catch((e) => console.error(e));

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

function startChildProcess() {
	const child = childProcess.spawn('dotnet', [ config.SteamWebPipes ]);
	child.on('exit', (code, signal) => {
		console.log('Exited with code ' + code + ' - Signal: ' + signal);

		if (process.platform === 'linux') { // Sometimes the childprocess exists but the dotnet process itself is still running. So here we check for it and terminate it
			childProcess.exec('ps -A | grep dotnet', (err, stdout, stderr) => {
				if (err) { // No dotnet process running
					setTimeout(startChildProcess, 5000);
				} else {
					stdout.trim();
					childProcess.exec('kill ' + stdout.split(/\s+/)[0], (err, stdout, stderr) => { // Result is irrelevant
						setTimeout(startChildProcess, 5000);
					});
				}
			});
		} else {
			setTimeout(startChildProcess, 5000);
		}
	});

	var once = false;

	child.stderr.on('data', (data) => {
		if (config.debug) console.log(data.toString());
	});

	child.stdout.on('data', (data) => {
		if (config.debug) console.log(data.toString());

		if (once === false) {
			once = true;
			setTimeout(startWebSocketConnection, 15000);
		}
	});
}

function restartWebSocket() {
	if (ws.readyState === 1) {
		ws.close();

		ws.onclose = () => {
			console.log('Disconnected from WebSocket');

			ws = undefined;

			setTimeout(startWebSocketConnection, 5000);
		};
	} else if (ws.readyState === 2 || ws.readyState === 3) {
		function isConnectionClosed() {
			if (ws.readyState === 3) {
				setTimeout(startWebSocketConnection, 5000);
			} else {
				setTimeout(isConnectionClosed, 1000);
			}
		}
		setTimeout(isConnectionClosed, 1000);
	}
}

function startWebSocketConnection() {
	ws = new WebSocket('ws://127.0.0.1:12903');

	ws.onopen = () => {
		console.log('Successfully connected to WebSocket');
	};

	ws.onerror = (error) => {
		console.error(error);
	};

	ws.onmessage = (e) => {
		if (e.type !== 'message') {
			console.log(e);
			// ???
			return;
		}

		var json = undefined;
		try {
			json = JSON.parse(e.data);
		} catch (err) {};
		if (!json) return console.log(e.data);

		if (json.Type == 'LogOn') {
			console.log('Successfully connected to SteamWebPipes');
			return;
		}

		if (json.Type == 'LogOff') {
			console.log('Disconnected from SteamWebPipes');
			setTimeout(restartWebSocket, 10000);
			return;
		}

		if (client.status !== 0) return;

		if (json.Type === 'UsersOnline') {
			client.user.setPresence({ activity: { name: 'Steam app updates', type: 'WATCHING' }}).catch(() => {});
			return;
		}

		if (json.Type === 'Changelist') {
			const embed = new Discord.MessageEmbed();
			embed.setTimestamp();
			embed.setDescription('Change number: ' + json.ChangeNumber);
			embed.setColor(0);
			embed.setURL('https://steamdb.info/changelist/' + json.ChangeNumber + '/');

			var apps = Object.keys(json.Apps); // We only care about app changes, not package changes
			if (!apps || apps.length < 1) return;

			embed.setTitle(apps.length + ' app ' + (apps.length === 1 ? 'change' : 'changes'));

			var mention = false;
			for (let i = 0; i < apps.length; i++) {
				if (config.watchedApps.includes(apps[i])) mention = true;

				if (i >= 24) {
					embed.addField('And many more!', 'There are a total of ' + apps.length + ' app changes!');

					console.log('Could not add changes for ' + apps[i] + ' because the embed would be too long');
				} else {
					var appName = json.Apps[apps[i]];
					if (appName.includes('Unknown App ' + apps[i])) {
						if (appNames[apps[i]]) {
							appName = appNames[apps[i]];
						}
					}

					embed.addField(apps[i] + ' - ' + appName, '[SteamDB](https://steamdb.info/app/' + apps[i] + '/history/) - [Steam Store](https://store.steampowered.com/app/' + apps[i] + '/)');
				}
			}

			if (mention) embed.setColor([ 0, 255, 0 ]); // Bright green for watched apps

			if (!client.channels.get(config.channel)) return;

			if (mention) client.channels.get(config.channel).send(client.channels.get(config.channel).guild.roles.get(config.mentionRole).toString(), {embed: embed}).catch(() => {});
			else client.channels.get(config.channel).send({embed: embed}).catch(() => {});
			return;
		}

		console.log(e);
	};
}