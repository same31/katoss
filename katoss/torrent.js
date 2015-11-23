var kickass = require('kickass-torrent'),
    request = require('sync-request'),
    bencode = require('bencode-js');

function getLocationOrigin () {
    return window.location.origin || window.location.protocol + '//' + window.location.hostname +
        (window.location.port ? ':' + window.location.port : '');
}

function formatShowTitle (show) {
    return show.trim().replace(/ ?\(\d{4}\)$/g, '').replace(/'|&/g, '').replace(/\./g, ' ').replace(/ +/g, ' ').trim();
}

function searchEpisode (show, season, episode, callback) {
    var url = typeof window !== 'undefined' && getLocationOrigin() + '/kat';
    kickass({ q: formatShowTitle(show) + ' S' + season + 'E' + episode, url: url }, typeof callback === 'function' && callback);
}

function extractTorrentFilenameAndUrl (url) {
    var urlMatches = url.match(/^(.+)\?title=(.+)$/);
    if (!urlMatches) {
        throw Error('URL and filename cannot be extracted from this URL ' + url);
    }

    return {
        url:      urlMatches[1],
        filename: urlMatches[2] + '.torrent'
    };
}

function downloadTorrentFileContent (url) {
    typeof window === 'undefined' || (url = url.replace(/^(https:\/\/torcache\.net(:\d+)?.+)$/, getLocationOrigin() + '/download?url=$1'));
    var response = request('GET', url, {
        followAllRedirects: true,
        encoding:           'binary',
        gzip:               true
    });

    if (response.statusCode >= 300) {
        console.log('Server responded with status code', response.statusCode, 'while downloading torrent file', url);
        return false;
    }

    return response.getBody('binary').toString();
}

function decodeTorrentContent (torrentContent) {
    return bencode.decode(torrentContent);
}

function getTorrentName (decodeTorrentContent) {
    return decodeTorrentContent.info && decodeTorrentContent.info.name;
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
    return file.path[file.path.length - 1];
}

function getFileExtension (filename) {
    return filename.substr((~-filename.lastIndexOf('.') >>> 0) + 2).toLowerCase();
}

function fileExtensionIsMovie (filename) {
    var extension = getFileExtension(filename);
    return extension && ~['avi', 'mkv', 'mp4', 'mpg', 'mpeg'].indexOf(extension);
}

function checkEpisodeTorrentContent (decodedTorrentContent) {
    var files = getTorrentFiles(decodedTorrentContent);

    // Invalid if there is a .exe file
    // -------------------------------
    if (files.some(
            function (file) {
                return getFileExtension(getTorrentFilesFilePath(file)) === 'exe';
            })
    ) {
        return false;
    }

    // Valid if there is a movie file with length > 0
    // ----------------------------------------------
    return files.some(function (file) {
        var filename = getTorrentFilesFilePath(file);
        return fileExtensionIsMovie(filename) && parseInt(file.length) > 0;
    });
}

function getEpisodeFilename (decodedTorrentContent) {
    var files = getTorrentFiles(decodedTorrentContent);
    return files.reduce(function (prevFile, file) {
        var filename = getTorrentFilesFilePath(file),
            length   = parseInt(file.length);
        if (fileExtensionIsMovie(filename) && length > prevFile.length) {
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
    formatShowTitle:              formatShowTitle,
    getEpisodeFilename:           getEpisodeFilename,
    getTorrentName:               getTorrentName,
    searchEpisode:                searchEpisode
};
