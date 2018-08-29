const request = require('request');
const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'check') {
		if (!args[0]) return msg.channel.send('Usage: ' + config.prefix + 'check <usermention/userid>');

		var m = await msg.channel.send('Checking if user is valid...');

		var userID = undefined;
		if (!userID && /^\d+/g.test(args[0])) userID = args[0];
		if (!userID && new RegExp(msg.mentions.USERS_PATTERN).test(args[0])) userID = msg.mentions.users.first().id;
		if (!userID) return m.edit('Could not find specified user');

		var user = undefined;
		if (!user) user = client.users.get(userID);
		if (!user) user = await client.users.fetch(userID).catch(() => {});
		if (!user) return m.edit('Could not find specified user');

		await m.edit('Getting user profile...').catch((e) => console.error(e));

		request({
			url: 'https://discordapp.com/api/v6/users/' + user.id + '/profile',
			headers: {
				'Authorization': config.userToken // This breaks the Discord ToS & requires the user to share a guild with the user we want the profile of
			}
		}, async (error, response, body) => {
			if (error) {
				console.error(error);
				await m.edit('Failed to get user profile');
				return;
			}

			var json = undefined;
			try {
				json = JSON.parse(body);
			} catch(e) {};

			if (!json) return m.edit('Malformed Discord API response');

			if (!isNaN(json.code) && json.message) {
				if (json.code === 0) return m.edit('Unauthorized - Only user\'s can access user profiles');
				if (json.code === 50001) return m.edit('Not in the same guild as the user we request');

				m.edit('Code: ' + json.code + ' Message: ' + json.message);
				return;
			}

			if (!json.user) return m.edit('Bot\'s are not supported');

			if (!json.connected_accounts || json.connected_accounts.length < 1) return m.edit('User does not have YouTube connected to their Discord account.');

			var channelID = undefined;
			for (let i in json.connected_accounts) {
				if (json.connected_accounts[i].type === 'youtube') {
					if (json.connected_accounts[i].verified === false) {
						m.edit('The YouTube channel has to be verified on Discord');
						return;
					} else {
						channelID = json.connected_accounts[i].id;
						break;
					}
				}
			}
			if (channelID === undefined) {
				m.edit('User does not have YouTube connected to their Discord account.');
				return;
			}

			await m.edit('Getting full user subscriber list...');

			var allSubscriptions = [];
			var nextPageToken = '';

			// The YouTube API limits us to 50 subscribers per request
			function getSubscripers() {
				if (nextPageToken === undefined) {
					if (allSubscriptions.length < 1) {
						m.edit('User is not subscribed to any YouTube channel');
						return;
					}
	
					var foundOurChannel = false;
					for (let i in allSubscriptions) {
						if (allSubscriptions[i].snippet.channelId === config.ourChannelID) {
							foundOurChannel = true;
							break;
						}
					}
	
					// Do the stuff!
					if (foundOurChannel === true) {
						m.edit('✅ User is subscribed to our YouTube channel');
					} else {
						m.edit('❎ User is not subscribed to our YouTube channel');
					}
				} else {
					request('https://www.googleapis.com/youtube/v3/subscriptions?channelId=' + channelID + '&part=snippet%2CcontentDetails&maxResults=50&pageToken=' + nextPageToken + '&key=' + config.googleAPIKey, async (error, response, body) => {
						if (error) {
							console.error(error);
							await m.edit('Failed to get YouTube channel');
							return;
						}
			
						var json = undefined;
						try {
							json = JSON.parse(body);
						} catch(e) {};
			
						if (!json) return m.edit('Malformed YouTube API response');

						if (json.error) {
							if (json.error.code === 403) return m.edit('User has their subscriber list private');
							else return m.edit('Code: ' + json.error.code + '\nMessage: ' + json.error.message);
						}

						for (let i in json.items) {
							allSubscriptions.push(json.items[i]);
						}

						nextPageToken = json.nextPageToken || undefined;
						getSubscripers();
					});
				}
			}
			getSubscripers();
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
