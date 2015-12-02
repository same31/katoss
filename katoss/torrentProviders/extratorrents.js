var utils         = require('./../utils'),
    extratorrents = require('extratorrentapi');

function searchEpisode (show, season, episode) {
    return extratorrents.search(utils.formatShowTitle(show) + ' S' + season + 'E' + episode);
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
