var config         = require('./config.json'),
    Promise        = require('promise'),
    knownProviders = ['addic7ed', 'opensubtitles'],
    providers      = {
        addic7ed:      require('addic7ed-api'),
        opensubtitles: require('./opensubtitles')
    },
    confProviders  = (config.subtitlesProviders || ['opensubtitles']).filter(function (provider) {
        return ~knownProviders.indexOf(provider);
    });

function search (show, season, episode, languages) {
    return Promise.all(
        confProviders.map(function (provider) {
            return providers[provider].search(show, season, episode, languages);
        })
    ).then(function (response) {
        var subList = response.reduce(function (prevResult, result, index) {
            var provider = confProviders[index];
            return prevResult.concat(result.map(function (subInfo) {
                subInfo.provider = provider;
                return subInfo;
            }));
        }, []);

        return subList;
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
