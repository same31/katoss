var config         = require('../config.json'),
    utils          = require('./utils'),
    requestPromise = require('request-promise-native'),
    queryString    = require('query-string'),
    bencode        = require('bencode-js'),
    providers      = {
        extratorrent: require('./torrentProviders/extratorrent'),
        kickass:      require('./torrentProviders/kickass'),
        rarbg:        require('./torrentProviders/rarbg')
    },
    confProviders  = (config.torrentProviders || ['extratorrent']).filter(provider => typeof providers[provider] !== 'undefined');

function searchEpisode (show, season, episode) {
    return utils.allSettled(confProviders.map(provider => providers[provider].searchEpisode(show, season, episode)))
        .then(response => response.reduce((prevResult, result, index) => {
            var provider = confProviders[index];
            return prevResult.concat(
                (result.response || [])
                    .filter(torrentInfo => torrentInfo.seeds > 0)
                    .map(torrentInfo => {
                        torrentInfo.provider = provider;
                        return torrentInfo;
                    }));
        }, []).sort((a, b) => confProviders.indexOf(a.provider) - confProviders.indexOf(b.provider)));
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
    url         = url.trim();
    var qs      = queryString.extract(url),
        options = {
            headers:                 {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:42.0) Gecko/20100101 Firefox/42.0'
            },
            resolveWithFullResponse: true,
            followAllRedirects:      true,
            encoding:                'binary',
            gzip:                    true,
            retry:                   true
        };

    if (qs) {
        url        = url.replace('?' + qs, '');
        options.qs = queryString.parse(qs);
    }

    options.url = url;

    return requestPromise(options).then(response => {
        if (response.statusCode >= 300) {
            console.log('Server responded with status code', response.statusCode, 'while downloading torrent file', url);
            return false;
        }
        else if (response.headers && response.headers['content-type'] !== 'application/x-bittorrent') {
            console.log(`Torrent content-type does not match application/x-bittorent while downloading torrent url ${url}`);
            console.log('Content-type:', response.headers['content-type']);
            return false;
        }

        return response.body;
    });
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
    return decodedTorrentContent.info.files.filter(file => file.path && file.path.length > 0);
}

function getTorrentFilesFilePath (file) {
    return file.path[file.path.length - 1].trim();
}

function checkEpisodeTorrentContent (decodedTorrentContent) {
    var files = getTorrentFiles(decodedTorrentContent);

    // Invalid if there is a .exe file
    // -------------------------------
    if (files.some(file => utils.getFileExtension(getTorrentFilesFilePath(file)) === 'exe')) {
        return false;
    }

    // Valid if there is a movie file with length > 0
    // ----------------------------------------------
    return files.some(file => utils.fileExtensionIsMovie(getTorrentFilesFilePath(file)) && parseInt(file.length) > 0);
}

function getEpisodeFilename (decodedTorrentContent) {
    var files = getTorrentFiles(decodedTorrentContent);
    return files.reduce((prevFile, file) => {
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
