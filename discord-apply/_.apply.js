const Discord = require('discord.js');
const client = new Discord.Client();
require('./functions.js')(client);

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.on('message', async (msg) => {
	if(msg.content.indexOf(config.prefix) !== 0 || msg.author.bot) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'apply' && msg.channel.type === 'dm') {
		var m = await msg.channel.send({embed: {
			title: 'Please wait...',
			description: 'I am verifying whever or not you have already sent an application.\n\nDepending on the amount of applications already sent this can take a little while. Please stay patient!'
		}});

		client.fetchAllMessages(client.channels.get(config.channel)).then((messages) => {
			var alreadySentAnApplication = false;
			messages.forEach((message) => {
				if (message.author.id !== client.user.id) return;
				if (!message.embeds || message.embeds.length < 1 || !message.embeds[0].title) return;
				if (alreadySentAnApplication) return;

				alreadySentAnApplication = RegExp('\(' + msg.author.id + '\)', 'g').test(message.embeds[0].title);
			});

			if (alreadySentAnApplication) {
				m.edit({embed: {
					title: 'You have already sent an application',
					description: 'You cannot send another application before the current application process is over'
				}});
			} else {
				m.edit({embed: {
					title: 'Application process started...',
					description: 'You can write up to 10 unique messages each being up to 2000 characters. You can edit and delete them to make the perfect application. **Please take your time, there is no hurry.**\n\nOnce you are done with the application enter `' + config.prefix + 'submit` to submit your application.\n\nIf you want to fully start over again just enter `' + config.prefix + 'apply` again.'
				}});
			}
		}).catch((err) => {
			console.error(err);

			m.edit({embed: {
				title: 'Errored while getting messages',
				description: 'Please try again later'
			}});
		});
	} else if (command === 'submit' && msg.channel.type === 'dm') {
		var m = await msg.channel.send({embed: {
			title: 'Please wait...',
			description: 'This can take a couple of seconds.'
		}});

		var fetchedMessages = await msg.channel.messages.fetch({ limit: 10 });
		var messages = fetchedMessages.array();

		var betweenApplyAndSubmit = true;
		var startedInTheFirstPlace = false;
		var validMessages = [];

		messages.forEach((message) => {
			if (message.author.id === client.user.id && message.embeds && message.embeds.length >= 1 && message.embeds[0].title === 'Application process started...') {
				startedInTheFirstPlace = true;
				betweenApplyAndSubmit = false;
			}

			if (betweenApplyAndSubmit && message.author.id === msg.author.id && validMessages.length < 5) {
				validMessages.push(message);
			}
		});

		if (!startedInTheFirstPlace) return m.edit({embed: {
			title: 'Failed to get proper messages',
			description: 'Make sure you didn\'t write too many messages, 5 messages is the limit.\nMake sure you have initiated the process at the start with `' + config.prefix + 'apply`'
		}}).then((m) => m.delete({ timeout: 10000 }));

		validMessages = validMessages.reverse();

		if ((/^-submit ?/i).test(validMessages[validMessages.length - 1].content)) validMessages.splice(-1, 1);

		if (validMessages.length < 1) {
			msg.channel.send({embed: {
				title: 'No valid messages found',
				description: 'If you think this is an error please report it'
			}});
			return;
		}

		var fullMessage = '';
		validMessages.forEach((message) => fullMessage += message.content + '\n');

		var texts = Discord.Util.splitMessage(fullMessage, { maxLength: 1024, char: '', prepend: '', append: '' });

		const embed = new Discord.MessageEmbed();
		embed.setTimestamp();
		embed.setAuthor(msg.author.tag, msg.author.avatarURL({ format: 'png' }));
		embed.setColor(0);
		embed.setTitle('Application by ' + msg.author.tag + ' (' + msg.author.id + ')'); // The end of the title HAS to be " (01234567890123456789)" due to how the rest of this works
		embed.addField('Information', 'To accept this application write `' + config.prefix + 'accept ' + msg.author.id + '`\nTo deny this application write `' + config.prefix + 'deny ' + msg.author.id + '`\n' + String.fromCharCode(0x200B));

		if (typeof texts === 'string') embed.addField(String.fromCharCode(0x200B), texts);
		else texts.forEach((text) => embed.addField(String.fromCharCode(0x200B), text));

		m.edit('Your application will look like this. To submit the application please react with a tick.', { embed: embed }).then((m) => {
			var cancel = false;
			if (!cancel) {
				m.react('✅').then((r) => {
					if (cancel && !m.deleted) r.users.remove();
					else if (!cancel) {
						m.react('❎').then((r) => {
							if (cancel && !m.deleted) r.users.remove();
						});
					}
				});
			}

			const filter = (reaction, user) => [ '✅', '❎' ].includes(reaction.emoji.name) && user.id === msg.author.id;
			m.awaitReactions(filter, { maxEmojis: 1 }).then((collected) => {
				cancel = true;

				if (collected.first().emoji.name === '❎') {
					if (!m.deleted) m.delete();
				} else if (collected.first().emoji.name === '✅') {
					m.reactions.forEach((reaction) => {
						if (reaction.me) {
							reaction.users.remove();
						}
					});

					m.edit('Submitting your application...').then(async (m) => {
						if (!client.channels.get(config.channel)) {
							m.edit('', { embed: {
								title: 'Failed to submit your application',
								description: 'Please try again later and wait for tihs message to be deleted.',
								footer: {
									text: 'This message should automatically delete itself in 10 seconds'
								}
							}}).then((m) => m.delete({ timeout: 10000 }));
						} else {
							client.channels.get(config.channel).send({embed: embed}).then(() => {
								m.edit('', { embed: {
									title: 'Successfully submitted your application',
									description: 'Your application will now be reviewed by the administration team. Thank you for applying!'
								}});
							}).catch(() => {
								m.edit('', { embed: {
									title: 'Failed to submit your application',
									description: 'Please try again later and wait for tihs message to be deleted.',
									footer: {
										text: 'This message should automatically delete itself in 10 seconds'
									}
								}}).then((m) => m.delete({ timeout: 10000 }));
							});
						}
					});
				}
			}).catch(() => {
				if (!m.deleted) m.delete();
			});
		});
	} else if ((command === 'accept' || command === 'deny') && (msg.guild && msg.channel.id === config.channel)) {
		if (msg.deletable) msg.delete();

		if (!args[0]) {
			if (command === 'accept') return msg.channel.send('Usage: `' + config.prefix + 'accept <user id>`').then((m) => m.delete({ timeout: 5000 }));
			else if (command === 'deny') return msg.channel.send('Usage: `' + config.prefix + 'deny <user id>`').then((m) => m.delete({ timeout: 5000 }));
		}
		if (!/\d/g.test(args[0])) return msg.channel.send('Not a valid user ID').then((m) => m.delete({ timeout: 5000 }));

		var user = undefined;
		if (!user) user = client.users.get(args[0]);
		if (!user) user = await client.users.fetch(args[0]);
		if (!user) return msg.channel.send('Not a valid user ID').then((m) => m.delete({ timeout: 5000 }));
		if (user.bot) return msg.channel.send('Bots cannot write applications...').then((m) => m.delete({ timeout: 5000 }));

		var m = await msg.channel.send({embed: {
			title: 'Please wait...',
			description: 'Fetching all messages in this channel...'
		}});

		client.fetchAllMessages(client.channels.get(config.channel)).then((messages) => {
			var sentAnApplication = false;
			var applicationMsg = undefined;
			messages.forEach((message) => {
				if (message.author.id !== client.user.id) return;
				if (!message.embeds || message.embeds.length < 1 || !message.embeds[0].title) return;
				if (sentAnApplication) return;

				sentAnApplication = RegExp('\(' + user.id + '\)', 'g').test(message.embeds[0].title);
				if (sentAnApplication) applicationMsg = message;
			});

			if (!sentAnApplication) {
				m.edit({embed: {
					title: 'User has not sent an application yet'
				}}).then((m) => m.delete({ timeout: 5000 }));
			} else if (Discord.Util.resolveColor(applicationMsg.embeds[0].color) === Discord.Util.resolveColor('#00ff00')) {
				m.edit({embed: {
					title: 'Application has already been accepted'
				}}).then((m) => m.delete({ timeout: 5000 }));
			} else if (Discord.Util.resolveColor(applicationMsg.embeds[0].color) === Discord.Util.resolveColor('#ff0000')) {
				m.edit({embed: {
					title: 'Application has already been denied'
				}}).then((m) => m.delete({ timeout: 5000 }));
			} else {
				var embed = applicationMsg.embeds[0];
				var title = {
					success: String.fromCharCode(0x200B),
					fail: String.fromCharCode(0x200B)
				}

				if (command === 'accept' && client.guilds.get(config.guild).member(user)) {
					embed.color = Discord.Util.resolveColor('#00ff00');
					title.success = 'Successfully accepted application';
					title.fail = 'Failed to accept application';
				} else if (command === 'deny' && client.guilds.get(config.guild).member(user)) {
					embed.color = Discord.Util.resolveColor('#ff0000');
					title.success = 'Successfully denied application';
					title.fail = 'Failed to deny application';
				} else if (!client.guilds.get(config.guild).member(user)) {
					embed.color = Discord.Util.resolveColor('#ff0000');
					title.success = 'Forcefully denied application';
					title.fail = 'User is not in the desired guild';
				}

				applicationMsg.edit({embed: embed}).then(() => {
					m.edit({embed: {
						title: title.success
					}}).then((m) => m.delete({ timeout: 5000 }));

					if (command === 'accept') {
						// Do something when the user gets accepted
						user.send({embed: {
							title: 'Your application has been accepted',
							description: 'Have fun!',
							color: embed.color
						}});

						if (!client.guilds.get(config.guild).member(user).roles.has(config.role)) {
							client.guilds.get(config.guild).member(user).roles.add(config.role);
						}
					} else if (command === 'deny') {
						// Do something when the user gets accepted
						user.send({embed: {
							title: 'Your application has been denied',
							color: embed.color
						}});
					}
				}).catch((err) => {
					console.error(err);
					m.edit({embed: {
						title: title.fail
					}}).then((m) => m.delete({ timeout: 5000 }));
				});
			}
		}).catch((err) => {
			console.error(err);

			m.edit({embed: {
				title: 'Errored while getting messages',
				description: 'Please try again later'
			}}).then((m) => m.delete({ timeout: 5000 }));
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
