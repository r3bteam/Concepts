const Discord = require('discord.js');
const client = new Discord.Client();

require('./functions.js')(client);

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'test') {
		var embed = new Discord.MessageEmbed();
		embed.setTimestamp();
		embed.setAuthor(msg.author.tag, msg.author.avatarURL({format: 'png'}));
		embed.setTitle('Test Message');
		msg.channel.send({embed: embed}).then(async (m) => {
			var response = await client.awaitReply(msg.channel, msg.author, 20).catch((err) => {
				embed.setTimestamp();
				embed.setTitle(err);
				m.edit({embed: embed});
			});
			
			embed.setTimestamp();
			embed.setTitle(response.content);
			m.edit({embed: embed});
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (err) => console.error(err));

client.login(config.botToken);