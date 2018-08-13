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

	if (command === 'slider') {
		if (!args[0] || !args[1]) {
			msg.channel.send('Usage: ' + config.prefix + 'slider <elapsed time in seconds> <total length in seconds>');
			return;
		}

		var elapsed = parseInt(args[0]);
		var total = parseInt(args[1]);

		if (isNaN(elapsed) || isNaN(total) || elapsed < 0 || total <= 0 || total < elapsed) {
			msg.channel.send('Invalid integer\n\nElapsed must be 0 or higher, Total must be higher than 0\nTotal can not be above elapsed');
			return;
		}

		var percentage = parseFloat((elapsed / total) * 100);
		var closest10 = Math.round(percentage / 10) * 10;
		var slider = [];
		for (let i = 0; i < 10; i++) slider.push(String.fromCodePoint(9473));
		slider[parseInt(closest10 / 10)] = '⬤';

		msg.channel.send(((parseInt(closest10 / 10) === 0) ? '*When the slider is on the very left it is broken for Windows 7 users and maybe other platforms too*\n\n' : '') + '```\nVideo is ' + percentage.toFixed(2) + '% done playing\n' + secToString(elapsed) + ' ' + slider.join('') + ' ' + secToString(total) + '```');
	}
});

function secToString(secs) {
	var mins = 0;
	var hours = 0;
	var days = 0;

	while (secs >= 60) {
		mins = mins + 1;
		secs = secs - 60;
	}

	while (mins >= 60) {
		hours = hours + 1;
		mins = mins - 60;
	}

	while (hours >= 24) {
		days = days + 1;
		hours = hours - 24;
	}

	if (days >= 1) {
		return days + ':' + ((hours <= 9) ? ('0' + hours) : (hours)) + ':' + ((mins <= 9) ? ('0' + mins) : (mins)) + ':' + ((secs <= 9) ? ('0' + secs) : (secs));
	} else if (hours >= 1) {
		return hours + ':' + ((mins <= 9) ? ('0' + mins) : (mins)) + ':' + ((secs <= 9) ? ('0' + secs) : (secs));
	} else {
		return mins + ':' + ((secs <= 9) ? ('0' + secs) : (secs));
	}
}

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
