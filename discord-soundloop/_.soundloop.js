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
	
	if (command === 'join') {
		if (!args[0]) return msg.channel.send(config.prefix + 'join <user mention>');
		if (!msg.mentions || msg.mentions.members.size < 1) return msg.channel.send(config.prefix + 'join <user mention>');

		var userToJoin = msg.mentions.members.first();
		if (!userToJoin.voice.channel) return msg.channel.send('User is not in a voice channel');
		if (!userToJoin.voice.channel.joinable) return msg.channel.send('I cannot join that voice channel');

		var m = await msg.channel.send('Joining...');

		userToJoin.voice.channel.join().then((connection) => {
			var stream = connection.receiver.createStream(userToJoin.user, { end: 'manual', mode: 'opus' });
			connection.play(stream, { type: 'opus' });

			stream.on('end', async () => {
				connection.disconnect();

				m.edit('Ended playback');
			});

			const filter = m => m.author.id === msg.author.id && m.content.startsWith(config.prefix + 'stop');
			const collector = msg.channel.createMessageCollector(filter, { max: 1 });
			collector.on('collect', (m) => {
				stream.destroy();
				if (!collector.ended) collector.stop();
				if (m.deletable) m.delete();
			});

			var interval = setInterval(() => {
				if (!userToJoin.voice.channel || userToJoin.voice.channelID !== msg.guild.me.voice.channelID) {
					clearInterval(interval);
					stream.destroy();
					if (!collector.ended) collector.stop();
				}
			}, 1);

			m.edit('Listening... ' + msg.author.tag + ' can use `' + config.prefix + 'stop` to stop the playback');
		});
	}
});

client.on('warn', (warn) => console.error(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
