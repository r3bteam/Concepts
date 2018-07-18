const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers.');
});

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'test') {
		const m = await msg.channel.send('Fetching all messages...');

		let messages = await msg.channel.messages.fetch({limit: 100});
		if (!messages) return m.edit('Well something broke...');
		var allMessages = messages;

        function fetchMsgs() {
			msg.channel.messages.fetch({before: allMessages.last().id, limit: 100}).then(async (messages) => {
				if (messages.size < 1) {
					m.edit('Done fetching all ' + allMessages.size + ' messages');

					// Do stuff here
				} else {
					await m.edit('Fetching all messages...\n\nFetched ' + messages.size + ' messages\nTotal: ' + allMessages.size);

					allMessages = allMessages.concat(messages);
					fetchMsgs();
				}
			}).catch((err) => {
				console.error(err);
				m.edit('Well something broke...');
			});
		}
		
		fetchMsgs();
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (err) => console.error(err));

client.login(config.botToken);