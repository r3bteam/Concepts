const moment = require('moment');
const WebSocket = require('ws');
const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');

client.on('ready', () => {
	console.log('Ready to spy on ' + client.users.size + ' users, in ' + client.channels.size + ' channels of ' + client.guilds.size + ' servers as ' + client.user.tag + '.');
});

var clusterEmbed = [];

client.on('message', async (msg) => {
	if(!msg.guild || msg.content.indexOf(config.prefix) !== 0) return;

	const args = msg.content.split(/ +/g);
	const command = args.shift().slice(config.prefix.length).toLowerCase();

	if (command === 'info') {
		if (clusterEmbed.length < 1) return msg.channel.send('Did not get a response from Blargbot yet - Please try again later');
		if (!msg.guild.me.hasPermission('MANAGE_MESSAGES')) return msg.channel.send('I do not have MANAGE_MESSAGES permission - Please give it to me <3');

		var m = await msg.channel.send('Setting up...');
		await m.react('⬅');
		await m.react('➡');
		m.edit('', { embed: clusterEmbed[0] });

		const filter = (reaction, user) => (['⬅', '➡'].includes(reaction.emoji.name) && user.id === msg.author.id);
		const collector = m.createReactionCollector(filter, { time: 60000 });
		collector.on('collect', (r, u) => {
			if (r.emoji.name === '⬅') {
				var next = parseInt(m.embeds[0].color - 1);
				if (next < 0) next = parseInt(clusterEmbed.length - 1);
				m.edit({ embed: clusterEmbed[next] });
				r.users.remove(u.id);
			} else if (r.emoji.name === '➡') {
				var next = parseInt(m.embeds[0].color + 1);
				if (next >= clusterEmbed.length) next = 0;
				m.edit({ embed: clusterEmbed[next] });
				r.users.remove(u.id);
			}
		});
		collector.on('end', () => {
			m.reactions.removeAll();
			m.embeds[0] = {
				title: 'Page selection cancelled',
				color: 0
			}
			m.edit({ embed: m.embeds[0] });
		});
	}
});

client.once('ready', () => {
	let ws = new WebSocket('wss://blargbot.xyz');

	ws.onopen = () => {
		ws.send(JSON.stringify({
			type: 'requestShards'
		}));
	}

	ws.onmessage = (event) => {
		let data = JSON.parse(event.data);
		switch (data.code) {
			case 'shard':
				updateCluster(data.data);
			break;
		}
	}

	function updateCluster(data) {
		clusterEmbed[parseInt(data.id)] = {
			color: parseInt(data.id),
			description: '```md\n# Cluster ' + parseInt(data.id) + '``````prolog\nGuild: ' + data.guilds + '\nMemory: ' + parseFloat((data.rss / 1024) / 1024).toFixed(2) + '\nCPU: ' + parseFloat(data.cpu).toFixed(2) + '%\nUptime: ' + moment(data.readyTime).format('DD/MM/YYYY - HH:mm:ss') + '(gmt)\nLast Update: ' + moment(data.time).format('DD/MM/YYYY - HH:mm:ss') + '(gmt)\nShards: ' + data.shardCount + '```\n' + String.fromCodePoint(0x200B),
			fields: [],
			footer: {
				text: 'Every time you switch pages the latest data will be displayed'
			}
		}

		for (let i = 0; i < data.shards.length; i++) {
			clusterEmbed[parseInt(data.id)].fields.push({
				name: 'Shard ' + data.shards[i].id,
				value: '```prolog\nGuilds: ' + data.shards[i].guilds + '\nLatency: ' + data.shards[i].latency + ' (ms)\nLast Update: ' + moment(data.shards[i].time).format('DD/MM/YYYY - HH:mm:ss') + '(gmt)\nCluster: ' + data.shards[i].cluster + '\nStatus: ' + data.shards[i].status + '```'
			});
		}
	}
})

client.on('warn', (warn) => console.error(warn));
client.on('error', (error) => console.error(error));

client.login(config.botToken);
