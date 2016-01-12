var config         = require('./../config.json'),
    utils          = require('./utils'),
    syncRequest    = require('sync-request'),
    bencode        = require('bencode-js'),
    knownProviders = ['extratorrents', 'kickass'],
    providers      = {
        extratorrents: require('./torrentProviders/extratorrents'),
        kickass:       require('./torrentProviders/kickass')
    },
    confProviders  = (config.torrentProviders || ['kickass']).filter(function (provider) {
        return ~knownProviders.indexOf(provider);
    });

function searchEpisode (show, season, episode) {
    return utils.allSettled(
        confProviders.map(function (provider) {
            return providers[provider].searchEpisode(show, season, episode);
        })
    ).then(function (response) {
        return response.reduce(function (prevResult, result, index) {
            var provider = confProviders[index];
            return prevResult.concat((result.response || []).map(function (torrentInfo) {
                torrentInfo.provider = provider;
                return torrentInfo;
            }));
        }, []).sort(function (a, b) {
            return confProviders.indexOf(a.provider) - confProviders.indexOf(b.provider);
        });
    });
}

function extractTorrentFilenameAndUrl (torrentInfo) {
    var provider = providers[torrentInfo.provider];
    if (!provider) {
        return console.log('Unknown provider', torrentInfo.provider);
    }
    else if (typeof provider.extractTorrentFilenameAndUrl !== 'function') {
        return console.log('Provider', torrentInfo.provider, 'does not implement extractTorrentFilenameAndUrl function');
    }
    return provider.extractTorrentFilenameAndUrl(torrentInfo);
}

function downloadTorrentFileContent (url) {
    url          = url.trim();
    var response = syncRequest('GET', url, {
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
