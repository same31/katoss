var utils       = require('./../../src/utils'),
    rarbg       = require('rarbgto-api');

function searchEpisode (show, season, episode) {
    return rarbg.search(utils.formatShowTitle(show) + ' S' + season + 'E' + episode);
}

function extractTorrentFilenameAndUrl (torrentInfo) {
    return {
        filename: torrentInfo.filename,
        url:      torrentInfo.url
    };
}

module.exports = {
    searchEpisode:                searchEpisode,
    extractTorrentFilenameAndUrl: extractTorrentFilenameAndUrl
};
