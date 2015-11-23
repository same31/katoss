var xmlrpc = require('xmlrpc'),
    client = xmlrpc.createClient({
        host: 'api.opensubtitles.org',
        port: 80,
        path: '/xml-rpc'
    }),
    config = require('./config.json'),
    zlib   = require('zlib'),
    fs     = require('fs'),
    _token;

function login (callback) {
    client.methodCall('LogIn', ['', '', 'fr', config.openSubtitlesUserAgent], function (err, response) {
        if (err) {
            return console.log('OpenSubtitles connection problem', err);
        }
        _token = response.token;

        typeof callback === 'function' && callback(_token);
    });
}

function search (show, season, episode, languages, callback) {
    client.methodCall('SearchSubtitles', [_token, [{
        'sublanguageid': languages.join(),
        'query':         show,
        'season':        season,
        'episode':       episode
    }]], function (err, response) {
        if (err || !response.data) {
            return console.log('OpenSubtitles connection problem', err, response);
        }

        typeof callback === 'function' && callback(response.data);
    });
}

function download (subtitleFileId, filename, callback) {
    client.methodCall('DownloadSubtitles', [_token, [subtitleFileId]], function (err, response) {
        if (err || !response || !response.data || !response.data[0] || !response.data[0].data) {
            return console.log('Error while downloading subtitles', err);
        }

        zlib.unzip(new Buffer(response.data[0].data, 'base64'), function (err, buffer) {
            if (err) {
                return console.log('Error with subtitles unzip');
            }
            fs.writeFile(filename, buffer, typeof callback === 'function' && callback);
        });
    });
}

/*function releaseNameIsValid (releaseName, season, episode) {
    // If there is a season - episode pattern, check if it is the same as provided
    // ---------------------------------------------------------------------------
    var match = releaseName.match(/S(\d{1,2})E(\d{1,2})/i) || releaseName.match(/(\d{1,2})x(\d{2})/i);
    if (match) {
        return parseInt(match[1]) === parseInt(season) && parseInt(match[2]) === parseInt(episode);
    }
    return true;
}*/

module.exports = {
    login:              login,
    search:             search,
    download:           download
};
