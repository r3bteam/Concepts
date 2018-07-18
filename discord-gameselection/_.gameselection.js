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

	if (command === 'game') {
		if (msg.deletable) msg.delete();

		const embed = new Discord.MessageEmbed();
		embed.setTimestamp();
		embed.setTitle('Please wait while the menu is loading... ' + client.emojis.resolve(config.emojis.loading).toString());
		embed.setAuthor(msg.author.tag, msg.author.avatarURL());
		var m = await msg.channel.send({embed: embed});
		
		await m.react(client.emojis.resolve(config.emojis.tf2));
		await m.react(client.emojis.resolve(config.emojis.hl2));
		await m.react(client.emojis.resolve(config.emojis.csgo));

		await m.react(client.emojis.resolve(config.emojis.confirm));
		await m.react(client.emojis.resolve(config.emojis.cancel));

		embed.setTimestamp();
		embed.setTitle('Please select your games and hit confirm');
		embed.setFooter('Please select your choices from the buttons below. Select nothing to remove all roles.');

		var games = [];
		games.push(client.emojis.resolve(config.emojis.tf2).toString() + ' Team Fortress 2');
		games.push(client.emojis.resolve(config.emojis.hl2).toString() + ' Half-Life2');
		games.push(client.emojis.resolve(config.emojis.csgo).toString() + ' Counter-Strike: Global Offensive');
		games.push(client.emojis.resolve(config.emojis.cancel).toString() + ' Cancel');
		games.push(client.emojis.resolve(config.emojis.confirm).toString() + ' Confirm');
		
		embed.setDescription(games.join('\n\n'));

		var m = await m.edit({embed: embed});

		const filter = (reaction, user) => ([config.emojis.cancel, config.emojis.confirm].includes(reaction._emoji.id) && user.id === msg.author.id);
		m.awaitReactions(filter, { time: 30000, maxEmojis: 1 }).then(async (collected) => {
			if (!collected.first()) {
				embed.setTimestamp();
				embed.setTitle('You have not submitted your selection in time');
				embed.setDescription(''	);
				m.reactions.removeAll();
				await m.edit({embed: embed});
				return await m.delete({timeout: 10000});
			}

			if (collected.first()._emoji.id === config.emojis.cancel) {
				embed.setTimestamp();
				embed.setTitle('You have cancelled the selection');
				embed.setDescription('');
				m.reactions.removeAll();
				await m.edit({embed: embed});
				return await m.delete({timeout: 10000});
			} else if (collected.first()._emoji.id === config.emojis.confirm) {
				embed.setTimestamp();
				embed.setTitle('Applying roles... Please wait');
				embed.setDescription('');
				embed.setFooter('');
				await m.edit({embed: embed});

				var hasRoles = {
					csgo: false,
					tf2: false,
					hl2: false
				}

				await msg.guild.members.fetch({ user: msg.author, cache: true });

				var allReactions = m.reactions.array();
				var i = 0;
				async function checkReaction() {
					await allReactions[i].users.fetch();

					allReactions[i].users.map(async (u) => {
						if (u.id === msg.author.id) {
							if (allReactions[i].emoji.id === config.emojis.tf2) {
								if (!msg.guild.member(u).roles.get(config.roles.tf2)) await msg.guild.member(u).roles.add(config.roles.tf2);
								hasRoles.tf2 = true;
							}

							if (allReactions[i].emoji.id === config.emojis.csgo) {
								if (!msg.guild.member(u).roles.get(config.roles.csgo)) await msg.guild.member(u).roles.add(config.roles.csgo);
								hasRoles.csgo = true;
							}

							if (allReactions[i].emoji.id === config.emojis.hl2) {
								if (!msg.guild.member(u).roles.get(config.roles.hl2)) await msg.guild.member(u).roles.add(config.roles.hl2);
								hasRoles.hl2 = true;
							}
						}
					});

					i = i + 1;

					if (i >= allReactions.length) {
						await msg.guild.members.fetch({ user: msg.author, cache: true });

						if (!hasRoles.tf2) {
							if (msg.member.roles.get(config.roles.tf2)) await msg.member.roles.remove(config.roles.tf2);
						}

						if (!hasRoles.csgo) {
							if (msg.member.roles.get(config.roles.csgo)) await msg.member.roles.remove(config.roles.csgo);
						}
		
						if (!hasRoles.hl2) {
							if (msg.member.roles.get(config.roles.hl2)) await msg.member.roles.remove(config.roles.hl2);
						}
		
						embed.setTitle('Roles successfully applied');
						await m.reactions.removeAll();
						await m.edit({embed: embed});
						m.delete({timeout: 10000});
						return;
					}

					checkReaction();
				}
				checkReaction();
			}
		}).catch((err) => {
			console.error(err);
		});
	}
});

client.on('warn', (warn) => console.error(warn));
client.on('error', (error) => console.erorr(error));

client.login(config.botToken);
