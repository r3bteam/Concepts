const request = require('request');
const fs = require('fs');
const sharp = require('sharp');
const config = require('./config.json');

var channel = 'gamesdonequick';

request({
	uri: 'https://api.twitch.tv/kraken/streams/' + channel,
	headers: {
		'Client-Id': config.twitchClientId
	}
}, (error, response, body) => {
	if (error) return console.error(error);

	var json = undefined;
	try {
		json = JSON.parse(body);
	} catch (err) {}
	if (!json) return console.log(body);

	if (!json || !json.stream || !json.stream.preview || !json.stream.preview.template) return;
	if (fs.existsSync('./streamSnapshot.png')) fs.unlinkSync('./streamSnapshot.png');
	if (fs.existsSync('./croppedSnapshot.png')) fs.unlinkSync('./croppedSnapshot.png');

	request(json.stream.preview.template.replace('{width}', '1920').replace('{height}', '1080')).pipe(fs.createWriteStream('streamSnapshot.png')).on('close', () => {
		sharp('streamSnapshot.png').extract({ left: 1522, top: 1014, width: 232, height: 65 }).toFile('croppedSnapshot.png', (err) => {
			if (err) return console.error(err);
			if (!fs.existsSync('./croppedSnapshot.png')) return console.log('No image');

			fs.readFile('./croppedSnapshot.png', (err, data) => {
				if (err) return console.error(err);

				var buffer = new Buffer(data).toString('base64');

				request({
					url: 'https://api.imgur.com/3/upload',
					method: 'POST',
					form: {
						image: buffer,
						type: 'base64'
					},
					headers: {
						Authorization: 'Client-ID ' + config.imgurAPIKey,
						Accept: 'application/json'
					}
				}, (error, response, body) => {
					if (error) return console.error(error);

					var json = undefined;
					try {
						json = JSON.parse(body);
					} catch (err) {}
					if (!json) return console.log('Failed to parse JSON response');
					
					var url = 'https://i.imgur.com/' + json.data.id + '.png';
					request('https://api.ocr.space/parse/imageurl?apikey=' + config.ocrAPIKey + '&url=' + url, (error, response, body) => {
						if (error) return console.error(error);
						
						var json = undefined;
						try {
							json = JSON.parse(body);
						} catch (err) {}
						if (!json) return console.log('Failed to parse JSON response');

						if (json.ErrorMessage && json.ErrorMessage.length >= 1) return console.log('Error: ' + json.ErrorMessage[0]);
						if (!json.ParsedResults || json.ParsedResults.length < 1) return console.log('Failed to parse image into text');

						var text = json.ParsedResults[0].ParsedText.replace(/ |\\r|\\n|\r|\n/g, '');
						var number = parseInt(text);
						console.log('Text: ' + text + '\nNumber: ' + number);
					});
				});
			});
		});
	})
});

setTimeout(() => {}, 9999999);