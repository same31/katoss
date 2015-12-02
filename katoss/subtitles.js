var config         = require('./config.json'),
    utils          = require('./utils'),
    knownProviders = ['addic7ed', 'opensubtitles'],
    providers      = {
        addic7ed:      require('addic7ed-api'),
        opensubtitles: require('./subtitlesProviders/opensubtitles')
    },
    confProviders  = (config.subtitlesProviders || ['opensubtitles']).filter(function (provider) {
        return ~knownProviders.indexOf(provider);
    });

function search (show, season, episode, languages) {
    return utils.allSettled(
        confProviders.map(function (provider) {
            return providers[provider].search(show, season, episode, languages);
        })
    ).then(function (response) {
        return response.reduce(function (prevResult, result, index) {
            var provider = confProviders[index];
            return prevResult.concat((result.response || []).map(function (subInfo) {
                subInfo.provider = provider;
                return subInfo;
            }));
        }, []).sort(function (a, b) {
            return confProviders.indexOf(a.provider) - confProviders.indexOf(b.provider);
        });
    });
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
    search: search,
    download: download
};
