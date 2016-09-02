var utils = require('./../../src/utils'),
    rarbg = require('rarbgto-api');

function searchEpisode (show, season, episode) {
    return rarbg.search(utils.formatShowTitle(show) + ' S' + season + 'E' + episode, {
        category: 'tv',
        order:    'seeders',
        by:       'DESC',
        page:     1
    });
}

function extractTorrentFilenameAndUrl (torrentInfo) {
    return torrentInfo;
}

module.exports = {
    searchEpisode: searchEpisode,
    extractTorrentFilenameAndUrl: extractTorrentFilenameAndUrl
};
