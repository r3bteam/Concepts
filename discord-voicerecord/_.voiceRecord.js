const request = require('request');
const uploadFirefox = require('./sendFirefox.js');
const FileWriter = require('wav').FileWriter;
const moment = require('moment');
require('moment-duration-format');
const Discord = require('discord.js');
const client = new Discord.Client();

const fs = require('fs');

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'file') {
		if (!args[0] || !args[1]) return msg.channel.send(config.prefix + 'file <download link> <owner token>');

		if (msg.deletable) msg.delete();
		var m = await msg.channel.send('Loading...');

		var split = args[0].split('/');
		var fileID = undefined;
		var token = args[1];
		for (let i = 0; i < split.length; i++) {
			if (split[i].length < 1) continue;
			if (split[i].includes('http')) continue;
			if (split[i].includes('send.firefox.com')) continue;
			if (split[i].includes('download')) continue;
			if (split[i].includes('#')) continue;

			fileID = split[i];
			break;
		}

		request({
			method: 'POST',
			uri: 'https://send.firefox.com/api/info/' + fileID,
			json: true,
			body: {
				owner_token: token
			}
		}, async (err, res, body) => {
			if (err) {
				m.edit('Requesting file information has errored');
				console.error(err);
				return;
			}

			if (!body || body.dlimit === undefined || body.dtotal === undefined || body.ttl === undefined) {
				if (body === 'Not Found') m.edit('File does not exist');
				else if (body === 'Unauthorized') m.edit('Invalid owner token');
				else {
					console.log(body);
					m.edit('Malformed send.firefox.com response');
				}
				return;
			}

			var data = {
				downloadLimit: body.dlimit,
				totalDownloads: body.dtotal,
				timeUntilDelete: body.ttl
			};

			var embed = new Discord.MessageEmbed();
			embed.setTimestamp();
			embed.setTitle('File Info');
			embed.setDescription('Download Limit: ' + data.downloadLimit + '\nTotal Downloads: ' + data.totalDownloads + '\nDeleted in ' + moment.duration(data.timeUntilDelete).format(' H [hrs], m [mins], s [secs]'));
			embed.addField('Available options', '**' + config.prefix + 'setdownloads <number between 1 and 20>** > Set maximum allowed downloads\n**' + config.prefix + 'delete yes** > Delete the file');
			await m.edit('', { embed: embed });

			const filter = m => m.author.id === msg.author.id && m.content.startsWith(config.prefix);
			const collector = msg.channel.createMessageCollector(filter, {});
			collector.on('collect', (ms) => {
				const args = ms.content.split(/ +/g);
				const command = args.shift().slice(config.prefix.length).toLowerCase();

				if (command === 'delete') {
					if (ms.deletable) ms.delete();

					if (!args[0]) {
						msg.channel.send('Usage: `' + config.prefix + 'delete yes`').then((m) => m.delete({ timeout: 5000 }));
						return;
					}

					if (args[0].toLowerCase() === 'yes') {
						request({
							method: 'POST',
							uri: 'https://send.firefox.com/api/delete/' + fileID,
							json: true,
							body: {
								owner_token: token
							}
						}, (err, res, body) => {
							if (err) {
								m.edit('Error when deleting file-deletion request');
								console.error(err);
								return;
							}

							if (typeof body === 'string' && body === 'OK') {
								embed.setTimestamp();
								embed.setTitle('File successfully deleted');
								embed.setDescription('The file has been deleted. This is unrevertable.');
								if (embed.fields) delete embed.fields;
								m.edit({ embed: embed });

								if (!collector.ended) collector.stop();
							} else {
								embed.setTimestamp();
								embed.setTitle('Unnormal response from the API');
								embed.setDescription(((typeof body === 'string') ? (body) : ('```' + JSON.stringify(body, null, 4) + '```')));
								if (embed.fields) delete embed.fields;
								m.edit({ embed: embed });

								if (!collector.ended) collector.stop();
							}
						});
					} else {
						msg.channel.send('Usage: `' + config.prefix + 'delete yes`').then((m) => m.delete({ timeout: 5000 }));
					}
				} else if (command === 'setdownloads') {
					if (ms.deletable) ms.delete();

					if (!args[0]) {
						msg.channel.send('Usage: `' + config.prefix + 'setdownloads <number between 1-20>`').then((m) => m.delete({ timeout: 5000 }));
						return;
					}

					var int = parseInt(args[0]);
					if (isNaN(int)) {
						msg.channel.send('Usage: `' + config.prefix + 'setdownloads <number between 1-20>`').then((m) => m.delete({ timeout: 5000 }));
						return;
					}

					if (int < 1 || int > 20) {
						msg.channel.send('The number **has to be** between 1 and 20').then((m) => m.delete({ timeout: 5000 }));
						return;
					}

					request({
						method: 'POST',
						uri: 'https://send.firefox.com/api/params/' + fileID,
						json: true,
						body: {
							owner_token: token,
							dlimit: int
						}
					}, (err, res, body) => {
						if (err) {
							m.edit('Error when changing download limit');
							console.error(err);
							return;
						}

						if (typeof body === 'string' && body === 'OK') {
							embed.setTimestamp();
							embed.setTitle('Successfully changed download limit');
							embed.setDescription('Download limit changed from ' + data.downloadLimit + ' to ' + int);
							if (embed.fields) delete embed.fields;
							m.edit({ embed: embed });

							if (!collector.ended) collector.stop();
						} else {
							embed.setTimestamp();
							embed.setTitle('Unnormal response from the API');
							embed.setDescription(((typeof body === 'string') ? (body) : ('```' + JSON.stringify(body, null, 4) + '```')));
							if (embed.fields) delete embed.fields;
							m.edit({ embed: embed });

							if (!collector.ended) collector.stop();
						}
					})
				}
			});
		});
	} else if (command === 'record') {
		if (!args[0]) return msg.channel.send(config.prefix + 'record <user mention>');

		if (!msg.mentions || msg.mentions.members.size < 1) return msg.channel.send(config.prefix + 'record <user mention>');

		var userToJoin = msg.mentions.members.first();
		if (!userToJoin.voiceChannel) return msg.channel.send('User is not in a voice channel');
		if (!userToJoin.voiceChannel.joinable) return msg.channel.send('I cannot join that voice channel');
		if (!fs.existsSync('./audios')) fs.mkdirSync('./audios');
		if (fs.existsSync('./audios/' + userToJoin.id + '.wav')) return msg.channel.send('A file from this user is currently being recorded or uploaded. Please wait!');

		var m = await msg.channel.send('Joining...');

		userToJoin.voiceChannel.join().then((connection) => {
			var start = new Date().getTime();

			var outputFileStream = new FileWriter('./audios/' + userToJoin.id + '.wav', {
				sampleRate: 32000,
				channels: 3
			});

			var stream = connection.createReceiver().createStream(userToJoin.user, { end: 'manual', mode: 'pcm' });
			stream.pipe(outputFileStream);

			stream.on('end', async () => {
				var end = new Date().getTime();

				connection.disconnect();

				var msgUpdateInterval = undefined;
				var ogText = 'Stopped recording\n\nDuration: ' + moment.duration(end - start).format('m [mins], s [secs]') + (((end - start) >= 300000) ? '\n\nReached maximum recording time' : '');
				var text = 'Stopped recording\n\nDuration: ' + moment.duration(end - start).format('m [mins], s [secs]') + (((end - start) >= 300000) ? '\n\nReached maximum recording time' : '') + '\n\n**Uploading in progress...**';
				var msgUpdateAllowed = true;
				var latestData = undefined;

				const embed = new Discord.MessageEmbed();
				embed.setTimestamp();
				embed.setTitle('Progress 0%');
				embed.setDescription('Uploaded: 0.00/N/A\nPassed: 00:00\nRemaining: 0:00');
				embed.addField('Upload speed information', 'Current speed: N/A\nAverage speed: N/A');
				embed.setFooter('This message will be edited when the upload is complete');
				m = await m.edit(text, { embed: embed });

				// Upload the file
				const send = new uploadFirefox();
				send.uploadFile('./audios/' + userToJoin + '.wav', 20);

				send.on('progress', async (data) => {
					latestData = data;

					if (msgUpdateAllowed) {
						msgUpdateAllowed = false;

						const embed = new Discord.MessageEmbed();
						embed.setTimestamp();
						embed.setTitle('Progress ' + data.progress.percentage);
						embed.setDescription('Uploaded: ' + data.progress.uploaded + '/' + data.progress.total + '\nPassed: ' + data.time.passed + '\nRemaining: ' + data.time.remaining);
						embed.addField('Upload speed information', 'Current speed: ' + data.speed.curSpeed + '\nAverage speed: ' + parseFloat(data.speed.averageSpeed).toFixed(2) + 'kB/s');
						embed.setFooter('This message will be edited when the progress upload is complete');
						await m.edit(text, { embed: embed });
					}
				});

				send.on('error', async (err) => {
					clearInterval(msgUpdateInterval);
					msgUpdateAllowed = false;

					if (fs.existsSync('./audios/' + userToJoin.id + '.wav')) fs.unlinkSync('./audios/' + userToJoin.id + '.wav');

					console.error(err);

					const embed = new Discord.MessageEmbed();
					embed.setTimestamp();
					embed.setTitle('Upload errored');
					embed.setDescription(((typeof err === 'string') ? (err) : ('```' + JSON.stringify(err, null, 4) + '```')));
					await m.edit(ogText, { embed: embed });
				});

				send.on('end', async (link) => {
					clearInterval(msgUpdateInterval);
					msgUpdateAllowed = false;

					if (fs.existsSync('./audios/' + userToJoin.id + '.wav')) fs.unlinkSync('./audios/' + userToJoin.id + '.wav');

					const embed = new Discord.MessageEmbed();
					embed.setTimestamp();
					embed.setTitle('Upload completed');
					embed.setURL(link.link);
					embed.setDescription('**Download link: ' + link.link + '**\n*(File will be automatically deleted after ' + link.downloadLimit + ' downloads (unless changed by file owner) or 24 hours)*\n\nAverage upload speed: ' + parseFloat(latestData.speed.averageSpeed).toFixed(2) + 'kB/s\n\n*The owner token and download password have been sent to the user who requested my join*');
					await m.edit(ogText, { embed: embed });

					msg.author.send({ embed: {
						title: 'The upload for the audio has finished',
						url: link.link,
						description: 'Download password: **' + link.password + '**\nOwner token: **' + link.ownerToken + '**\n\nUse `' + config.prefix + 'file <url> <owner token>` to edit the maximum downloads and delete the file'
					}});
				});

				msgUpdateInterval = setInterval(() => {
					msgUpdateAllowed = true;
				}, 2000);
			});

			const filter = m => m.author.id === msg.author.id && m.content.startsWith(config.prefix + 'stoprecord');
			const collector = msg.channel.createMessageCollector(filter, { max: 1 });
			collector.on('collect', (m) => {
				clearInterval(interval);
				stream.destroy();
				if (!collector.ended) collector.stop();
				if (m.deletable) m.delete();
			});

			var interval = setInterval(() => {
				if (!userToJoin.voiceChannel || userToJoin.voiceChannelID !== msg.guild.me.voiceChannelID || (new Date().getTime() - start) >= 300000) {
					clearInterval(interval);
					stream.destroy();
					if (!collector.ended) collector.stop();
				}
			}, 1);

			m.edit('Recording...\n\nUse `' + config.prefix + 'stoprecord` to stop the recording');
		});
	}
});

client.on('warn', (warn) => console.error(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
