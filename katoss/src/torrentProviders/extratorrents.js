var utils         = require('./../../src/utils'),
    extratorrents = require('extratorrentapi');

function searchEpisode (show, season, episode) {
    return extratorrents.search(utils.formatShowTitle(show) + ' S' + season + 'E' + episode)
        .then(function (torrentList) {
            return torrentList.sort(function (a, b) {
                return parseInt(b.seeds) - parseInt(a.seeds);
            });
        });
}

function extractTorrentFilenameAndUrl (torrentInfo) {
    return {
        url:      torrentInfo.torrent,
        filename: torrentInfo.title + '.torrent'
    };
}

module.exports = {
    searchEpisode:                searchEpisode,
    extractTorrentFilenameAndUrl: extractTorrentFilenameAndUrl
};
