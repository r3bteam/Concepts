const request = require('request');
const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.doingRequest = [];

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'acc') {
		if (client.doingRequest.includes(msg.author.id)) {
			msg.channel.send('I am already generating an account for you');
			return;
		}

		client.doingRequest.push(msg.author.id);

		var main = await msg.channel.send('Processing...');

		var m = await msg.author.send('Generating account...').catch(() => {
			main.edit('Failed to DM you');
			client.doingRequest.splice(client.doingRequest.indexOf(msg.author.id), 1);
		});
		if (!m) return;

		main.edit('I have sent you a DM');

		request({
			method: 'POST',
			url: 'https://toxic.gq/steam/api',
			body: JSON.stringify({ new: 1 })
		}, async (error, response, body) => {
			if (error) {
				console.error(error);
				await m.edit('Failed to make API request to toxic.gq/steam');
				client.doingRequest.splice(client.doingRequest.indexOf(msg.author.id), 1);
				return;
			}

			var json = undefined;
			try {
				json = JSON.parse(body);
			} catch(e) {};

			if (!json) {
				console.error(body);
				await m.edit('Failed to make API request to toxic.gq/steam');
				client.doingRequest.splice(client.doingRequest.indexOf(msg.author.id), 1);
				return;
			}

			if (json.success !== 1) {
				console.log(json);
				await m.edit('Failed to generate account\n\nError Message: ```\n' + Discord.Util.escapeMarkdown(json.error) + '```');
				client.doingRequest.splice(client.doingRequest.indexOf(msg.author.id), 1);
				return;
			}

			await m.edit('Please solve the following captcha: <' + json.url + '>', { embed: { image: { url: json.url }}});

			const filter = reply => reply.author.id === msg.author.id; 
			m.channel.awaitMessages(filter, { max: 1, time: 60000 }).then(async (reply) => {
				var reply = reply.first();
				if (!reply.content || reply.content.length < 3) {
					await m.edit('Invalid captcha response - Cancelled account creation');
					client.doingRequest.splice(client.doingRequest.indexOf(msg.author.id), 1);
					return;
				}

				await m.edit('Please wait... This can take up to 1 minute', { embed: {}});

				request({
					method: 'POST',
					url: 'https://toxic.gq/steam/api',
					body: JSON.stringify({ token: json.token, solution: reply.content })
				}, async (error, response, body) => {
					if (error) {
						console.error(error);
						await m.edit('Failed to make API request to toxic.gq/steam');
						client.doingRequest.splice(client.doingRequest.indexOf(msg.author.id), 1);
						return;
					}

					var json = undefined;
					try {
						json = JSON.parse(body);
					} catch(e) {};

					if (!json) {
						console.error(body);
						await m.edit('Failed to make API request to toxic.gq/steam');
						client.doingRequest.splice(client.doingRequest.indexOf(msg.author.id), 1);
						return;
					}

					if (json.success !== 1) {
						if (json.error !== 'Wrong Captcha') console.log(json);

						await m.edit('Failed to generate account\n\nError Message: ```\n' + Discord.Util.escapeMarkdown(json.error) + '```');
						client.doingRequest.splice(client.doingRequest.indexOf(msg.author.id), 1);
						return;
					}

					await m.edit('**Successfully created account**\n\n```\nUsername: ' + Discord.Util.escapeMarkdown(json.username) + '\nPassword: ' + Discord.Util.escapeMarkdown(json.password) + '\nEmail: ' + Discord.Util.escapeMarkdown(json.email) + '```');
					client.doingRequest.splice(client.doingRequest.indexOf(msg.author.id), 1);
				});
			}).catch(async () => {
				await m.edit('Did not get a response from you within 60 seconds - Cancelled account creation');
				client.doingRequest.splice(client.doingRequest.indexOf(msg.author.id), 1);
			});
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);