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

	if (command === 'jpeg') {
		var imageURL = undefined;
		if (args[0]) imageURL = args[0];

		if (!imageURL) {
			if (msg.attachments.size < 1) {
				msg.channel.send('Usage: `' + config.prefix + 'jpeg <url/image attachment>`');
			} else {
				imageURL = msg.attachments.first().url;
			}
		}

		var m = await msg.channel.send('Processing...');

		request({
			method: 'POST',
			url: 'http://needsmorejpeg.com/upload',
			formData: {
				image: imageURL
			}
		}, async (error, response, body) => {
			if (error) {
				console.error(error);
				await m.edit('Failed to make request to needsmorejpeg.com');
				return;
			}

			var redirect = body.match(/;url=.+" \/>/);
			if (!redirect || redirect.length < 1) {
				await m.edit('Failed to get redirect URL from needsmorejpeg.com');
				return;
			}

			await m.edit('https://static.needsmorejpeg.com' + redirect[0].replace(/(;url=)|(" \/>)/g, '') + '.jpg');
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);