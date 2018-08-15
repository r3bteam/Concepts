const request = require('request');
const Discord = require('discord.js');
const client = new Discord.Client();

const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

client.on('message', async (msg) => {
	if (msg.attachments && msg.attachments.size >= 1) {
		msg.attachments.forEach(async (a) => {
			var m = await msg.channel.send('File detected. Making Virus Total check...\n\n❎ Uploaded\n❎ Queue\n❎ Result');

			request({
				url: 'https://www.virustotal.com/vtapi/v2/file/scan',
				method: 'POST',
				form: {
					apikey: config.virusTotalAPIKey,
					file: a.url
				}
			}, (error, response, body) => {
				if (error) {
					console.error(error);
					m.edit('File detected. **Failed Virus Total check**\n\n❎ Uploaded\n❎ Queue\n❎ Result');
					return;
				}

				var json = undefined;
				try { json = JSON.parse(body) } catch (err) {};
				if (!json) {
					console.log(body);
					m.edit('File detected. **Failed Virus Total check**\n\n❎ Uploaded\n❎ Queue\n❎ Result');
				}

				if (json.response_code === 1) {
					m.edit('File detected. Making Virus Total check...\n\n✅ Uploaded\n❎ Queue\n❎ Result\n\n<' + json.permalink + '>');

					var checkAmount = 0;
					function checkScanStatus() {
						request({
							url: 'https://www.virustotal.com/vtapi/v2/file/report?apikey=' + config.virusTotalAPIKey + '&resource=' + json.resource,
							method: 'GET'
						}, (error, response, body) => {
							if (error) {
								console.error(error);
								m.edit('File detected. **Failed Virus Total check**\n\n✅ Uploaded\n❎ Queue\n❎ Result');
								return;
							}

							checkAmount++;

							var jsonRes = undefined;
							try { jsonRes = JSON.parse(body) } catch (err) {};
							if (!jsonRes) {
								// Sometimes the body is completley empty for no reason. Just ignore it, I checked and everything works fine anyways.
								if (body.length > 1) {
									console.log(body);
									m.edit('File detected. **Failed Virus Total check**\n\n❎ Uploaded\n❎ Queue\n❎ Result');
									return;
								} else {
									setTimeout(checkScanStatus, 10000);
									return;
								}
							}

							if (jsonRes.response_code === 1) {
								m.edit('File detected. Virus Total finished...\n\n✅ Uploaded\n✅ Queue\n✅ Result\n\n<' + json.permalink + '>\n\n**Result:**```\nScanned by a total of ' + jsonRes.total + ' Anti-Viruses\n' + jsonRes.positives + ' Anti-Viruses triggered positive (' + (jsonRes.positives === 0 ? '0' : (parseFloat(parseInt(jsonRes.positives / jsonRes.total) * 100).toFixed(2))) + '%)```');
							} else {
								if (checkAmount >= 5 && checkAmount < 7) m.edit('File detected. Making Virus Total check...\n\n✅ Uploaded\n❎ Queue\n❎ Result\n\n<' + json.permalink + '>\n\n***I aplogize for the long delay - There is nothing I can do about it, blame VirusTotal***');
								setTimeout(checkScanStatus, 20000);
							}
						});
					}
					checkScanStatus();
				} else {
					m.edit('File detected. **Failed Virus Total check**\n\n❎ Uploaded\n❎ Queue\n❎ Result');
					console.log(json);
				}
			});
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
