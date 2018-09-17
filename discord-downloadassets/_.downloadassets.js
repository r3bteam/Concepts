const fetch = require('node-fetch');
const fs = require('fs');
const config = require('./config.json');

(async () => {
	var res = await fetch('https://discordapp.com/api/oauth2/applications/' + config.clientid + '/assets');
	var assets = await res.json();

	if (assets.code === 0) {
		console.log(assets.message || assets);
		return;
	}

	if (!Array.isArray(assets)) {
		console.log(assets);
		return;
	}

	console.log('Downloading ' + assets.length + ' assets...');

	for (let i in assets) {
		if (![ 1, 2 ].includes(assets[i].type)) {
			console.log((parseInt(i) + 1) + ': Skipped ' + assets[i].name + ' (' + assets[i].id + ') as it is not a type 1 or 2');
			continue;
		}

		await new Promise(async (resolve, reject) => {
			var res = await fetch('https://cdn.discordapp.com/app-assets/' + config.clientid + '/' + assets[i].id + '.png');

			try {
				if (!fs.existsSync('./assets')) {
					fs.mkdirSync('./assets');
				} else {
					if (!fs.statSync('./assets').isDirectory()) {
						fs.mkdirSync('./assets');
					}
				}
			} catch(e) {};

			var destination = fs.createWriteStream('./assets/' + assets[i].name + '.png');
			res.body.pipe(destination);
			destination.on('close', () => {
				console.log((parseInt(i) + 1) + ': Finished downloading ' + assets[i].name + ' (' + assets[i].id + ')');
				resolve();
			});
			res.body.on('error', (err) => {
				reject(err);
			});
		});
	}

	console.log('Finished downloading ' + assets.length + ' assets');

	setTimeout(() => {}, (24 * 60 * 60 * 1000));
})();
