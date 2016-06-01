var sickBeardConfig      = require('../katoss/config.json').sickBeard,
    syncRequest = require('sync-request');

function sendSickBeardAPICmd (cmd, params, callback) {
    var apiKey    = sickBeardConfig.apiKey,
        protocol  = sickBeardConfig.protocol || 'http',
        host      = sickBeardConfig.host || '127.0.0.1',
        port      = sickBeardConfig.port || 8080,
        apiCmdUrl = protocol + '://' + host + ':' + port + '/api/' + apiKey + '/?cmd=',
        url       = apiCmdUrl + cmd,
        response,
        responseData;

    if (params) {
        for (var key in params) {
            if (!params.hasOwnProperty(key)) {
                continue;
            }
            url += '&' + key + '=' + params[key];
        }
    }

    response = syncRequest('GET', url, { retry: true });

    if (response.statusCode >= 300) {
        console.log('[' + cmd + '] Sick Beard server responded with status code', response.statusCode);
        console.log(params);
        return false;
    }

    if (typeof callback === 'function') {
        try {
            responseData = JSON.parse(response.getBody().toString()).data;
        }
        catch (err) {
            console.log('[' + cmd + '] Error while parsing Sick Beard response', err);
            console.log(params);
            return false;
        }

        callback(responseData);
    }
}

module.exports = sendSickBeardAPICmd;
