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

client.once('ready', () => {
	var lastDate = undefined;

	function updateTime() {
		request('https://www.whenisthenextsteamsale.com/', function(error, response, body) {
			if (error) {
				setTimeout(updateTime, parseInt(60 * 1000));
				return console.error(error);
			}

			const $ = cheerio.load(body);
			var nextSale = $('#hdnNextSale');
			var sale = JSON.parse(nextSale['0'].attribs.value);
			var saleDate = moment.utc(sale.StartDate).valueOf() - moment.utc().valueOf();

			var duration = undefined;
			if (saleDate > parseInt(259200 * 1000)) {
				// More than 3 day left
				duration = moment.duration(saleDate).format(' D [days]');
				setTimeout(updateTime, parseInt(3600 * 1000));
			} else if (saleDate > parseInt(86400 * 1000) && saleDate <= parseInt(259200 * 1000)) {
				// More than 1 day left and less than 3 days
				duration = moment.duration(saleDate).format(' D [days], H [hrs]');
				setTimeout(updateTime, parseInt(1800 * 1000));
			} else if (saleDate <= parseInt(86400 * 1000) && saleDate >= parseInt(3600 * 1000)) {
				// Less than 24 hours left and more than 1 hour
				duration = moment.duration(saleDate).format(' H [hrs], m [mins]');
				setTimeout(updateTime, parseInt(300 * 1000));
			} else if (saleDate < parseInt(3600 * 1000) && saleDate > parseInt(300 * 1000)) {
				// Less than an hour and more than 5 minutes
				duration = moment.duration(saleDate).format(' m [mins]');
				setTimeout(updateTime, parseInt(60 * 1000));
			} else if (saleDate <= parseInt(300 * 1000) && saleDate > 600000) {
				// Less or equals to 5 minutes and more than 0 milliseconds
				duration = moment.duration(saleDate).format(' m [mins], s [secs]');
				setTimeout(updateTime, parseInt(10 * 1000));
			} else if (saleDate <= 600000 && saleDate > 0) {
				duration = moment.duration(saleDate).format(' s [secs]');
				setTimeout(updateTime, parseInt(0.5 * 1000));
			} else {
				duration = 'SALE LIVE';
				setTimeout(updateTime, parseInt(60 * 1000));
			}

			if (lastDate === duration) return;
			lastDate = duration;

			client.user.setActivity(sale.Name + ': ' + duration);
		});
	}
	updateTime();
});

client.on('message', async (msg) => {
	if (msg.content === '<@' + client.user.id + '>' || msg.content === '<@!' + client.user.id + '>') {
		request('https://www.whenisthenextsteamsale.com/', function(error, response, body) {
			if (error) {
				return console.error(error);
			}

			const $ = cheerio.load(body);
			var nextSale = $('#hdnNextSale');
			var sale = JSON.parse(nextSale['0'].attribs.value);
			var saleDate = moment.utc(sale.StartDate).valueOf() - moment.utc().valueOf();
			var duration = moment.duration(saleDate).format(' D [days], H [hrs], m [mins], s [secs]');
			
			if (saleDate > 0) msg.channel.send(sale.Name + ': LIVE');
			else msg.channel.send(sale.Name + ': ' + duration);
		});
	}
});

client.on('warn', (warn) => console.warn(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);