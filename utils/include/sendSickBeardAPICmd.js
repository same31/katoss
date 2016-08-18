var sickBeardConfig = require('../../katoss/config.json').sickBeard,
    requestPromise  = require('request-promise-native');

module.exports = function sendSickBeardAPICmd (cmd, params) {
    var apiKey    = sickBeardConfig.apiKey,
        protocol  = sickBeardConfig.protocol || 'http',
        host      = sickBeardConfig.host || '127.0.0.1',
        port      = sickBeardConfig.port || 8080,
        apiCmdUrl = protocol + '://' + host + ':' + port + '/api/' + apiKey + '/?cmd=',
        url       = apiCmdUrl + cmd,
        options   = {
            url:                     url,
            resolveWithFullResponse: true,
            json:                    true,
            retry:                   true
        };

    if (params) {
        for (var key in params) {
            if (!params.hasOwnProperty(key)) {
                continue;
            }
            options.url += '&' + key + '=' + params[key];
        }
    }

    return requestPromise(options).then(response => {
        if (response.statusCode >= 300) {
            console.log('[' + cmd + '] Sick Beard server responded with status code', response.statusCode);
            console.log(params);
            return false;
        }

        var responseData = response.body && response.body.data;
        if (responseData) {
            return responseData;
        }
        else {
            console.log('[' + cmd + '] Error with Sick Beard response');
            console.log(params);
            return false;
        }
    });
};
