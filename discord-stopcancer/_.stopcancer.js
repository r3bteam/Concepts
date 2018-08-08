const unorm = require('unorm');
const limax = require('limax');
const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.on('guildMemberAdd', async (member) => {
	var normalized = decancer(member);
	if (!normalized) return;

	member.setNickname(normalized).then((mem) => {
		if (!mem.guild.systemChannel) return;
		mem.guild.systemChannel.send('[Automated Message] `' + Discord.Util.escapeMarkdown(mem.user.username) + '` has been renamed to `' + Discord.Util.escapeMarkdown(mem.nickname) + '`');
	}).catch((err) => {
		if (!member.guild.systemChannel) return console.error(err);
		member.guild.systemChannel.send('[Automated Message] Failed to set username for `' + Discord.Util.escapeMarkdown(member.user.username) + '` to `' + Discord.Util.escapeMarkdown(normalized) + '`\n\n```' + err.message + '```');
	});
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
	var normalized = decancer(newMember);
	if (!normalized) return;

	newMember.setNickname(normalized).then((mem) => {
		if (!mem.guild.systemChannel) return;
		mem.guild.systemChannel.send('[Automated Message] `' + Discord.Util.escapeMarkdown(mem.user.username) + '` has been renamed to `' + Discord.Util.escapeMarkdown(mem.nickname) + '`');
	}).catch((err) => {
		if (!newMember.guild.systemChannel) return console.error(err);
		newMember.guild.systemChannel.send('[Automated Message] Failed to set username for `' + Discord.Util.escapeMarkdown(newMember.user.username) + '` to `' + Discord.Util.escapeMarkdown(normalized) + '`\n\n```' + err.message + '```');
	});
});

client.on('userUpdate', async (oldUser, newUser) => {
	var member = client.guilds.get(config.guild).member(newUser);
	if (!member) return;

	var normalized = decancer(member);
	if (!normalized) return;

	member.setNickname(normalized).then((mem) => {
		if (!mem.guild.systemChannel) return;
		mem.guild.systemChannel.send('[Automated Message] `' + Discord.Util.escapeMarkdown(mem.user.username) + '` has been renamed to `' + Discord.Util.escapeMarkdown(mem.nickname) + '`');
	}).catch((err) => {
		if (!member.guild.systemChannel) return console.error(err);
		member.guild.systemChannel.send('[Automated Message] Failed to set username for `' + Discord.Util.escapeMarkdown(member.user.username) + '` to `' + Discord.Util.escapeMarkdown(normalized) + '`\n\n```' + err.message + '```');
	});
});

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'force') {
		if (!args[0]) return msg.channel.send('Usage: ' + config.prefix + 'force <usermention/userid>');

		var m = await msg.channel.send('Checking if user is valid...');

		var userID = undefined;
		if (!userID && /^\d+/g.test(args[0])) userID = args[0];
		if (!userID && new RegExp(msg.mentions.USERS_PATTERN).test(args[0])) userID = msg.mentions.users.first().id;
		if (!userID) return m.edit('Could not find specified user');

		var user = undefined;
		if (!user) user = client.users.get(userID);
		if (!user) user = await client.users.fetch(userID).catch(() => {});
		if (!user) return m.edit('Could not find specified user');

		var member = msg.guild.member(user);
		if (!member) return m.edit('User is not in this guild');

		var normalized = decancer(member);
		if (!normalized) return;

		member.setNickname(normalized).then((mem) => {
			if (!mem.guild.systemChannel) return;
			m.edit('`' + Discord.Util.escapeMarkdown(mem.user.username) + '` has been renamed to `' + Discord.Util.escapeMarkdown(mem.nickname) + '`');
		}).catch((err) => {
			if (!member.guild.systemChannel) return console.error(err);
			m.edit('Failed to set username for `' + Discord.Util.escapeMarkdown(member.user.username) + '` to `' + Discord.Util.escapeMarkdown(normalized) + '`\n\n```' + err.message + '```');
		});
	} else if (command === 'test') {
		if (!args[0]) return msg.channel.send('Usage: ' + config.prefix + 'test <text>');

		var text = args.join(' ');
		var normalized = unorm.nfkd(text);
		normalized = limax(normalized, {
			replacement: ' ',
			tone: false,
			separateNumbers: false,
			maintainCase: true,
			custom: ['.', ',', ' ', '!', '\'', '"', '?']
		});

		msg.channel.send('Normalized version of `' + Discord.Util.escapeMarkdown(text) + '` is `' + (normalized ? Discord.Util.escapeMarkdown(normalized) : (config.defaultUsername + '`. Raw: `' + (normalized ? Discord.Util.escapeMarkdown(normalized) : ' '))) + '`');
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);

process.on('uncaughtException', (e) => console.error(e));
process.on('unhandledRejection', (e) => console.error(e));

function decancer(member) {
	var text = member.user.username;
	var normalized = unorm.nfkd(text);
	normalized = limax(normalized, {
		replacement: ' ',
		tone: false,
		separateNumbers: false,
		maintainCase: true,
		custom: ['.', ',', ' ', '!', '\'', '"', '?']
	});
	if (!normalized) normalized = config.defaultUsername;
	if (normalized === member.user.username) return false;
	if (normalized === member.nickname) return false;

	return normalized;
}
