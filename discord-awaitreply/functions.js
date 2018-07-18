module.exports = (client) => {
	client.awaitReply = (channel, respondent, time) => {
		return new Promise((resolve, reject) => {
			if (!channel) reject('No channel specified');
			if (!respondent) reject('No respondent specified');
			if (!time) reject('No time specified');

			const filter = m => m.author.id === respondent.id;
			channel.awaitMessages(filter, { max: 1, time: parseInt(time * 1000), errors: ['time'] }).then((response) => {
				resolve(response.first());
			}).catch((err, reason) => {
				reject('Got no response within ' + time + ' seconds');
			});
		});
	}
}
