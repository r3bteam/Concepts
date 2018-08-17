const PImage = require('pureimage');
const fs = require('fs');
const twemoji = require('twemoji');
const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	fs.readdir('./', (err, files) => {
		if (err) return console.error(err);

		for (let i in files) {
			if (/^temp_\d{18}.png$|^\d{18}.png$/.test(files[i])) {
				fs.unlinkSync('./' + files[i]);
			}
		}
	});

	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'draw') {
		if (!msg.guild.me.hasPermission([ 'MANAGE_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'ADD_REACTIONS', 'USE_EXTERNAL_EMOJIS' ])) {
			var missing = msg.guild.me.missingPermissions([ 'MANAGE_MESSAGES', 'EMBED_LINKS', 'ATTACH_FILES', 'ADD_REACTIONS', 'USE_EXTERNAL_EMOJIS' ]);
			msg.channel.send('Missing permissions\n```JSON\n' + JSON.stringify(missing, null, 4) + '```');
			return;
		}

		const colors = await msg.channel.send('Please wait while I am setting up the menu...');
		const controls = await msg.channel.send('Placeholder');

		var colorEmotes = Object.keys(config.emotes.colors);
		for (let i in colorEmotes) {
			var emote = findEmoji(config.emotes.colors[colorEmotes[i]].identifier)[0];
			if (client.emojis.resolve(config.emotes.colors[colorEmotes[i]].identifier)) emote = client.emojis.resolve(config.emotes.colors[colorEmotes[i]].identifier);

			if (!emote) {
				await msg.channel.send('Failed to access one of the required emotes');
				await colors.delete();
				await controls.delete();
				return;
			} else {
				await colors.react(emote);
			}
		}

		var controlEmotes = Object.keys(config.emotes.controls);
		for (let i in controlEmotes) {
			var emote = findEmoji(config.emotes.controls[controlEmotes[i]])[0];
			if (client.emojis.resolve(config.emotes.controls[controlEmotes[i]])) emote = client.emojis.resolve(config.emotes.controls[controlEmotes[i]]);

			if (!emote) {
				await msg.channel.send('Failed to access one of the required emotes');
				await colors.delete();
				await controls.delete();
				return;
			} else {
				await controls.react(emote);
			}
		}

		var image = PImage.make(100, 100);
		var image_ctx = image.getContext('2d');
		image_ctx.fillStyle = '#FFFFFF';
		image_ctx.fillRect(0, 0, 100, 100);
		await PImage.encodePNGToStream(image, fs.createWriteStream('temp_' + msg.id + '.png'));

		var courser = image;
		var courser_ctx = courser.getContext('2d');
		courser_ctx.fillStyle = config.courserColor;
		courser_ctx.strokeRect(0, 0, 10, 10);

		var courserPosition = [ 0, 0 ]; // Courser position
		var selectedColor = config.emotes.colors[colorEmotes[0]].hex; // Selected color

		await colors.edit('```\nAvailable colors```', {
			embed: {
				color: Discord.Util.resolveColor(selectedColor),
				image: {
					url: 'https://blargbot.xyz/color/' + selectedColor.replace('#', '')
				}
			}
		});
		await controls.edit('```\nControls```');
		var displayImage = await printImage(msg, courser);

		const filter = (reaction, user) => user.id === msg.author.id;
		const colorCollector = colors.createReactionCollector(filter, {});
		colorCollector.on('collect', async (r, u) => {
			for (let i in colorEmotes) {
				if (!r.emoji.id) {
					if (config.emotes.colors[colorEmotes[i]].identifier === r.emoji.name) {
						r.users.remove(u);
						selectedColor = config.emotes.colors[colorEmotes[i]].hex;

						await colors.edit('```\nAvailable colors```', {
							embed: {
								color: Discord.Util.resolveColor(selectedColor),
								image: {
									url: 'https://blargbot.xyz/color/' + selectedColor.replace('#', '')
								}
							}
						});
					}
				} else {
					if (config.emotes.colors[colorEmotes[i]].identifier === r.emoji.id) {
						r.users.remove(u);
						selectedColor = config.emotes.colors[colorEmotes[i]].hex;

						await colors.edit('```\nAvailable colors```', {
							embed: {
								color: Discord.Util.resolveColor(selectedColor),
								image: {
									url: 'https://blargbot.xyz/color/' + selectedColor.replace('#', '')
								}
							}
						});
					}
				}
			}
		});

		const controlCollector = controls.createReactionCollector(filter, {});
		controlCollector.on('collect', async (r, u) => {
			for (let i in controlEmotes) {
				if (!r.emoji.id) {
					if (config.emotes.controls[controlEmotes[i]] === r.emoji.name) {
						r.users.remove(u);
						handleEmote(controlEmotes[i]);
					}
				} else {
					if (config.emotes.controls[controlEmotes[i]] === r.emoji.id) {
						r.users.remove(u);
						handleEmote(controlEmotes[i]);
					}
				}
			}

			async function handleEmote(type) {
				if (type === 'draw') {
					var decodedImg = await PImage.decodePNGFromStream(fs.createReadStream('temp_' + msg.id + '.png'));
					fs.unlinkSync('temp_' + msg.id + '.png');

					var image = PImage.make(100, 100);
					var image_ctx = image.getContext('2d');
					image_ctx.drawImage(decodedImg, 0, 0, decodedImg.width, decodedImg.height, 0, 0, 100, 100);

					image_ctx.fillStyle = selectedColor;
					image_ctx.fillRect((courserPosition[0] * 10), (courserPosition[1] * 10), 10, 10);
					await PImage.encodePNGToStream(image, fs.createWriteStream('temp_' + msg.id + '.png'));

					var courser = image;
					courser_ctx.fillStyle = config.courserColor;
					courser_ctx.strokeRect((courserPosition[0] * 10), (courserPosition[1] * 10), 10, 10);

					await displayImage.delete();
					displayImage = await printImage(msg, courser);
					return;
				} else if (type === 'allUp') {
					courserPosition[1] = 0;
				} else if (type === 'allDown') {
					courserPosition[1] = 9;
				} else if (type === 'allLeft') {
					courserPosition[0] = 0;
				} else if (type === 'allRight') {
					courserPosition[0] = 9;
				} else if (type === 'up') {
					courserPosition[1] = courserPosition[1] - 1;
					if (courserPosition[1] < 0) courserPosition[1] = 9;
				} else if (type === 'down') {
					courserPosition[1] = courserPosition[1] + 1;
					if (courserPosition[1] > 9) courserPosition[1] = 0;
				} else if (type === 'left') {
					courserPosition[0] = courserPosition[0] - 1;
					if (courserPosition[0] < 0) courserPosition[0] = 9;
				} else if (type === 'right') {
					courserPosition[0] = courserPosition[0] + 1;
					if (courserPosition[0] > 9) courserPosition[0] = 0;
				} else if (type === 'end') {
					colorCollector.stop();
					controlCollector.stop();

					await colors.delete();
					await controls.delete();

					var decodedImg = await PImage.decodePNGFromStream(fs.createReadStream('temp_' + msg.id + '.png'));
					fs.unlinkSync('temp_' + msg.id + '.png');

					var image = PImage.make(100, 100);
					var image_ctx = image.getContext('2d');
					image_ctx.drawImage(decodedImg, 0, 0, decodedImg.width, decodedImg.height, 0, 0, 100, 100);

					await displayImage.delete();
					await printImage(msg, image, true);
					return;
				} else {
					return;
				}

				var decodedImg = await PImage.decodePNGFromStream(fs.createReadStream('temp_' + msg.id + '.png'));

				var image = PImage.make(100, 100);
				var image_ctx = image.getContext('2d');
				image_ctx.drawImage(decodedImg, 0, 0, decodedImg.width, decodedImg.height, 0, 0, 100, 100);
				image_ctx.strokeRect((courserPosition[0] * 10), (courserPosition[1] * 10), 10, 10);

				await displayImage.delete();
				displayImage = await printImage(msg, image);
			}
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);

function printImage(message, image, final = false) {
	return new Promise((resolve, reject) => {
		PImage.encodePNGToStream(image, fs.createWriteStream(message.id + '.png')).then(() => {
			var attachment = new Discord.MessageAttachment('./' + message.id + '.png', 'drawing.png');
			message.channel.send(((final === true) ? 'Your finished drawing' : ''), attachment).then((m) => {
				if (fs.existsSync('./' + message.id + '.png')) fs.unlinkSync('./' + message.id + '.png');
				resolve(m);
			}).catch((e) => {
				console.error(e);
				if (fs.existsSync('./' + message.id + '.png')) fs.unlinkSync('./' + message.id + '.png');
				reject(e);
			});
		}).catch((e) => {
			console.error(e);
			reject(e);
		});
	});
}

// Credit: https://github.com/blargbot/blargbot/blob/6eb4b48f1be1cf47d61b1cb55882f1454d759ade/src/utils/generic.js#L1665
function findEmoji(text, distinct) {
	if (typeof text != 'string') return [];
	let match;
	let result = [];

	// Find custom emotes
	let regex = /<(a?:\w+:\d{17,23})>/gi;
	while (match = regex.exec(text)) result.push(match[1]);

	// Find twemoji defined emotes
	twemoji.replace(text, (match) => {
		result.push(match);
		return match;
	});

	if (distinct) result = [...new Set(result)];

	// Sort by order of appearance
	result = result.map(r => {
		return {
			value: r,
			index: text.indexOf(r)
		};
	});

	return result.sort((a, b) => a.index - b.index).map(r => r.value);
}