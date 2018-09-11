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

	// move <Channel to send to> <Message ID to move> [Optional channel where the message is from]
	if (command === 'move') {
		if (!msg.guild.me.permissions.has('MANAGE_CHANNELS')) {
			msg.channel.send('This bot uses webhooks. I need at least Manage Channels permission in order to work with them.');
			return;
		}

		if (!msg.member.permissions.has('MANAGE_MESSAGES')) {
			msg.channel.send('You need at least Manage Messages permission in order to use this command');
			return;
		}

		if (!args[0] || !args[1]) {
			msg.channel.send('Usage: `' + config.prefix + 'move <Channel to send to> <Message ID to move> [Channel where the message is from]`');
			return;
		}

		if (!Discord.MessageMentions.CHANNELS_PATTERN.test(args[0])) {
			msg.channel.send('Invalid channel specified');
			return;
		}

		var toChannel = msg.guild.channels.get(args[0].replace(/<#|>/g, '')); // Makes it easier to get the channels rather than doing the msg.mentions.channels thing
		if (!toChannel) {
			msg.channel.send('Could not find mentioned channel');
			return;
		}

		if (toChannel.type !== 'text') {
			msg.channel.send('Mentioned channel is not a text channel');
			return;
		}

		/*if (!toChannel.permissionsFor(msg.member).has('SEND_MESSAGES')) { // This isn't fully tested and I am too lazy to test it. Uncomment if you want.
			msg.channel.send('You cannot move a message to a channel you cannot send messages to yourself');
			return;
		}*/

		var fromChannel = msg.channel;
		if (args[2]) {
			fromChannel = msg.guild.channels.get(args[2].replace(/<#|>/g, '')); // Makes it easier to get the channels rather than doing the msg.mentions.channels thing
			if (!fromChannel || fromChannel.type !== 'text') fromChannel = msg.channel;
		}

		var m = await msg.channel.send('Moving message...');

		fromChannel.messages.fetch(args[1]).then(async (message) => {
			var wbs = await toChannel.fetchWebhooks();
			if (wbs.size < 1) var wb = await toChannel.createWebhook('Move Message');
			else var wb = wbs.first();

			wb.send(message.content || '', { username: message.author.tag, avatarURL: message.author.avatarURL(), embeds: message.embeds, files: message.attachments.array() }).then(() => {
				m.edit('Moved message from user ' + Discord.Util.escapeMarkdownw(message.author.tag) + ' from ' + fromChannel.toString() + ' to ' + toChannel.toString());
			}).catch((e) => {
				m.edit(e.message || 'Unknown Error');
			})
		}).catch((e) => {
			m.edit(e.message || 'Unknown Error');
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
