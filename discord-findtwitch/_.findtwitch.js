const Discord = require('discord.js');
const client = new Discord.Client();

const SteamCommunity = require('steamcommunity');
const community = new SteamCommunity();
const SteamID = SteamCommunity.SteamID;

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'findtwitch') {
		var embed = new Discord.MessageEmbed();
		embed.setTimestamp();
		embed.setAuthor(msg.author.tag, msg.author.avatarURL({format: 'png'}));
		embed.setTitle('Please respond with the player output of "status" from console');
		embed.setDescription('It is recommended to only copy the player output of "status", otherwise the message will most probably be too long for Discord.\n\n*If you annoy me enough I will add pastebin support*');
		embed.setFooter('Auto-Cancel in 60 seconds');
		msg.channel.send({embed: embed}).then((m) => {
			const filter = r => r.author.id === msg.author.id;
			const collector = m.channel.createMessageCollector(filter, { time: 60000 });

			collector.on('collect', (collected) => {
				collector.stop();
				collected.delete();
				
				var embed = new Discord.MessageEmbed();
				embed.setTimestamp();
				embed.setAuthor(collected.author.tag, collected.author.avatarURL({format: 'png'}));

				const input = collected.content;
				const matches = input.match(/\[U:1:[0-9]+\]/g);

				if (!matches || matches.length < 1) {
					embed.setTitle('Could not get a SteamID3 matches');
					m.edit({embed: embed});
					return;
				}

				embed.setTitle('Checking ' + matches.length + ' accounts for Twitch channels...');
				embed.setDescription('Approximate waiting time is equals to the accounts to check devided by 2 and rounded down. In this case the expected waiting time is ~' + Math.floor(parseInt(matches.length / 2)) + ' seconds.');

				m.edit({embed: embed}).then((m) => {
					var found = [];
					var i = 0;

					function checkID() {
						if (i >= matches.length) {
							if (!found || found.length < 1) {
								embed.setTitle('No Twitch channels found');
								embed.setDescription('');
								m.edit({embed: embed});
							} else {
								embed.setTitle('Found the following twitch channels');

								var text = '';
								for (let s = 0; s < found.length; s++) text = text + '[' + found[s] + '](https://' + found[s] + ')\n';

								if (text.length > 2048) {
									var replacerInfo = '\n\nThere are too many to display.';

									var tmp = text.substr(0, parseInt(2048 - replacerInfo.length));
									var indx = tmp.lastIndexOf('\n');
									tmp = text.substr(0, indx);
									text = tmp + replacerInfo;
								}

								embed.setDescription(text);
								embed.setFooter('It is possible that some twitch URLs appear twice.');
								m.edit({embed: embed});
							}
							return;
						}

						var sid = new SteamID(matches[i]);

						community.getSteamUser(sid, function(err, user) {
							if (err) {
								if (err.toString() === 'Error: Failed loading profile data, please try again later.') {
									i = i + 1;
									checkID();
									return;
								} else {
									m.edit({embed: {
										author: {
											name: msg.author.tag,
											icon_url: msg.author.avatarURL({format: 'png'})
										},
										title: 'Error occured while checking for channels',
										description: 'This whole check has been aborted. Please try again.'
									}});
									console.log(err);
									return;
								}
							}

							if (user.privacyState === 'public') {
								var matches = null;
								
								// Name matches
								matches = user.name.match(/twitch\.tv\/\w+/gi);
								if (matches) {
									for (let t = 0; t < matches.length; t++) {
										found.push(matches[t]);
									}
								}
								
								matches = null;

								// Summary matches
								matches = user.summary.match(/twitch\.tv\/\w+/gi);
								if (matches) {
									for (let t = 0; t < matches.length; t++) {
										found.push(matches[t]);
									}
								}
							}

							i = i + 1;
							checkID();
						});
					}
					checkID();
				});
			});

			collector.on('end', (collected, reason) => {
				if (reason === 'time') {
					embed.setTimestamp();
					embed.setDescription('Queue cancelled');
					embed.setFooter('Reuse the command to retry');
					m.edit({embed: embed});
				}
			});
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);