var utils   = require('./../utils'),
    kickass = require('kickass-torrent'),
    Promise = require('promise');

function searchEpisode (show, season, episode) {
    return new Promise(function (resolve, reject) {
        kickass(
            {
                q:     utils.formatShowTitle(show) + ' S' + season + 'E' + episode,
                field: 'seeders',
                order: 'desc'
            },
            function (err, data) {
                if (err) {
                    console.log('Kickass Torrents connection problem', err);
                    return reject(err);
                }
                return resolve(data.list);
            }
        );
    });
}

function extractTorrentFilenameAndUrl (torrentInfo) {
    var urlMatches = torrentInfo.torrentLink.trim().match(/^(.+)\?title=(.+)$/);
    if (!urlMatches) {
        throw Error('URL and filename cannot be extracted from this URL ' + torrentInfo.torrentLink);
    }

    return {
        url:      urlMatches[1],
        filename: urlMatches[2] + '.torrent'
    };
}

module.exports = {
    searchEpisode:                searchEpisode,
    extractTorrentFilenameAndUrl: extractTorrentFilenameAndUrl
};
