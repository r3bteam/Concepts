const request = require('request');
const cheerio = require('cheerio');
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

		msg.channel.send(((parseInt(closest10 / 10) === 0) ? '*Only supports Windows 10 😒*\n\n' : '') + '```\nVideo is ' + percentage.toFixed(2) + '% done playing\n' + secToString(elapsed) + ' ' + slider.join('') + ' ' + secToString(total) + '```');
	}
});

function secToString(secs) {
	var mins = 0;
	while (secs >= 60) {
		mins = mins + 1;
		secs = secs - 60;
	}
	return mins + ':' + ((secs <= 9) ? ('0' + secs) : (secs));
}

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
