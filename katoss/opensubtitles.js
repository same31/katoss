var config  = require('./config.json'),
    utils   = require('./utils'),
    fs      = require('fs'),
    Promise = require('promise'),
    zlib    = require('zlib'),
    xmlrpc  = require('xmlrpc'),
    client  = xmlrpc.createClient({
        host: 'api.opensubtitles.org',
        port: 80,
        path: '/xml-rpc'
    }),
    _loginPromise,
    _token;

function login () {
    if (!_loginPromise) {
        _loginPromise = new Promise(function (resolve, reject) {
            client.methodCall('LogIn', ['', '', 'fr', config.openSubtitlesUserAgent], function (err, response) {
                if (err) {
                    console.log('[LogIn] OpenSubtitles connection problem', err);
                    return reject(err);
                }
                _token = response.token;

                resolve();
            });
        });
    }

    return _loginPromise;
}

function search (show, season, episode, languages) {
    return login().then(function () {
        return new Promise(function (resolve, reject) {
            client.methodCall('SearchSubtitles', [_token, [{
                'sublanguageid': languages.join(),
                'query':         show,
                'season':        parseInt(season),
                'episode':       parseInt(episode)
            }]], function (err, response) {
                if (err || !response.data) {
                    return reject('[SearchSubtitles] OpenSubtitles connection problem', err, response);
                }

                var formattedShowTitle = utils.formatShowTitle(show),
                    subs               = response.data.filter(function (subInfo) {
                        return utils.releaseNameIsValid(subInfo.SubFileName, show, season, episode);
                    }).map(function (subInfo) {
                        subInfo.distribution = utils.getDistribution(subInfo.SubFileName);
                        subInfo.distribution === 'UNKNOWN' && (subInfo.distribution = utils.getDistribution(subInfo.MovieReleaseName));
                        subInfo.langId = subInfo.SubLanguageID;
                        return subInfo;
                    });

                if (formattedShowTitle === show) {
                    resolve(subs);
                }
                else {
                    return search(formattedShowTitle, season, episode, languages).then(function (subtitlesList) {
                        resolve(subs.concat(subtitlesList));
                    });
                }
            });
        });
    });
}

function download (subInfo, filename) {
    return login().then(function () {
        return new Promise(function (resolve, reject) {
            client.methodCall('DownloadSubtitles', [_token, [subInfo.IDSubtitleFile]], function (err, response) {
                if (err || !response || !response.data || !response.data[0] || !response.data[0].data) {
                    console.log('[DownloadSubtitles] OpenSubtitles connection problem', err, response);
                    return reject(err);
                }

                zlib.unzip(new Buffer(response.data[0].data, 'base64'), function (err, buffer) {
                    if (err) {
                        console.log('Error with subtitles unzip', err);
                        return reject(err);
                    }
                    fs.writeFile(filename.trim(), buffer, resolve);
                });
            });
        });
    });
}

module.exports = {
    search:   search,
    download: download
};
