const country = require('country-emoji');
const translate = require('google-translate-api');
const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.on('messageReactionAdd', (reaction, user) => {
	var translateTo = country.code(reaction.emoji.name);
	if (translateTo === undefined || typeof translateTo !== 'string') return;
	if (!reaction.message.content || reaction.message.content.length < 1) return;

	if ([ 'GB', 'US' ].includes(translateTo)) translateTo = 'EN';

	translate(reaction.message.content, { to: translateTo }).then((res) => {
		const embed = new Discord.MessageEmbed();
		embed.setAuthor(user.tag, user.avatarURL());
		embed.setColor(0);
		embed.setTitle('Translated from ' + res.from.language.iso.toUpperCase() + ' to ' + translateTo.toUpperCase() + (res.from.text.autoCorrected ? ' [AUTO CORRECTED]' : ''));
		embed.setDescription(res.text);
		reaction.message.channel.send({ embed: embed });
	}).catch((err) => {
		if (err.code === 400) {
			const embed = new Discord.MessageEmbed();
			embed.setAuthor(user.tag, user.avatarURL());
			embed.setColor(0);
			embed.setTitle('Google Translate does not support this language');
			reaction.message.channel.send({ embed: embed });
			return;
		}

		console.error(err);
		reaction.message.channel.send(JSON.stringify(err, null, 4), { split: true, code: 'JSON' });
	});
});

client.on('message', async (msg) => {
	if (!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'translate' || command === 't') {
		if (!args[0]) {
			msg.channel.send('Usage: `' + config.prefix + 'translate <text>`\n\nOptional flags (They dont work yet):\n`--input (-i):` 2-char language code of the input language (Default: auto)\n`--output (-o):` 2-char language code of the output language (Default: en)');
			return;
		}

		translate(args.join(' '), { to: 'en' }).then((res) => {
			const embed = new Discord.MessageEmbed();
			embed.setAuthor(msg.author.tag, msg.author.avatarURL());
			embed.setColor(0);
			embed.setTitle('Translated from ' + res.from.language.iso.toUpperCase() + ' to EN' + (res.from.text.autoCorrected ? ' [AUTO CORRECTED]' : ''));
			embed.setDescription(res.text);
			msg.channel.send({ embed: embed });
		}).catch((err) => {
			console.error(err);
			msg.channel.send(JSON.stringify(err, null, 4), { split: true, code: 'JSON' });
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
