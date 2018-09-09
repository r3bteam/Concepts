const request = require('request');
const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

const autoTriggerGuilds = [];

client.on('message', async (msg) => {
	if (!msg.guild || !msg.content) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (autoTriggerGuilds.includes(msg.guild.id) && msg.channel.nsfw === true && command !== 'nhentai') {
		var matches = msg.content.match(/\d+/);
		if (matches && matches.length >= 1) {
			var id = parseInt(matches[0]);
			if (!isNaN(id)) {
				getEmbedFromID(id).then((embed) => {
					msg.channel.send({ embed: embed });
				});
			}
		}
	}

	if (msg.content.indexOf(config.prefix) !== 0) return;

	if (command === 'toggle') {
		var index = autoTriggerGuilds.indexOf(msg.guild.id);
		if (index >= 0) {
			autoTriggerGuilds.splice(index, 1);
			msg.channel.send('Turned off auto response');
		} else {
			autoTriggerGuilds.push(msg.guild.id);
			msg.channel.send('Turned on auto response');
		}
	} else if (command === 'nhentai') {
		if (msg.channel.nsfw !== true) {
			msg.channel.send({
				embed: {
					title: 'This is only usable in NSFW channels',
					color: Discord.Util.resolveColor('#FF0000')
				}
			});
			return;
		}

		if (!args[0]) {
			msg.channel.send({
				embed: {
					title: 'Usage: ' + config.prefix + command + ' <ID>',
					color: Discord.Util.resolveColor('#FF0000')
				}
			});
			return;
		}

		var matches = args[0].match(/^\d+$/);
		if (matches === null) {
			msg.channel.send({
				embed: {
					title: 'Input has to be numbers',
					color: Discord.Util.resolveColor('#FF0000')
				}
			});
			return;
		}

		var id = parseInt(matches[0]);
		if (!isNaN(id)) {
			getEmbedFromID(id).then((embed) => {
				msg.channel.send({ embed: embed });
			});
		} else {
			msg.channel.send({
				embed: {
					title: 'Input has to be numbers',
					color: Discord.Util.resolveColor('#FF0000')
				}
			});
			return;
		}
	}
});

function getEmbedFromID(id) {
	return new Promise((resolve, reject) => {
		if (typeof id !== 'number') id = parseInt(id);
		if (isNaN(id)) return resolve({ embed: { title: 'Failed to get post', color: Discord.Util.resolveColor('#FF0000') }});

		request('https://nhentai.net/api/gallery/' + id, (err, res, body) => {
			if (err) {
				console.error(err);
				resolve({ embed: { title: 'Failed to get post', color: Discord.Util.resolveColor('#FF0000') }});
				return;
			}

			var json = undefined;
			try {
				json = JSON.parse(body);
			} catch(e) {};

			if (json === undefined) {
				console.log(body);
				resolve({ embed: { title: 'Failed to get post', color: Discord.Util.resolveColor('#FF0000') }});
				return;
			}

			if (json.error === true) {
				console.log(json);
				resolve({ embed: { title: 'Failed to get post', color: Discord.Util.resolveColor('#FF0000') }});
				return;
			}

			const embed = new Discord.MessageEmbed();
			embed.setColor(0);
			embed.addField('Artist', json.tags.map((t) => {
				if (t.type === 'artist') {
					return '[' + t.name + '](https://nhentai.net' + t.url + ')';
				}
			}).filter(t => t).join(', ') || String.fromCodePoint(0x200B), true);
			embed.addField('Tag', json.tags.map((t) => {
				if (t.type === 'tag') {
					return '[' + t.name + '](https://nhentai.net' + t.url + ')';
				}
			}).filter(t => t).join(', ') || String.fromCodePoint(0x200B), true);
			embed.addField('Character', json.tags.map((t) => {
				if (t.type === 'character') {
					return '[' + t.name + '](https://nhentai.net' + t.url + ')';
				}
			}).filter(t => t).join(', ') || String.fromCodePoint(0x200B), true);
			embed.addField('Language', json.tags.map((t) => {
				if (t.type === 'language') {
					return '[' + t.name + '](https://nhentai.net' + t.url + ')';
				}
			}).filter(t => t).join(', ') || String.fromCodePoint(0x200B), true);
			embed.addField('Category', json.tags.map((t) => {
				if (t.type === 'category') {
					return '[' + t.name + '](https://nhentai.net' + t.url + ')';
				}
			}).filter(t => t).join(', ') || String.fromCodePoint(0x200B), true);
			embed.addField('Parody', json.tags.map((t) => {
				if (t.type === 'parody') {
					return '[' + t.name + '](https://nhentai.net' + t.url + ')';
				}
			}).filter(t => t).join(', ') || String.fromCodePoint(0x200B), true);
			embed.setThumbnail('https://t.nhentai.net/galleries/' + json.media_id + '/cover.jpg');
			embed.setFooter(json.num_pages + ' page' + (json.num_pages === 1 ? '': 's') + ' | ' + json.num_favorites + ' ❤');
			embed.setTitle(((json.title.pretty || json.title.english || json.title.japanese).length > 256) ? (json.title.pretty || json.title.english || json.title.japanese).substr(0, (256 - 3)) + '...' : (json.title.pretty || json.title.english || json.title.japanese));
			embed.setURL('https://nhentai.net/g/' + json.id + '/');

			var i = embed.fields.length;
			while (i--) {
				if (embed.fields[i].value === String.fromCodePoint(0x200B)) {
					embed.fields.splice(i, 1);
				} else if (embed.fields[i].value.length > 1024) {
					var name = embed.fields[i].name;
					var split = Discord.Util.splitMessage(embed.fields[i].value, { maxLength: (1024 - 3), char: ', ' });

					embed.fields.splice(i, 1);

					for (let x = (split.length - 1); x >= 0; x--) {
						embed.fields.splice(i, 0, { name: (x === 0 ? name : String.fromCodePoint(0x200B)), value: split[x] });
					}
				}
			}

			for (let i = 0; i < embed.fields.length; i++) {
				if (typeof embed.fields[parseInt(i + 1)] !== 'undefined') {
					if (embed.fields[parseInt(i + 1)].name !== String.fromCodePoint(0x200B)) {
						embed.fields[i].value += '\n' + String.fromCodePoint(0x200B);
					}
				}
			}

			embed.fields[embed.fields.length - 1].value += '\n' + String.fromCodePoint(0x200B);

			resolve(embed);
			return;
		});
	});
}

client.login(config.botToken).then(() => {
	if (config && !config.owner) {
		client.fetchApplication().then((r) => {
			config.owner = r.owner;
		}).catch((e) => console.error(e));
	}
});

process.on('uncaughtException', (e) => console.error(e));
process.on('unhandledRejection', (e) => console.error(e));
