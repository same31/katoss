var fs          = require('fs'),
    url         = require('url'),
    // The default file if the file/path is not found
    defaultFile = 'index.html', folder = './dist/';
    

module.exports = {
    bsFiles: {
        src: ['./dist/js/app.js'/*, './dist/css/app/blessed/*.css'*/]
    },
    options: {
        notify:    true,
        watchTask: true,
        port:      '<%= port %>',
        ui:        {
            port: '<%= bsPort %>'
        },
        ghostMode: false,
        server:    {
            baseDir:    './dist/',
            // Middleware to redirect all reqs on the Node server to index.html
            middleware: function (req, res, next) {
                var fileName = url.parse(req.url),
                    fileExists;
                fileName = fileName.href.split(fileName.search).join('');
                fileExists = fs.existsSync(folder + fileName);

                if (!fileExists && fileName.indexOf('fonts') === -1 && fileName.indexOf('browser-sync-client') === -1) {
                    req.url = '/' + defaultFile;
                }
                return next();
            }
        }
    }
};
