var config         = require('../config.json'),
    utils          = require('./utils'),
    knownProviders = ['addic7ed', 'opensubtitles'],
    providers      = {
        addic7ed:      require('addic7ed-api'),
        opensubtitles: require('./subtitlesProviders/opensubtitles')
    },
    confProviders  = (config.subtitlesProviders || ['opensubtitles']).filter(provider => ~knownProviders.indexOf(provider));

function search (show, season, episode, languages) {
    return utils.allSettled(confProviders.map(provider => {
        // FIXME
        show === 'Marvel\'s Daredevil' && provider === 'addic7ed' && (show = 'Daredevil');
        return providers[provider].search(show, season, episode, languages);
    })).then(response => response.reduce(
        (prevResult, result, index) => {
            var provider = confProviders[index];
            return prevResult.concat((result.response || []).map(subInfo => {
                subInfo.provider = provider;
                subInfo.team     = utils.formatRipTeam(subInfo.team);
                return subInfo;
            }));
        }, []).sort((a, b) => confProviders.indexOf(a.provider) - confProviders.indexOf(b.provider)));
}

function download (subInfo, filename) {
    var provider = providers[subInfo.provider];
    if (!provider) {
        return console.log('Unknown provider', subInfo.provider);
    }
    else if (typeof provider.download !== 'function') {
        return console.log('Provider', subInfo.provider, 'does not implement download function');
    }
    return provider.download(subInfo, filename);
}

module.exports = {
    search:   search,
    download: download
};
