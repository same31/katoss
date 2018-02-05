var movieDest             = process.argv[2],
    movieSrc              = process.argv[3],
    config                = require('../katoss/config.json'),
    utils                 = require('../katoss/src/utils'),
    cleanKodiVideoLibrary = require('./cleanKodiVideoLibrary').bind(this, true),
    find                  = require('find'),
    fs                    = require('fs'),
    path                  = require('path'),
    outputPath            = config.outputPath || '.',
    subSrcBase            = movieSrc.substring(movieSrc.lastIndexOf('/') + 1, movieSrc.lastIndexOf('.'));

console.log('Katoss SickRage post processing. \nMovie src: \'%s\'\nSub src base: \'%s\'', movieSrc, subSrcBase);

find.file(new RegExp('[\\\/]' + utils.escapeRegExpPattern(subSrcBase) + '.*\.srt$'), path.resolve(outputPath), files => {
    if (!files || files.length <= 0) {
        return console.log('No subtitle found. \nMovie src: \'%s\'\nSub src base: \'%s\'', movieSrc, subSrcBase);
    }
    var subSrc  = files[0],
        subExt  = subSrc.match(/(\.[a-zA-Z]{2,3})?\.srt$/)[0],
        subDest = movieDest.substr(0, movieDest.lastIndexOf('.')) + subExt;

    console.log('Move subtitles file from', subSrc, 'to', subDest);
    // Triggers EXDEV error : fs.rename(subSrc, subDest, config.kodi && cleanKodiVideoLibrary);

    // Read the file
	fs.readFile(subSrc, function (err, data) {
		if (err) {
			throw err;
		}
		console.log('sub src file read!');

		// Write the file
		fs.writeFile(subDest, data, function (err) {
			if (err) {
				throw err;
			}
			console.log('sub dest file written!');

			if (config.kodi) {
				cleanKodiVideoLibrary();
			}

			// Delete the file
			fs.unlink(subSrc, function (err) {
				if (err) {
					throw err;
				}
				console.log('sub src file deleted!');
			});
		});

	});	
});
