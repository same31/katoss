var utils        = require('./../../src/utils'),
    extratorrent = require('extratorrentapi');

function searchEpisode (show, season, episode) {
    return extratorrent
        .search(utils.formatShowTitle(show) + ' S' + season + 'E' + episode)
        .then(torrentList => torrentList.sort((a, b) => parseInt(b.seeds) - parseInt(a.seeds)));
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
