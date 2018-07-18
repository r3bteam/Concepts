const Discord = require('discord.js');
const request = require('request');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.on('message', async (msg) => {
	if (msg.channel.id === config.channel) { // Channel ID
		if (msg.attachments && msg.attachments.size >= 1) {
			msg.attachments.forEach(async (a) => {
				var matches = a.url.match(/\.(png|jpg|webm|gif)$/gi); // url end Matches
				if (!matches || matches.length < 1) return;

				var r = await msg.react('⚙');
				request({
					url: 'https://api.imgur.com/3/upload',
					method: 'POST',
					form: {
						image: a.url,
						type: 'url'
					},
					headers: {
						Authorization: 'Client-ID 3a698dbfb361607',
						Accept: 'application/json'
					}
				}, (error, response, body) => {
					if (error) return console.error(error);

					var json = undefined;
					try {
						json = JSON.parse(body);
					} catch (e) {};
					if (!json) return console.log(body);
					if (json.status !== 200) {
						msg.author.send(json.data.error.message);
						if (msg && msg.deletable) msg.delete();
						else {
							if (!msg) return;

							r.users.remove();
							msg.react('❎');
						}
						return console.log(json);
					}
					msg.author.send(json.data.link);
					if (msg && msg.deletable) msg.delete();
				});
			});
		}
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
