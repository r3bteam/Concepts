const childProcess = require('child_process');
const events = require('events');
const util = require('util');

function uploadFirefox() {
	events.EventEmitter.call(this);

	/**
	 * Create random string
	 * @param {number} length Length of the string
	 * @returns {string} The random string you requested
	 */
	this.randomString = (length = 10) => {
		var text = '';
		var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (var i = 0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
		return text;
	}

	/**
	 * Start the upload of a file. When finished returns downloadLimit, link & ownerToken
	 * @param {string} file File name you want to upload 
	 * @param {number} downloadLimit Amount of downloads before self-delete 1-20 (Default: 1)
	 * @example send.uploadFile('sunsets.zip', 5);
	 */
	this.uploadFile = (file, downloadLimit = 1) => {
		if (isNaN(downloadLimit)) downloadLimit = 1;
		if (downloadLimit > 20) downloadLimit = 20;
		if (downloadLimit < 1) downloadLimit = 1;

		var password = this.randomString();

		const child = childProcess.spawn('py', [ 'send-cli ../../../' + file, '--download-limit ' + downloadLimit, '--password-unsafe ' + password ], { cwd: './send-cli/build/scripts-3.6', shell: true });
		var uploadingProgressing = false;
		var allSpeeds = [];

		child.stdout.on('data', (data) => {
			if (data.toString().includes('Uploading "')) {
				uploadingProgressing = true;
			} else if (data.toString().includes('https://send.firefox.com/download/')) {
				var split = data.toString().split('\n');
				if (!split || split.length < 1) {
					this.emit('error', 'Failed to get download link');
					return;
				}

				var lines = [];
				for (let i = 0; i < split.length; i++) {
					split[i] = split[i].replace(/\r/g, '');

					if (split[i].length >= 1) {
						lines.push(split[i]);
					}
				}

				var link = undefined;
				var token = undefined;
				for (let i = 0; i < lines.length; i++) {
					if (lines[i].startsWith('https://send.firefox.com/download/')) {
						link = lines[i];
					} else if (lines[i].includes('this token: ')) {
						var line = lines[i];
						var split = line.split('this token: ');
						token = split[split.length - 1];
					}
				}

				if (!link) {
					this.emit('error', 'Failed to get download link');
					return;
				}

				var data = {
					downloadLimit: downloadLimit,
					link: link,
					ownerToken: token,
					password: password
				}
				this.emit('end', data);
			}
		});

		child.stderr.on('data', (data) => {
			if (!uploadingProgressing) return;

			var data = data.toString();
			if (!data) return;

			var split = data.replace(/  /g, '').replace(/\|.*\|/gi, '').split(' ');
			if (!split || split.length < 1) return;

			for (let i = 0; i < split.length; i++) split[i] = split[i].replace(/\r/g, '').replace('[', '').replace(']', '');

			var removeEmpty = [];
			for (let i = 0; i < split.length; i++) if (split[i].length >= 1) removeEmpty.push(split[i]);
			split = removeEmpty;
			if (!split || split.length < 4) return;

			allSpeeds.push(split[3].split('/s')[0] + '/s');

			var floats = [];
			for (let i = 0; i < allSpeeds.length; i++) {
				if (allSpeeds[i].endsWith('kB/s')) {
					floats.push(parseFloat(allSpeeds[i].replace(/[^.0-9]/g, '')));
				} /* else if (allSpeeds[i].endsWith('mB/s')) {

					// I dont know the actual speeds that get displayed.
					// Is it "kB/s" only or are there "mB/s"?
					// And if there are other units what are they called exactly?

					floats.push(parseFloat(allSpeeds[i].replace(/[^.0-9]/g, '') * 1024));
				} */
			}

			var allFloats = 0;
			for (let i = 0; i < floats.length; i++) allFloats += floats[i];
			var averageSpeed = parseFloat(allFloats / floats.length);

			var data = {
				progress: {
					percentage: split[0],
					uploaded: split[1].split('/')[0],
					total: split[1].split('/')[1]
				},
				time: {
					passed: split[2].split('<')[0],
					remaining: split[2].split('<')[1].replace(',', '')
				},
				speed: {
					curSpeed: split[3].split('/s')[0] + '/s',
					allSpeeds: allSpeeds,
					averageSpeed: averageSpeed
				}
			}

			if (data.progress.uploaded === '0.00') {
				allSpeeds.shift();
				return;
			}

			this.emit('progress', data);
		});

		child.on('exit', (code, signal) => {
			if (code !== 0) {
				var error = {
					code: code,
					signal: signal
				}
				this.emit('error', error);
			}
		});
	}
};
util.inherits(uploadFirefox, events)

module.exports = uploadFirefox;



return; // Example down below

// Test
var send = new uploadFirefox();
send.uploadFile('./425563099433795584.wav');

send.on('progress', (data) => {
	console.log(data);
	/*
	{
		progress: {
			percentage: '100%', // Upload percentage
			uploaded: '40.5M', // How much we have already uploaded
			total: '40.5M' // Total file size
		},
		time: {
			passed: '08:06', // How much time has passed
			remaining: '00:00' // How much time is approximately remaining
		},
		speed: {
			curSpeed: '83.2kB/s', // Current upload speed
			allSpeeds: [ // Array of all upload speeds
				'14.1kB/s',
				'18.8kB/s',
				'22.0kB/s',
				'25.8kB/s',
				'30.7kB/s',
				.
				.
				.
			],
			averageSpeed: 83.47945091514151 // Average upload speed in kB/s - Note: This may be a bit inaccurate. I dont know if the CLI displays mB/s or anything else so here I only calculate kB/s
		}
	}
	*/
});

send.on('error', (err) => {
	console.error(err);
	/*
	{
		code: 1, // Exit code
		signal: null // Exit signal
	}
	*/

	/*
	"Failed to get download link" // String - Emitted when the download is successful but couldn't find a download link
	*/
});

send.on('end', (link) => {
	console.log(link);
	/*
	{
		downloadLimit: 1, // The amount of downloads allowed (Min 1, Max 20)
		link: "https://send.firefox.com/download/1203a1f120/#I5wmjSZHq1eLZ8Ly_xz7kg" // Download URL
		ownerToken: "d472c00fff4d4d5ef6bf", // Owner token to delete the file, add/change password & change max downloads (Note: If the token is not found this will be undefined. Usually there is ALWAYS a download url and token so it shouldnt be a problem)
		password: "assaSAONF12"
	}
	*/
});
