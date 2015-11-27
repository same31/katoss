var movieDest  = process.argv[2],
    movieSrc   = process.argv[3],
    config     = require('../katoss/config.json'),
    find       = require('find'),
    fs         = require('fs'),
    path       = require('path'),
    outputPath = config.outputPath || '.',
    subSrcBase = movieSrc.substring(movieSrc.lastIndexOf('/') + 1, movieSrc.lastIndexOf('.'));

find.file(new RegExp('^' + subSrcBase + '.*\.srt$'), path.resolve(outputPath), function (files) {
    if (!files || files.length <= 0) {
        return console.log('No subtitle found.');
    }
    var subSrc  = files[0],
        subExt  = subSrc.match(/(\.[a-zA-Z]{2,3})?\.srt$/)[0],
        subDest = movieDest.substr(0, movieDest.lastIndexOf('.')) + subExt;

    console.log('Move subtitles file from', subSrc, 'to', subDest);
    fs.rename(subSrc, subDest);
});
