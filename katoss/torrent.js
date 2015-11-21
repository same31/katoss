var kickass = require('kickass-torrent'),
    request = require('sync-request'),
    bencode = require('bencode-js');

function getLocationOrigin() {
    return window.location.origin || window.location.protocol + '//' + window.location.hostname +
        (window.location.port ? ':' + window.location.port : '');
}

function searchEpisode(show, season, episode, callback) {
    var url = typeof window !== 'undefined' &&  getLocationOrigin() + '/kat';
    kickass({q: show + ' S' + season + 'E' + episode, url: url}, callback);
}

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
    typeof window === 'undefined' || (url = url.replace(/^(https:\/\/torcache\.net(:\d+)?.+)$/, getLocationOrigin() + '/download?url=$1'));
    return request('GET', url, {
        followAllRedirects: true,
        encoding: 'binary',
        gzip: true
    }).getBody('binary').toString();
}

function getTorrentFiles(torrentContent) {
    var torrentInfo = bencode.decode(torrentContent);

    if (!torrentInfo.info || !torrentInfo.info.files) {
        return [];
    }

    return torrentInfo.info.files.filter(file => {
        return file.path && file.path.length > 0;
    });
}

function getTorrentFilesFilePath(file) {
    return file.path[file.path.length - 1];
}

function getFileExtension(filename) {
    return filename.substr((~-filename.lastIndexOf('.') >>> 0) + 2).toLowerCase();
}

function fileExtensionIsMovie(filename) {
    var extension = getFileExtension(filename);
    return extension && ~['avi', 'mkv', 'mp4', 'mpg', 'mpeg'].indexOf(extension);
}

function checkEpisodeTorrentContent(torrentContent) {
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
        var filename = getTorrentFilesFilePath(file);
        return fileExtensionIsMovie(filename) && parseInt(file.length) > 0;
    });
}

function getEpisodeFilename(torrentContent) {
    var files = getTorrentFiles(torrentContent);
    return files.reduce((prevFile, file) => {
        var filename = getTorrentFilesFilePath(file),
            length = parseInt(file.length);
        if (fileExtensionIsMovie(filename) && length > prevFile.length) {
            return {filename: filename, length: length};
        }

        return prevFile;
    }, {filename: '', length: 0}).filename;
}

module.exports = {
    extractTorrentFilenameAndUrl: extractTorrentFilenameAndUrl,
    checkEpisodeTorrentContent: checkEpisodeTorrentContent,
    downloadTorrentFileContent: downloadTorrentFileContent,
    getEpisodeFilename: getEpisodeFilename,
    searchEpisode: searchEpisode
};
