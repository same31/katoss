var utils = require('./utils'),
    kickass = require('kickass-torrent'),
    request = require('sync-request'),
    bencode = require('bencode-js');


function searchEpisode (show, season, episode, callback) {
    var url = typeof window !== 'undefined' && utils.getLocationOrigin() + '/kat';
    kickass({ q: utils.formatShowTitle(show) + ' S' + season + 'E' + episode, url: url },
        typeof callback === 'function' && callback);
}

function extractTorrentFilenameAndUrl (url) {
    var urlMatches = url.trim().match(/^(.+)\?title=(.+)$/);
    if (!urlMatches) {
        throw Error('URL and filename cannot be extracted from this URL ' + url);
    }

    return {
        url:      urlMatches[1],
        filename: urlMatches[2] + '.torrent'
    };
}

function downloadTorrentFileContent (url) {
    url = url.trim();
    typeof window === 'undefined' || (url = url.replace(/^(https:\/\/torcache\.net(:\d+)?.+)$/, utils.getLocationOrigin() + '/download?url=$1'));
    var response = request('GET', url, {
        followAllRedirects: true,
        encoding:           'binary',
        gzip:               true,
        retry:              true
    });

    if (response.statusCode >= 300) {
        console.log('Server responded with status code', response.statusCode, 'while downloading torrent file', url);
        return false;
    }

    return response.getBody('binary').toString();
}

function decodeTorrentContent (torrentContent) {
    var decodedTorrentContent;
    try {
        decodedTorrentContent = bencode.decode(torrentContent);
    }
    catch (err) {
        console.log('Error while decoding torrent content', err);
        return false;
    }
    return decodedTorrentContent;
}

function getTorrentName (decodedTorrentContent) {
    return decodedTorrentContent.info && decodedTorrentContent.info.name;
}

function getTorrentFiles (decodedTorrentContent) {
    if (!decodedTorrentContent.info || !decodedTorrentContent.info.files) {
        return [];
    }

    return decodedTorrentContent.info.files.filter(function (file) {
        return file.path && file.path.length > 0;
    });
}

function getTorrentFilesFilePath (file) {
    return file.path[file.path.length - 1].trim();
}

function checkEpisodeTorrentContent (decodedTorrentContent) {
    var files = getTorrentFiles(decodedTorrentContent);

    // Invalid if there is a .exe file
    // -------------------------------
    if (files.some(
            function (file) {
                return utils.getFileExtension(getTorrentFilesFilePath(file)) === 'exe';
            })
    ) {
        return false;
    }

    // Valid if there is a movie file with length > 0
    // ----------------------------------------------
    return files.some(function (file) {
        var filename = getTorrentFilesFilePath(file);
        return utils.fileExtensionIsMovie(filename) && parseInt(file.length) > 0;
    });
}

function getEpisodeFilename (decodedTorrentContent) {
    var files = getTorrentFiles(decodedTorrentContent);
    return files.reduce(function (prevFile, file) {
        var filename = getTorrentFilesFilePath(file),
            length   = parseInt(file.length);
        if (utils.fileExtensionIsMovie(filename) && length > prevFile.length) {
            return { filename: filename, length: length };
        }

        return prevFile;
    }, { filename: '', length: 0 }).filename;
}

module.exports = {
    extractTorrentFilenameAndUrl: extractTorrentFilenameAndUrl,
    checkEpisodeTorrentContent:   checkEpisodeTorrentContent,
    decodeTorrentContent:         decodeTorrentContent,
    downloadTorrentFileContent:   downloadTorrentFileContent,
    getEpisodeFilename:           getEpisodeFilename,
    getTorrentName:               getTorrentName,
    searchEpisode:                searchEpisode
};
