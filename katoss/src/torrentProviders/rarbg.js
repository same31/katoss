var utils      = require('./../../src/utils'),
    Torrentapi = require('rarbgto-api'),
    rarbg      = new Torrentapi('katoss');

function searchEpisode (show, season, episode) {
    return rarbg.search({
        search_string: utils.formatShowTitle(show) + ' S' + season + 'E' + episode,
        category:      'tv',
        limit:         100,
        sort:          'seeders',
        min_seeders:   1,
        format:        'json_extended',
        ranked:        0
    }).then(torrentList => torrentList.map(torrentInfo => {
        torrentInfo.title = torrentInfo.title.trim();
        torrentInfo.seeds = torrentInfo.seeders;
        delete torrentInfo.seeders;
        return torrentInfo;
    }));
}

function extractTorrentFilenameAndUrl (torrentInfo) {
    var filename   = torrentInfo.title + '.torrent',
        magnetHash = torrentInfo.download.match(/[0-9a-f]{40}/i),
        url;

    if (magnetHash && magnetHash.length) {
        url = 'http://itorrents.org/torrent/' + magnetHash[0].toUpperCase() + '.torrent?title=' + encodeURIComponent(torrentInfo.title);
    }

    return {
        filename: filename,
        url:      url || ''
    };
}

module.exports = {
    searchEpisode:                searchEpisode,
    extractTorrentFilenameAndUrl: extractTorrentFilenameAndUrl
};
