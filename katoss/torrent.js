var request = require('sync-request'),
	bencode = require('bencode-js');

function extractTorrentFilenameAndUrl (url) {
	var urlMatches = url.match(/^(.+)\?title=(.+)$/);
	if (!urlMatches) {
		throw Error('URL and filename cannot be extracted from this URL ' + url);
	}
	
	return {
		url: urlMatches[1],
		filename: urlMatches[2] + '.torrent'
	};
}
	
function downloadTorrentFileContent (url) {
	return request('GET', url, {
		followAllRedirects: true,
		encoding: 'binary',
		gzip: true
	}).getBody('binary').toString();
}

function getFileExtension (filename) {
	return filename.substr((~-filename.lastIndexOf('.') >>> 0) + 2).toLowerCase();
}

function getTorrentFilesFilePath (file) {
	return file.path[file.path.length - 1];
}

function getTorrentFiles(torrentContent) {
	var torrentInfo = bencode.decode(torrentContent);
		
	if (! torrentInfo.info || !torrentInfo.info.files) {
		return [];
	}
	
	return torrentInfo.info.files.filter(file => {
		return file.path && file.path.length > 0;
	});
}

function checkEpisodeTorrentContent (torrentContent) {
	var files = getTorrentFiles(torrentContent);
	
	// Invalid if there is a .exe file
	// -------------------------------
	if (files.some(file => {
		return getFileExtension(getTorrentFilesFilePath(file)) === 'exe';
	})) {
		return false;
	}
	
	// Valid if there is a movie file with length > 0
	// ----------------------------------------------
	return files.some(file => {
		var extension = getFileExtension(getTorrentFilesFilePath(file));
		return extension && ~['avi', 'mkv', 'mp4', 'mpg', 'mpeg'].indexOf(extension) && parseInt(file.length) > 0;
	});
}

function getEpisodeFilename (torrentContent) {
	var files = getTorrentFiles(torrentContent);
	return files.reduce((prevFile, file) => {
		var filename = getTorrentFilesFilePath(file),
			extension = getFileExtension(filename),
			length = parseInt(file.length);
		if (extension && ~['avi', 'mkv', 'mp4', 'mpg', 'mpeg'].indexOf(extension) && length > prevFile.length) {
			return {filename: filename, length: length};
		}
		
		return prevFile;
	}, {filename: '', length: 0}).filename;
}

module.exports = {
	extractTorrentFilenameAndUrl: extractTorrentFilenameAndUrl,
	checkEpisodeTorrentContent: checkEpisodeTorrentContent,
	downloadTorrentFileContent: downloadTorrentFileContent,
	getEpisodeFilename: getEpisodeFilename
};
