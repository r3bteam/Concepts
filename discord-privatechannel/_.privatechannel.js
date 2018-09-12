const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

// Force disable "VIEW_CHANNEL" for the role "everyone"
client.on('channelUpdate', (oldChannel, newChannel) => {
	if (!newChannel.guild) return;
	
	if (newChannel.parentID === config.category) {
		if (newChannel.permissionOverwrites.filter(value => value.id === newChannel.guild.id && !value.deny.has('VIEW_CHANNEL')).size >= 1) {
			newChannel.updateOverwrite(newChannel.guild.roles.get(newChannel.guild.id), { VIEW_CHANNEL: false });
		}
	}
});

client.on('message', async (msg) => {
	if (!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'channel') {
		if (msg.guild.channels.filter(value => value.name === msg.author.id).size >= 1) {
			msg.channel.send('You already have a channel for your own use. ' + msg.guild.channels.filter((value) => value.name === msg.author.id).map(value => value.toString()).join(', '));
			return;
		}

		var m = await msg.channel.send('Creating channel...');

		// Use the ID, as the username could include invalid characters which aren't allowed in channel names
		msg.guild.channels.create(msg.author.id, {
			type: 'text',
			parent: msg.guild.channels.get(config.category),
			reason: msg.author.tag + ' (' + msg.author.id + ') requested this channel',
			overwrites:  [
				{
					id: msg.guild.roles.get(msg.guild.id),
					allow: [],
					deny: [ 'VIEW_CHANNEL' ]
				},
				{
					id: msg.member,
					allow: [ 'VIEW_CHANNEL', 'SEND_MESSAGES', 'MANAGE_CHANNELS', 'MANAGE_ROLES' ],
					deny: []
				}
			]
		}).then((channel) => {
			m.edit('I have created a channel for you and your friends! ' + channel.toString());

			channel.send(msg.author.toString() + ', please right click the channel and select `Edit Channel`, then head over to the `Permissions` tab and adjust the permissions for your friends so they can view it aswell.');
		}).catch((err) => {
			m.edit('Failed to create the desired channel. ' + (err.message || 'Unknown Error'));
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
