const request = require('request');
const ytdl = require('ytdl-core');
const m3u = require('m3ujs');
const moment = require('moment');
require('moment-duration-format');
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
		if (!args[0]) return msg.channel.send('Usage: ' + config.prefix + 'join <channelName>').catch(() => {});
		if (!msg.member.voiceChannel) return msg.channel.send('Join a voice channel').catch(() => {});
		if (!msg.member.voiceChannel.joinable) return msg.channel.send('I cannot join').catch(() => {});
		if (msg.guild.me.voiceChannel) return msg.channel.send('Already playing').catch(() => {});

		var m = await msg.channel.send('***Please wait...***\n\n🔁 Get channel info\n📨 Get access tokens\n📨 Get direct streaming urls\n📨 Join voice channel\n📨 Start stream').catch(() => {});
		if (!m) return; // Failed to send message

		request({
			uri: 'https://api.twitch.tv/kraken/streams/' + args[0].toLowerCase(),
			headers: {
				'Client-Id': config.twitchClientID
			}
		}, async (error, response, body) => {
			if (error) {
				m.edit('***Failed to get Twitch API response***\n\n❌ Get channel info\n❌ Get access tokens\n❌ Get direct streaming urls\n❌ Join voice channel\n❌ Start stream');
				console.error(error);
				return;
			}

			var json = undefined;
			try {
				json = JSON.parse(body);
			} catch (err) {}
			if (!json && json) {
				m.edit('***Malformed Twitch API response***\n\n❌ Get channel info\n❌ Get access tokens\n❌ Get direct streaming urls\n❌ Join voice channel\n❌ Start stream');
				console.log(body);
				return;
			}

			if (!json.stream || json.stream === null) {
				var videoID = ytdl.getVideoID(args[0]);
				if (!videoID) return m.edit('***Channel does not exist & Invalid YouTube URL***\n\n❌ Get channel info\n❌ Get access tokens\n❌ Get direct streaming urls\n❌ Join voice channel\n❌ Start stream');

				await m.edit('***Please wait...***\n\n☑ Verify video ID\n🔁 Get channel info\n📨 Get direct streaming url\n📨 Join voice channel\n📨 Start stream');

				request('https://www.googleapis.com/youtube/v3/videos?part=id%2C+snippet&id=' + videoID + '&key=' + config.youtubeAPIkey, async (error, response, body) => {
					if (error) {
						m.edit('***Failed to get YouTube API response***\n\n☑ Verify video ID\n❌ Get channel info\n❌ Get direct streaming url\n❌ Join voice channel\n❌ Start stream');
						console.error(error);
						return;
					}

					var json = undefined;
					try {
						json = JSON.parse(body);
					} catch (err) {}
					if (!json) {
						m.edit('***Malformed YouTube API response***\n\n☑ Verify video ID\n❌ Get channel info\n❌ Get direct streaming url\n❌ Join voice channel\n❌ Start stream');
						console.log(body);
						return;
					}

					if (!json.items || json.items.length <= 0) {
						m.edit('***Failed to get video info***\n\n☑ Verify video ID\n❌ Get channel info\n❌ Get direct streaming url\n❌ Join voice channel\n❌ Start stream');
						console.log(json);
						return;
					}

					if (json.items[0].snippet.liveBroadcastContent !== 'live') return m.edit('***Stream is not live***\n\n☑ Verify video ID\n❌ Get channel info\n❌ Get direct streaming url\n❌ Join voice channel\n❌ Start stream');

					var channelName = json.items[0].snippet.channelTitle;
					
					await m.edit('***Please wait...***\n\n☑ Verify video ID\n☑ Get channel info\n🔁 Get direct streaming url\n📨 Join voice channel\n📨 Start stream');

					request('https://www.youtube.com/get_video_info?&video_id=' + json.items[0].id, async (error, response, body) => {
						if (error) {
							m.edit('***Failed to get YouTube API response***\n\n☑ Verify video ID\n☑ Get channel info\n❌ Get direct streaming url\n❌ Join voice channel\n❌ Start stream');
							console.error(error);
							return;
						}

						if (body.length < 100) {
							m.edit('***Malformed YouTube API response***\n\n☑ Verify video ID\n☑ Get channel info\n❌ Get direct streaming url\n❌ Join voice channel\n❌ Start stream');
							console.error(error);
							return;
						}

						var data = parse_str(body);
						if (!data || !data.hlsvp) {
							m.edit('***Failed to parse streaming URLs***\n\n☑ Verify video ID\n☑ Get channel info\n❌ Get direct streaming url\n❌ Join voice channel\n❌ Start stream');
							console.log(body);
							return;
						}

						await m.edit('***Please wait...***\n\n☑ Verify video ID\n☑ Get channel info\n☑ Get direct streaming url\n🔁 Join voice channel\n📨 Start stream');

						msg.member.voiceChannel.join().then(async (connection) => {
							await m.edit('***Please wait...***\n\n☑ Verify video ID\n☑ Get channel info\n☑ Get direct streaming url\n☑ Join voice channel\n🔁 Start stream');

							await m.edit('***Now streaming `' + channelName + '`***\n*It can take a few seconds for the audio to start streaming*\n\nNow available commands: ```md\ntime - Display current streaming duration\n\n# ' + msg.author.tag + ' only\nstop - Stop the stream```\n\n☑ Verify video ID\n☑ Get channel info\n☑ Get direct streaming url\n☑ Join voice channel\n☑ Start stream');
							var stream = connection.play(data.hlsvp);

							var onlyOnce = false;
							var streamEnd = undefined;
							var collector = undefined;
							stream.on('speaking', (isSpeaking) => {
								if (isSpeaking && !onlyOnce) {
									onlyOnce = true;
									m.edit('***Now streaming `' + channelName + '`***\n\nNow available commands: ```md\ntime - Display current streaming duration\n\n# ' + msg.author.tag + ' only\nstop - Stop the stream```\n\n☑ Verify video ID\n☑ Get channel info\n☑ Get direct streaming url\n☑ Join voice channel\n☑ Start stream');
								} 
								
								if (isSpeaking) {
									if (streamEnd) clearTimeout(streamEnd);
								} else if (!isSpeaking) {
									streamEnd = setTimeout(async () => {
										m = await m.channel.messages.fetch(m.id).catch(() => {});
										if (m) m.edit('***`' + channelName + ' has stopped streaming`***\n\n☑ Verify video ID\n☑ Get channel info\n☑ Get direct streaming url\n☑ Join voice channel\n☑ Start stream');
										if (collector && !collector.ended) collector.stop();
										if (msg.guild.me.voiceChannel) msg.guild.me.voiceChannel.leave();
									}, 5000);
								}
							});

							const filter = m => m.content.startsWith(config.prefix);
							collector = msg.channel.createMessageCollector(filter);
							collector.on('collect', async (m) => {
								const args = m.content.split(/ +/g);
								const command = args.shift().slice(config.prefix.length).toLowerCase();

								if (command === 'stop' && msg.author.id === m.author.id) {
									stream.end();
									if (collector && !collector.ended) collector.stop();
									if (msg.guild.me.voiceChannel) await msg.guild.me.voiceChannel.leave();
									msg.channel.send('Successfully stopped playing `' + channelName + '`');
								} else if (command === 'time' || command === 'duration') {
									msg.channel.send('Stream Time: ' + moment.duration(stream.streamTime).format('H [hrs], m [mins], s [secs]') + '\nTotal Stream Time: (Including pauses) ' + moment.duration(stream.totalStreamTime).format('H [hrs], m [mins], s [secs]'));
								}
							});
						}).catch(async (err) => {
							console.error(err);

							await m.edit('***Failed to join voice channel***\n\n☑ Verify video ID\n☑ Get channel info\n☑ Get direct streaming url\n❌ Join voice channel\n❌ Start stream');
						})
					});
				});
			} else {
				if (!json || !json.stream || !json.stream.stream_type || !json.stream.channel || !json.stream.channel.url || !json.stream.channel.name) {
					m.edit('***Malformed Twitch API response***\n\n❌ Get channel info\n❌ Get access tokens\n❌ Get direct streaming urls\n❌ Join voice channel\n❌ Start stream');
					console.log(json);
					return;
				}

				if (json.stream.stream_type !== 'live') return m.edit('***Stream is not live***\n\n❌ Get channel info\n❌ Get access tokens\n❌ Get direct streaming urls\n❌ Join voice channel\n❌ Start stream');

				var channelName = json.stream.channel.name;

				await m.edit('***Please wait...***\n\n☑ Get channel info\n🔁 Get access tokens\n📨 Get direct streaming urls\n📨 Join voice channel\n📨 Start stream');

				request({
					uri: 'https://api.twitch.tv/api/channels/' + channelName + '/access_token',
					headers: {
						'Client-Id': config.twitchClientID
					}
				}, async (error, response, body) => {
					if (error) {
						m.edit('***Failed to get Twitch API response***\n\n☑ Get channel info\n❌ Get access tokens\n❌ Get direct streaming urls\n❌ Join voice channel\n❌ Start stream');
						console.error(error);
						return;
					}

					var json = undefined;
					try {
						json = JSON.parse(body);
					} catch (err) {}
					if (!json) {
						m.edit('***Malformed Twitch API response***\n\n☑ Get channel info\n❌ Get access tokens\n❌ Get direct streaming urls\n❌ Join voice channel\n❌ Start stream');
						console.log(body);
						return;
					}

					if (!json.token || !json.sig) {
						m.edit('***Malformed Twitch API response***\n\n☑ Get channel info\n❌ Get access tokens\n❌ Get direct streaming urls\n❌ Join voice channel\n❌ Start stream');
						console.log(json);
						return;
					}

					await m.edit('***Please wait...***\n\n☑ Get channel info\n☑ Get access tokens\n🔁 Get direct streaming urls\n📨 Join voice channel\n📨 Start stream');

					request({
						uri: 'http://usher.twitch.tv/api/channel/hls/' + channelName + '.m3u8?player=twitchweb&&token=' + json.token + '&sig=' + json.sig + '&allow_audio_only=true&allow_source=true&type=any&p=' + Math.floor(Math.random() * (999999 - 111111 + 1)) + 111111
					}, async (error, response, body) => {
						if (error) {
							m.edit('***Failed to get Twitch API response***\n\n☑ Get channel info\n☑ Get access tokens\n❌ Get direct streaming urls\n❌ Join voice channel\n❌ Start stream');
							console.error(error);
							return;
						}

						var streams = m3u.parse(body);
						if (!streams || !streams.tracks || streams.tracks.length <= 0) {
							m.edit('***Failed to parse streaming URLs***\n\n☑ Get channel info\n☑ Get access tokens\n❌ Get direct streaming urls\n❌ Join voice channel\n❌ Start stream');
							console.log(body);
							return;
						}

						await m.edit('***Please wait...***\n\n☑ Get channel info\n☑ Get access tokens\n☑ Get direct streaming urls\n🔁 Join voice channel\n📨 Start stream');

						msg.member.voiceChannel.join().then(async (connection) => {
							await m.edit('***Please wait...***\n\n☑ Get channel info\n☑ Get access tokens\n☑ Get direct streaming urls\n☑ Join voice channel\n🔁 Start stream');

							await m.edit('***Now streaming `' + channelName + '`***\n*It can take a few seconds for the audio to start streaming*\n\nNow available commands: ```md\ntime - Display current streaming duration\n\n# ' + msg.author.tag + ' only\nstop - Stop the stream```\n\n☑ Get channel info\n☑ Get access tokens\n☑ Get direct streaming urls\n☑ Join voice channel\n☑ Start stream');
							var stream = connection.play(streams.tracks[streams.tracks.length - 1].file);

							var onlyOnce = false;
							var streamEnd = undefined;
							var collector = undefined;
							stream.on('speaking', (isSpeaking) => {
								if (isSpeaking && !onlyOnce) {
									onlyOnce = true;
									m.edit('***Now streaming `' + channelName + '`***\n\nNow available commands: ```md\ntime - Display current streaming duration\n\n# ' + msg.author.tag + ' only\nstop - Stop the stream```\n\n☑ Get channel info\n☑ Get access tokens\n☑ Get direct streaming urls\n☑ Join voice channel\n☑ Start stream');
								}

								if (isSpeaking) {
									if (streamEnd) clearTimeout(streamEnd);
								} else if (!isSpeaking) {
									streamEnd = setTimeout(async () => {
										m = await m.channel.messages.fetch(m.id).catch(() => {});
										if (m) m.edit('***`' + channelName + ' has stopped streaming`***\n\n☑ Verify video ID\n☑ Get channel info\n☑ Get direct streaming url\n☑ Join voice channel\n☑ Start stream');
										if (collector && !collector.ended) collector.stop();
										if (msg.guild.me.voiceChannel) msg.guild.me.voiceChannel.leave();
									}, 5000);
								}
							});

							const filter = m => m.content.startsWith(config.prefix);
							collector = msg.channel.createMessageCollector(filter);
							collector.on('collect', async (m) => {
								const args = m.content.split(/ +/g);
								const command = args.shift().slice(config.prefix.length).toLowerCase();

								if (command === 'stop' && msg.author.id === m.author.id) {
									stream.end();
									if (collector && !collector.ended) collector.stop();
									if (msg.guild.me.voiceChannel) await msg.guild.me.voiceChannel.leave();
									msg.channel.send('Successfully stopped playing `' + channelName + '`');
								} else if (command === 'time' || command === 'duration') {
									msg.channel.send('Stream Time: ' + moment.duration(stream.streamTime).format('H [hrs], m [mins], s [secs]') + '\nTotal Stream Time: (Including pauses) ' + moment.duration(stream.totalStreamTime).format('H [hrs], m [mins], s [secs]'));
								}
							});
						}).catch(async (err) => {
							console.error(err);

							await m.edit('***Failed to join voice channel***\n\n☑ Get channel info\n☑ Get access tokens\n☑ Get direct streaming urls\n☑ Join voice channel\n❌ Start stream');
						});
					});
				});
			}
		});
	} else if (command === 'releave') {
		msg.member.voiceChannel.join().then(() => {
			msg.guild.me.voiceChannel.leave();
			msg.channel.send('Done');
		});
	}
});

client.on('warn', (warn) => console.warn(warn));

client.on('error', (error) => console.error(error));

client.login(config.botToken);

function parse_str(str) {
	return str.split('&').reduce(function(params, param) {
	  var paramSplit = param.split('=').map(function(value) {
		return decodeURIComponent(value.replace('+', ' '));
	  });
	  params[paramSplit[0]] = paramSplit[1];
	  return params;
	}, {});
}
