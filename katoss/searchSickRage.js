var request = require('request'),
    katoss = require('./katoss');

function sendAPICmd(cmd, params, callback) {
    var apiKey = 'aa28d413d22138d396b018880496c957',
        port    = '8899',
        apiCmdUrl = 'https://192.168.1.7:' + port + '/api/' + apiKey + '/?cmd=',
        url = apiCmdUrl + cmd;

    if (params) {
        for (var key in params) {
            if (!params.hasOwnProperty(key)) {
                continue;
            }
            url+= '&' + key + '=' + params[key];
        }
    }

    request({
        url: url,
        method: 'GET',
        rejectUnauthorized: false
    }, function (err, response, body) {
        if (err) {
            return console.log(err);
        }
        callback(JSON.parse(body).data);
    });
}

// Get show id list
// ----------------
sendAPICmd('shows', {'sort': 'name', 'pause': 0}, function (showList) {
    for (var showName in showList) {
        if (!showList.hasOwnProperty(showName)) {
            continue;
        }
        var show = showList[showName];
        sendAPICmd('show.seasons', {tvdbid: show.tvdbid}, function (seasons) {
            console.log(seasons);
        });
    }
});
