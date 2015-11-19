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

function _getFileExtension(filename) {
	return filename.substr((~-filename.lastIndexOf('.') >>> 0) + 2).toLowerCase();
}

function checkEpisodeTorrentContent(torrentContent) {
	var torrentInfo = bencode.decode(torrentContent),
		files,
		getFilePath;
		
	if (! torrentInfo.info || !torrentInfo.info.files) {
		return false;
	}
	
	files = torrentInfo.info.files.filter(file => {
		return file.path && file.path.length > 0;
	});
	
	getFilePath = file => {
		return file.path[file.path.length - 1];
	};
	
	if (files.some(file => {
		return _getFileExtension(getFilePath(file)) === 'exe';
	})) {
		return false;
	}
	
	return files.some(file => {
		var extension = _getFileExtension(getFilePath(file));
		return extension && ~['avi', 'mkv', 'mp4', 'mpg', 'mpeg'].indexOf(extension) && parseInt(file.length) > 0;
	});
}

module.exports = {
	extractTorrentFilenameAndUrl: extractTorrentFilenameAndUrl,
	checkEpisodeTorrentContent: checkEpisodeTorrentContent,
	downloadTorrentFileContent: downloadTorrentFileContent
};