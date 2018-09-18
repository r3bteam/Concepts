const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const GlobalOffensive = require('globaloffensive');
const request = require('request');
const Discord = require('discord.js');

const config = require('./config.json');

const discordClient = new Discord.Client();
const steamClient = new SteamUser();
const csgo = new GlobalOffensive(steamClient);

var logonSettings = {
	accountName: config.steam.account.username,
	password: config.steam.account.password
};

if (config.steam.account.sharedSecret && config.steam.account.sharedSecret.length > 5) {
	logonSettings.twoFactorCode = SteamTotp.getAuthCode(config.steam.account.sharedSecret);
	console.log('Generated steam guard code: ' + logonSettings.twoFactorCode);
} else {
	console.log('No shared secret provided');
}

discordClient.on('ready', () => {
	console.log('Ready to spy on ' + discordClient.users.size + ' users, in ' + discordClient.channels.size + ' channels of ' + discordClient.guilds.size + ' servers as ' + discordClient.user.tag + '.');
});

var onGoing = new Map();

discordClient.on('message', async (msg) => {
	if (!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'rank') {
		if (onGoing.has(msg.author.id)) {
			var value = onGoing.get(msg.author.id);
			if ((new Date().getTime() - value.date.getTime()) >= (10 * 60 * 1000)) { // 10 minute timeout
				onGoing.delete(msg.author.id);
			} else {
				msg.channel.send('I am currently in the process of verifying you.');
				return;
			}
		}

		if (!args[0]) {
			msg.channel.send('Please use `' + config.prefix + 'rank <Your Steam Profile Link>` to get yourself a rank');
			return;
		}

		new Promise((resolve, reject) => {
			var check = args[0];
			check = check.replace('http://www.steamcommunity.com/profiles/', '');
			check = check.replace('http://steamcommunity.com/profiles/', '');
			check = check.replace('https://www.steamcommunity.com/profiles/', '');
			check = check.replace('https://steamcommunity.com/profiles/', '');
			check = check.replace('http://www.steamcommunity.com/profiles/', '');
			check = check.replace('steamcommunity.com/profiles/', '');
			check = check.replace(/\//g, '');

			if (/[0-9]{16,18}/.test(check)) {
				request('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=' + config.steam.steamWebAPIKey + '&steamids=' + check, (err, res, body) => {
					if (err) {
						reject(err)
						return;
					}

					var json = undefined;
					try {
						json = JSON.parse(body);
					} catch(e) {};

					if (!json.response || !json.response.players || !Array.isArray(json.response.players) || json.response.players.length < 1) {
						reject('Invalid input');
						return;
					}

					resolve(json.response[0].steamid);
				});
				return;
			}

			check = args[0];
			check = check.replace('http://www.steamcommunity.com/id/', '');
			check = check.replace('http://steamcommunity.com/id/', '');
			check = check.replace('https://www.steamcommunity.com/id/', '');
			check = check.replace('https://steamcommunity.com/id/', '');
			check = check.replace('http://www.steamcommunity.com/id/', '');
			check = check.replace('steamcommunity.com/id/', '');
			check = check.replace(/\//g, '');

			request('https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1?key=' + config.steam.steamWebAPIKey + '&vanityurl=' + check + '&url_type=1', (err, res, body) => {
				if (err) {
					reject(err);
					return;
				}

				var json = undefined;
				try {
					json = JSON.parse(body);
				} catch(e) {};

				if (!json) {
					console.log(body);
					reject('Malformed Steam API Response');
					return;
				}
				
				if (!json.response) {
					console.log(json);
					reject('Malformed Steam API Response');
					return;
				}

				if (json.response.success === 42) {
					reject('No match');
					return;
				}

				if (!json.response.steamid) {
					console.log(json);
					reject('Malformed Steam API Response');
					return;
				}

				resolve(json.response.steamid);
			});
		}).then((steamid) => {
			msg.channel.send({ embed: {
				title: 'Please add me on Steam',
				url: 'https://steamcommunity.com/profiles/' + steamClient.steamID.getSteamID64(),
				color: Discord.Util.resolveColor('orange')
			}}).then((m) => {
				onGoing.set(msg.author.id, { date: new Date(), steamid: steamid, channel: m.channel.id, message: m.id });
			});
		}).catch((err) => {
			if (typeof err === 'string') {
				msg.channel.send({ embed: {
					title: 'Error',
					description: err,
					color: Discord.Util.resolveColor('red')
				}});
			} else {
				console.error(err);

				msg.channel.send({ embed: {
					title: 'Error',
					description: 'Failed to contact Steam API',
					color: Discord.Util.resolveColor('red')
				}});
			}
		});
	}
});

discordClient.on('warn', (warn) => console.warn(warn));
discordClient.on('error', (error) => console.error(error));

// Log into Steam first and then log into Discord
steamClient.logOn(logonSettings);

steamClient.on('loggedOn', (details) => {
	console.log('Successfully logged into ' + steamClient.steamID.getSteamID64());

	steamClient.setPersona(SteamUser.Steam.EPersonaState.Online);
	steamClient.gamesPlayed([ 730 ]) // Start CSGO

	discordClient.login(config.botToken).catch((e) => {
		console.error(e);
		process.exit(1);
	});
});

steamClient.on('friendRelationship', async (sid, relationship) => {
	if (relationship === SteamUser.EFriendRelationship.Friend) {
		var found = undefined;
		onGoing.forEach((value, key) => {
			if (value.steamid === sid.getSteamID64()) {
				found = {};
				found = { discord: key, steam: sid.getSteamID64(), channel: value.channel, message: value.message };
			}
		});
		if (found === undefined) { // This shouldn't really happen
			steamClient.removeFriend(sid);
			return;
		}

		user = discordClient.users.get(found.discord);
		var channel = discordClient.channels.get(found.channel);
		if (!channel) return; // The channel has been deleted while processing the request

		var m = await channel.messages.fetch(found.message).catch(() => {});

		csgo.requestPlayersProfile(found.steam, async (profile) => {
			steamClient.removeFriend(sid);

			if (!channel) return; // We couldn't find the channel the message was written in. Something went wrong

			var member = channel.guild.member(user);
			if (!member) { // The user is no longer in the guild
				onGoing.delete(user.id);
				return;
			}

			// Remove user from onGoing requests list
			onGoing.delete(user.id);

			// Remove all rank roles incase the user has any
			await member.roles.remove(config.ranks).catch(() => {});

			member.roles.add(config.ranks[profile.ranking.rankId]).then(() => {
				if (!m || m.deleted) return;

				m.edit({ embed: {
					title: 'You have been assigned ' + member.guild.roles.get(config.ranks[profile.ranking.rankId]).name,
					color: Discord.Util.resolveColor('green')
				}});
			}).catch((e) => {
				if (!m || m.deleted) return;

				m.edit({ embed: {
					title: 'Failed to assign a role',
					description: e.message || e,
					color: Discord.Util.resolveColor('red')
				}});
			});
		});
	} else if (relationship === SteamUser.EFriendRelationship.RequestRecipient) {
		var found = false;
		onGoing.forEach((value) => {
			if (value.steamid === sid.getSteamID64()) {
				found = true;
			}
		});

		if (found === false) { // We didn't expect a friend request from this user
			steamClient.removeFriend(sid);
			return;
		}

		steamClient.addFriend(sid);
	}
});

discordClient.on('error', (e) => {
	console.error(e);
	process.exit(1);
});

process.on('uncaughtException', (e) => console.error(e));
process.on('unhandledRejection', (e) => console.error(e));
