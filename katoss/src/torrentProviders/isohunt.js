var utils   = require('../../src/utils'),
    isohunt = require('isohunt-api');

function searchEpisode (show, season, episode) {
    return isohunt.search(utils.formatShowTitle(show) + ' S' + season + 'E' + episode, {
        category: 'tv',
        order:    'seeders',
        by:       'DESC',
        page:     1
    }).then(torrentList => torrentList.map(torrentInfo => {
        torrentInfo.seeds = torrentInfo.seeders;
        delete torrentInfo.seeders;
        return torrentInfo;
    }));
}

function extractTorrentFilenameAndUrl (torrentInfo) {
    return isohunt.getTorrentUrl(torrentInfo.infoUrl).then(torrentUrl => ({
        url:      torrentUrl,
        filename: torrentInfo.title + '.torrent'
    }));
}

module.exports = {
    searchEpisode:                searchEpisode,
    extractTorrentFilenameAndUrl: extractTorrentFilenameAndUrl
};
