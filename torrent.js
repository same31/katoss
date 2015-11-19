var request = require('sync-request'),
	bencode = require('bencode-js');

function extractTorrentFilenameAndUrl(url) {
	var urlMatches = url.match(/^(.+)\?title=(.+)$/);
	if (!urlMatches) {
		throw Error('URL and filename cannot be extracted from this URL ' + url);
	}
	
	return {
		url: urlMatches[1],
		filename: urlMatches[2] + '.torrent'
	};
}
	
function downloadTorrentFileContent(url) {
	return request('GET', url, {
		followAllRedirects: true,
		encoding: 'binary',
		gzip: true
	}).getBody('binary').toString();
}

function checkEpisodeTorrentContent(torrentContent) {
	var torrentInfo = bencode.decode(torrentContent);
	// Check...
	return true;
}

module.exports = {
	extractTorrentFilenameAndUrl: extractTorrentFilenameAndUrl,
	checkEpisodeTorrentContent: checkEpisodeTorrentContent,
	downloadTorrentFileContent: downloadTorrentFileContent
};