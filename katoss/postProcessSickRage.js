
/*
2: /volume1/Movies/Séries/South Park/Season 19/South.Park.S19E07.1080p.WEB-DL-YFN.mkv
3: /volume1/Downloads/South.Park.S19E07.episode.name.1080p.WEB-DL-YFN.mkv
dirname
filename
basename
*/
var movieDest = process.argv[2],
    movieSrc = process.argv[3],
    fs = require('fs'),
    pathinfo = require('pathinfo'),
    find = require('find'),
    config = require('./config.json'),
    outputPath = config.outputPath || '.',
    subSrcBase = movieSrc.substr(movieSrc.lastIndexOf('/'), movieSrc.lastIndexOf('.'));

console.log(subSrcBase);

find.file(new RegExp('^' + subSrcBase + '\.[a-zA-Z]{2,3}\.srt$'), outputPath, function(files) {
    console.log(files);
});
