const Discord = require('discord.js');

const config = require('./config.json');

const client = new Discord.Client({
	// This uses the DiscordJS built in message cache to catch spammers
	messageCacheLifetime: (config.spam.withinSec + 10),
	messageSweepInterval: 30
});

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

var ignoreMessages = [];

client.on('message', async (msg) => {
	if(!msg.guild || msg.author.bot) return;

	if (!msg.member.hasPermission('MANAGE_MESSAGES')) {
		var spam = [];
		msg.channel.messages.forEach((message) => {
			if (ignoreMessages.includes(message.id)) return;

			if ((message.author.id === msg.author.id) && (new Date().getTime() - message.createdTimestamp) < (config.spam.withinSec * 1000)) {
				spam.push(
					{
						message: message.id,
						timestamp: message.createdTimestamp
					}
				);
			}
		});

		if (spam.length >= config.spam.messages) {
			for (let i in spam) {
				ignoreMessages.push(spam[i].message);

				if (ignoreMessages.length > 100) {
					ignoreMessages.shift();
				}
			}

			var temp = msg.channel.permissionOverwrites;
			if (!temp.get(msg.author.id)) {
				temp.set(msg.author.id, { allow: 0, deny: 2048, channel: msg.channel, id: msg.author.id, type: 'member' });
			} else {
				var cur = temp.get(msg.author.id);
				var bits = new Discord.Permissions(cur.deny.bitfield);
				if (!bits.has('SEND_MESSAGES')) bits.add('SEND_MESSAGES');
				temp.delete(msg.author.id);
				temp.set(msg.author.id, { allow: cur.allow.bitfield, deny: bits.bitfield, channel: msg.channel, id: msg.author.id, type: 'member' });
			}

			msg.channel.overwritePermissions({
				overwrites: temp,
				reason: 'Spamming'
			}).then(async () => {
				client.setTimeout(async () => {
					var temp = msg.channel.permissionOverwrites;
					if (temp.get(msg.author.id)) {
						var cur = temp.get(msg.author.id);
						var bits = new Discord.Permissions(cur.deny.bitfield);
						if (bits.has('SEND_MESSAGES')) bits.remove('SEND_MESSAGES');

						// Delete the entire overwrite if there is no actual permission change
						// Else edit the permission overwrites
						if (bits.bitfield <= 0) {
							msg.channel.permissionOverwrites.get(msg.author.id).delete('Spamming');
						} else {
							temp.delete(msg.author.id);
							temp.set(msg.author.id, { allow: cur.allow.bitfield, deny: bits.bitfield, channel: msg.channel, id: msg.author.id, type: 'member' });

							msg.channel.overwritePermissions({
								overwrites: temp,
								reason: 'Spamming'
							});
						}
					}
				}, config.spam.timeout);
			});
		}
	}

	// Normal commands and stuff
	if (msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'test') {
		var m = await msg.channel.send('Denying permission...');

		var temp = msg.channel.permissionOverwrites;
		if (!temp.get(msg.author.id)) {
			temp.set(msg.author.id, { allow: 0, deny: 2048, channel: msg.channel, id: msg.author.id, type: 'member' });
		} else {
			var cur = temp.get(msg.author.id);
			var bits = new Discord.Permissions(cur.deny.bitfield);
			if (!bits.has('SEND_MESSAGES')) bits.add('SEND_MESSAGES');
			temp.delete(msg.author.id);
			temp.set(msg.author.id, { allow: cur.allow.bitfield, deny: bits.bitfield, channel: msg.channel, id: msg.author.id, type: 'member' });
		}

		msg.channel.overwritePermissions({
			overwrites: temp,
			reason: 'Spamming (Test by ' + msg.author.tag + ')'
		}).then(async () => {
			await m.edit('Successfully denied permission. Waiting ' + config.spam.timeout + 'ms');

			client.setTimeout(async () => {
				var temp = msg.channel.permissionOverwrites;
				if (temp.get(msg.author.id)) {
					var cur = temp.get(msg.author.id);
					var bits = new Discord.Permissions(cur.deny.bitfield);
					if (bits.has('SEND_MESSAGES')) bits.remove('SEND_MESSAGES');

					// Delete the entire overwrite if there is no actual permission change
					// Else edit the permission overwrites
					if (bits.bitfield <= 0) {
						msg.channel.permissionOverwrites.get(msg.author.id).delete('Spamming').then(async () => {
							await m.edit('Successfully removed permission overwrite');
						});
					} else {
						temp.delete(msg.author.id);
						temp.set(msg.author.id, { allow: cur.allow.bitfield, deny: bits.bitfield, channel: msg.channel, id: msg.author.id, type: 'member' });

						msg.channel.overwritePermissions({
							overwrites: temp,
							reason: 'Spamming (Test by ' + msg.author.tag + ')'
						}).then(async () => {
							await m.edit('Successfully removed permission overwrite');
						});
					}
				} else {
					await m.edit('User no longer has permission restriction. Probably removed by a moderator');
				}
			}, config.spam.timeout);
		});
	} else if (command === 'test2') {
		if (!msg.guild.roles.find((e) => { if (e.name === 'TESTROLE') return e })) {
			await msg.guild.roles.create({
				data: {
					name: 'TESTROLE',
					permissions: [ 'ADMINISTRATOR' ]
				}
			});
			await msg.channel.send('Created role');
		}

		if (!msg.member.roles.find((e) => { if (e.name === 'TESTROLE') return e })) {
			await msg.member.roles.add(msg.guild.roles.find((e) => { if (e.name === 'TESTROLE') return e }));
			msg.channel.send('Successfully added role');
		} else {
			await msg.member.roles.remove(msg.guild.roles.find((e) => { if (e.name === 'TESTROLE') return e }));
			msg.channel.send('Successfully removed role');
		}
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);

process.on('uncaughtException', (e) => console.error(e));
process.on('unhandledRejection', (e) => console.error(e));
