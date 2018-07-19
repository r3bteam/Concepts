module.exports = (client) => {
	/**
	 * Fetches all messages in a specific channel - Big/Old channels will take a very long time and will spam the API a lot
	 * @param {channel} channel Discord Channel object
	 */
	client.fetchAllMessages = (channel) => {
		return new Promise(async (resolve, reject) => {
			if (!channel) return reject('No channel specified');

			var messages = await channel.messages.fetch({limit: 100}).catch((err) => reject(err));
			if (!messages) return;
			var allMessages = messages;

			function fetchMsgs() {
				channel.messages.fetch({before: allMessages.last().id, limit: 100}).then((messages) => {
					if (messages.size < 1) {
						resolve(allMessages);
					} else {
						allMessages = allMessages.concat(messages);
						fetchMsgs();
					}
				}).catch((err) => {
					reject(err);
				});
			}
			fetchMsgs();
		});
	}
};