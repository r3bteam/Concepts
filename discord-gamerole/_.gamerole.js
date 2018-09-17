const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');

	var guild = client.guilds.get(config.guild);
	client.users.forEach((u) => {
		var member = guild.member(u);
		if (!member) return;

		var giveRole = false;
		if (u.presence && u.presence.activity) {
			if (/^\d{17,19}$/.test(config.game)) {
				if (u.presence.activity.applicationID === config.game) {
					giveRole = true;
				}
			} else {
				if (u.presence.activity.name === config.game) {
					giveRole = true;
				}
			}
		}

		if (giveRole) {
			member.roles.add(config.gameRole);
		} else {
			member.roles.remove(config.gameRole);
		}
	});
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
	var guild = client.guilds.get(config.guild);

	var member = guild.member(newPresence.user);
	if (!member) return;

	var giveRole = false;
	if (newPresence && newPresence.activity) {
		if (/^\d{17,19}$/.test(config.game)) {
			if (newPresence.activity.applicationID === config.game) {
				giveRole = true;
			}
		} else {
			if (newPresence.activity.name === config.game) {
				giveRole = true;
			}
		}
	}

	if (giveRole) {
		member.roles.add(config.gameRole);
	} else {
		member.roles.remove(config.gameRole);
	}
});

client.on('message', async (msg) => {
	if (!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'current') {
		try {
			msg.channel.send({embed: {
				title: 'Your current presence status',
				description: 'Name: ' + Discord.Util.escapeMarkdown(msg.author.presence.activity.name) + '\nID: ' + msg.author.presence.activity.applicationID
			}}).catch(() => {});
		} catch(e) {
			msg.channel.send('You are currently not playing anything');
		}
	}
});

client.login(config.botToken).then(() => {
	if (config && !config.owner) {
		client.fetchApplication().then((r) => {
			config.owner = r.owner;
		}).catch((e) => console.error(e));
	}
});

process.on('uncaughtException', (e) => console.error(e));
process.on('unhandledRejection', (e) => console.error(e));
