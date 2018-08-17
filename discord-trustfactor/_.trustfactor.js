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

	if (command === 'trustfactor' || command === 'tf') {
		if (!args[0]) return msg.channel.send('Usage: ' + config.prefix + 'trustfactor <usermention/userid> [custom user token/"false" - Use default user token] ["true" = Add our own member data to the user | Else user might have no member data which will influence the trust score]');

		var userTokenToUse = config.userToken;
		if (args[1] && args[1].toLowerCase() !== 'false') {
			userTokenToUse = args[1];
			if (msg.deletable) await msg.delete();
			await msg.channel.send('Command has been deleted due to a custom token being used.\n\nCommand: `' + config.prefix + command + ' ' + args[0] + ' ' + userTokenToUse.substr(0, 5) + '...' + userTokenToUse.substr((userTokenToUse.length - 5), (userTokenToUse.length - 1)) + (args[2] ? (' ' + args[2]) : '') + '`');
		}

		var newLineZWS = '';
		var prevMessage = await msg.channel.messages.fetch({ limit: 1 }).catch(() => {});
		if (prevMessage && prevMessage.first().author.id === client.user.id) {
			if (new Date(prevMessage.first().createdAt).getUTCHours() !== new Date().getUTCHours()) {
				newLineZWS = String.fromCodePoint(0x200B) + '\n' + String.fromCodePoint(0x200B);
			}
		}

		var customMember = false;
		if (args[2]) {
			if (args[2].toLowerCase() === 'true') {
				customMember = true;
			}
		}

		var m = await msg.channel.send(newLineZWS + 'Checking if user is valid...');

		var userID = undefined;
		if (!userID && /^\d+/g.test(args[0])) userID = args[0];
		if (!userID && new RegExp(msg.mentions.USERS_PATTERN).test(args[0])) userID = msg.mentions.users.first().id;
		if (!userID) return m.edit(newLineZWS + 'Could not find specified user');

		var user = undefined;
		if (!user) user = client.users.get(userID);
		if (!user) user = await client.users.fetch(userID).catch(() => {});
		if (!user) return m.edit(newLineZWS + 'Could not find specified user');

		await m.edit(newLineZWS + 'Getting user profile...').catch((e) => console.error(e));

		var trustFactorFactors = {
			user: {
				connectedAccounts: undefined,
				createdAt: undefined,
				avatar: undefined,
				premiumSince: undefined,
				flags: undefined,
				bot: undefined
			},
			member: {
				lastMessage: {
					channel: undefined,
					id: undefined
				},
				joinedAt: undefined,
				displayColor: undefined,
				serverDeaf: undefined,
				serverMute: undefined,
				permissions: undefined
			}
		};

		request({
			url: 'https://discordapp.com/api/v6/users/' + user.id + '/profile',
			headers: {
				'Authorization': userTokenToUse // This breaks the Discord ToS & requires the user to share a guild with the user we want the profile of
			}
		}, async (error, response, body) => {
			if (error) {
				console.error(error);
				await m.edit(newLineZWS + 'Failed to get user profile');
				return;
			}

			var json = undefined;
			try {
				json = JSON.parse(body);
			} catch(e) {};

			if (!json) return m.edit(newLineZWS + 'Malformed API response');

			if (!isNaN(json.code) && json.message) {
				if (json.code === 0) return m.edit(newLineZWS + 'Unauthorized - Only user\'s can access user profiles');
				if (json.code === 50001) return m.edit(newLineZWS + 'Not in the same guild as the user we request');

				m.edit(newLineZWS + 'Code: ' + json.code + ' Message: ' + json.message);
				return;
			}

			if (!json.user) return m.edit(newLineZWS + 'Bot\'s are not currently supported');

			trustFactorFactors.user.flags = json.user.flags;

			trustFactorFactors.user.premiumSince = new Date(json.premium_since).getTime();

			var verifiedAccounts = 0;
			for (let i = 0; i < json.connected_accounts.length; i++) if (json.connected_accounts[i].verified) verifiedAccounts++;
			trustFactorFactors.user.connectedAccounts = verifiedAccounts;

			trustFactorFactors.user.createdAt = user.createdTimestamp;
			trustFactorFactors.user.bot = user.bot;
			trustFactorFactors.user.avatar = user.avatar;

			var member = undefined;
			if (!args[2] || args[2].toLowerCase() !== 'false') member = msg.guild.member(user);
			if (!member && customMember) member = msg.member;

			if (member) {
				trustFactorFactors.member.displayColor = member.displayHexColor;
				trustFactorFactors.member.joinedAt = member.joinedTimestamp;
				trustFactorFactors.member.lastMessage.channel = member.lastMessageChannelID;
				trustFactorFactors.member.lastMessage.id = member.lastMessageID;
				trustFactorFactors.member.permissions = member.permissions;
				trustFactorFactors.member.serverDeaf = member.serverDeaf;
				trustFactorFactors.member.serverMute = member.serverMute;
			}

			var calculated = {
				user: {
					connectedAccounts: 0,
					createdAt: 0,
					avatar: 0,
					premiumSince: 0,
					flags: 0,
					bot: 0
				},
				member: {
					lastMessage: 0,
					joinedAt: 0,
					displayColor: 0,
					serverDeaf: 0,
					serverMute: 0,
					permissions: 0
				}
			}

			// User
			calculated.user.connectedAccounts = parseFloat(trustFactorFactors.user.connectedAccounts * 5); // 1 verified account is worth 10 score
			calculated.user.createdAt = parseInt(Math.round((new Date().getTime() - trustFactorFactors.user.createdAt) / 1000 / 60 / 60 / 24)); // The higher the number the older the account

			calculated.user.avatar = (trustFactorFactors.user.avatar ? 100 : 0); // A custom avatar is barely worth anything

			calculated.user.premiumSince = (trustFactorFactors.user.premiumSince ? parseInt(Math.round((new Date().getTime() - trustFactorFactors.user.premiumSince) / 1000 / 60 / 60 / 24)) : 0); // The higher the number the longer the user has been premium for

			var bits = trustFactorFactors.user.flags.toString(2).split('').reverse();
			console.log(bits);

			// Some flag descriptions may be inaccurate. 
			if (bits[0] === '1') calculated.user.flags = 100; // Discord Staff
			else if (bits[1] === '1') calculated.user.flags = 75; // Partner
			else if (bits[3] === '1') calculated.user.flags = 75; // Bug Hunter - Usually did a lot of work for Discord
			else if (bits[2] === '1') calculated.user.flags = 25; // Hypesquad (Anyone can get into hypesquad)
			else if (bits[4] === '1') calculated.user.flags = 25; // Custodian - Unused
			else if (bits[5] === '1') calculated.user.flags = 10; // Unknown flag (Literally no idea what this is)
			else if (bits[6] === '1') calculated.user.flags = 10; // HypeSquad house (Bravery?) - Technically not needed since user also has normal Hypesquad
			else if (bits[7] === '1') calculated.user.flags = 10; // HypeSquad house (Brilliance?) - Technically not needed since user also has normal Hypesquad
			else if (bits[8] === '1') calculated.user.flags = 10; // HypeSquad house (Balance?) - Technically not needed since user also has normal Hypesquad
			else if (bits[9] === '1') calculated.user.flags = 10; // Unknown flag - Doesn't exist (yet?)
			else if (bits[10] === '1') calculated.user.flags = 10; // Unknown flag - Doesn't exist (yet?)
			else calculated.user.flags = 0; // User has no flags

			calculated.user.bot = (trustFactorFactors.user.bot ? 100 : 0); // Bots are a tiny bit more trusted than users

			// Member
			if (member) {
				if (client.channels.get(trustFactorFactors.member.lastMessage.channel)) {
					var lastMsg = await client.channels.get(trustFactorFactors.member.lastMessage.channel).messages.fetch(trustFactorFactors.member.lastMessage.id).catch(() => {});
					if (lastMsg) calculated.member.lastMessage = parseFloat(Math.round((new Date().getTime() - lastMsg.createdTimestamp) / 1000 / 60 / 60)); // The higher the number the older the last message - If the last message got deleted it will be invalid here and it will be like we never wrote a message
				}

				calculated.member.joinedAt = Math.round((new Date().getTime() - trustFactorFactors.member.joinedAt) / 1000 / 60 / 60 / 24); // The higher the number the longer the member has been in this guild
				calculated.member.displayColor = (trustFactorFactors.member.displayColor ? 100 : 0); // 100 or 0 if we have a custom color - Doesnt matter a lot
				calculated.member.serverDeaf = (trustFactorFactors.member.serverDeaf ? 0 : 100); // 100 if we are not server deafened
				calculated.member.serverMute = (trustFactorFactors.member.serverMute ? 0 : 100); // 100 if we are not server muted
				calculated.member.permissions = 0; // I don't really know what to do with this so I just set it to 0
			}

			// Calculate the trust for each option
			var add = [];
			var subtract = [];
			add.push(parseFloat(calculated.user.connectedAccounts / 1)); // Doesn't really matter
			add.push(parseFloat(calculated.user.createdAt / 30)); // Make it matter a little more, the default value is very low
			add.push(parseFloat(calculated.user.avatar / 50)); // Barely matters at all
			add.push(parseFloat(calculated.user.premiumSince / 30)); // Make it matter more, the default value is very low
			add.push(parseFloat(calculated.user.flags / 2)); // Already calculated at the top
			add.push(parseFloat(calculated.user.bot / 20)); // Barely matters at all
			subtract.push(parseFloat(calculated.member.lastMessage / 12)); // Subtract this
			add.push(parseFloat(calculated.member.joinedAt / 30)); // Make it matter a little more, the default value is very low
			add.push(parseFloat(calculated.member.displayColor / 100)); // Barely matters at all
			add.push(parseFloat(calculated.member.serverDeaf / 50)); // Matters only a bit
			add.push(parseFloat(calculated.member.serverMute / 50)); // Matters only a bit
			add.push(parseFloat(calculated.member.permissions / 1)); // Don't know what to do with this and the permissions is 0 anyways

			var trustscore = 0; // Add up the trust score
			for (let i = 0; i < add.length; i++) if (!isNaN(add[i])) trustscore += add[i];
			for (let i = 0; i < subtract.length; i++) if (!isNaN(subtract[i])) trustscore -= subtract[i];

			// Generate color
			var perc = parseFloat(trustscore);

			var r = 0;
			var g = 0;
			var b = 0;

			if (perc > 100) perc = 100;
			if (perc < 0) perc = 0;

			if (perc < 50) {
				r = 255;
				g = Math.round(5.1 * perc);
			} else {
				g = 255;
				r = Math.round(510 - 5.10 * perc);
			}
			var h = r * 0x10000 + g * 0x100 + b * 0x1;
			var hex = '#' + ('000000' + h.toString(16)).slice(-6);
			var url = 'https://via.placeholder.com/800x800/' + hex.replace('#', '') + '/' + hex.replace('#', '');

			// Send final edit
			const embed = new Discord.MessageEmbed();
			embed.addField('Default', '```JSON\n' + JSON.stringify(calculated, null, 4) + '```');
			embed.addField('Adds', '```JSON\n' + JSON.stringify(add, null, 4) + '```');
			embed.addField('Subtracts', '```JSON\n' + JSON.stringify(subtract, null, 4) + '```');
			embed.setThumbnail(url);
			embed.setColor(hex);
			embed.setTitle('The calculated Trust Score for ' + Discord.Util.escapeMarkdown(user.tag) + ' is ' + trustscore + ' (' + parseFloat(perc).toFixed(2) + '%)');
			m.edit(newLineZWS, { embed: embed });
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
