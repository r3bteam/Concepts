const Discord = require('discord.js');
const request = require('request');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'steam') {
		if (!args[0]) return msg.channel.send('Usage: ' + config.prefix + 'steam <usermention/userid>');

		var m = await msg.channel.send('Checking if user is valid...');

		var userID = undefined;
		if (!userID && /^\d+/g.test(args[0])) userID = args[0];
		if (!userID && new RegExp(msg.mentions.USERS_PATTERN).test(args[0])) userID = msg.mentions.users.first().id;
		if (!userID) return m.edit('Could not find specified user');

		var user = undefined;
		if (!user) user = client.users.get(userID);
		if (!user) user = await client.users.fetch(userID).catch(() => {});
		if (!user) return m.edit('Could not find specified user');

		await m.edit('Getting user profile...');

		request({
			url: 'https://discordapp.com/api/v6/users/' + user.id + '/profile',
			headers: {
				'Authorization': config.userToken // This breaks the Discord ToS & requires the user we have to share a guild with the user we want the profile of
			}
		}, (error, response, body) => {
			if (error) return console.error(error);

			var json = JSON.parse(body);

			if (!isNaN(json.code) && json.message) {
				if (json.code === '50001') return m.edit('The client user we are using to get the profile has to be in the same guild as the user we are requesting');

				m.edit('Code: ' + json.code + ' Message: ' + json.message);
			}

			if (!json.connected_accounts) return m.edit('Malformed Discord API response');

			var steamIDs = [];
			for (let i = 0; i < json.connected_accounts.length; i++) {
				if (json.connected_accounts[i].type === 'steam') {
					steamIDs.push({ verified: json.connected_accounts[i].verified, id: json.connected_accounts[i].id });
				}
			}

			if (steamIDs.length < 1) return m.edit('Could not find a linkd Steam account');

			const embed = new Discord.MessageEmbed();
			embed.setTimestamp();
			embed.setAuthor(msg.author.tag, msg.author.avatarURL());
			embed.setTitle('Connected Steam ' + (steamIDs.length === 1 ? 'Account' : 'Accounts') + ' for ' + user.tag);
			var description = '';
			for (let i = 0; i < steamIDs.length; i++) description += '[' + steamIDs[i].id + '](https://steamcommunity.com/profiles/' + steamIDs[i].id + '/) - Verified: ' + steamIDs[i].verified
			embed.setDescription(description);
			m.edit('', { embed: embed });
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);