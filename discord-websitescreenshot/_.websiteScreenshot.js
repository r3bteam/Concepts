const webshot = require('webshot');
const Discord = require('discord.js');
const client = new Discord.Client();

const fs = require('fs');

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'capture') {
		if (!args[0]) return msg.channel.send('Enter URL');

		var m = await msg.channel.send('Taking screenshot...');

		webshot(args[0], './tempPictures/' + msg.guild.id + '_' + msg.id + '.png', function (err) {
			if (err) {
				m.edit('Request errored - Entered URL probably invalid');
				return console.error(err);
			}

			m.edit('Finished taking screenshot. Uploading...').then(async (m) => {
				const attachment = new Discord.MessageAttachment('./tempPictures/' + msg.guild.id + '_' + msg.id + '.png');
				await m.channel.send('<' + args[0] + '>', attachment);
				await m.delete();
				fs.unlinkSync('./tempPictures/' + msg.guild.id + '_' + msg.id + '.png');
			});
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
