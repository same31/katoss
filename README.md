katoss
======

KATOSS is an acronym for for KickAss Torrents + Open Subtitles Search.

Katoss allows you to download TV Show episodes from [KickAss Torrents](https://kat.cr) platform
along with matched subtitles from [OpenSubtitles](http://http://www.opensubtitles.org) database.


Requirements
------------

Katoss needs [Node.js](https://nodejs.org) to run.
To be able to download subtitles from [OpenSubtitles](http://www.opensubtitles.org) database,
you need to register as a user on [www.opensubtitles.org](http://www.opensubtitles.org) and request
a personal user agent string following these directions:
[How to request a new user agent](http://trac.opensubtitles.org/projects/opensubtitles/wiki/DevReadFirst)


Installation
------------

1. Clone this repository: `git clone https://github.com/same31/katoss.git`
2. Type `npm install` to install the dependencies.
3. Rename (or copy) the _katoss/sampleConfig.json_ configuration file to _katoss/config.json_
4. Fill in your Open Subtitles user agent string into this configuration file


Configuration
-------------

See the sampleConfig.json for a sample configuration file.

+ **openSubtitlesUserAgent**: Your personal Open Subtitles user agent string, **it is mandatory that you use your own user agent**
+ **outputPath**: _(optional)_ The path where to downloads torrent and subtitles files, default is '.'.
+ **qualityOrder**: The list of allowed qualities to download, ordered by preferred ones.
Valid values are _2160p_, _1080p_, _720p_, _480p_ and _unknown_.
+ **distributionOrder**: The list of allowed distribution releases to download, ordred by preferred ones.
Valid values are _BluRay_, _WEB-DL_, _HDTV_ and _unknown_.
+ **ignoredWords**: _(optional)_ Torrent releases containing one word in this list will be ignored.
+ **languages**: Subtitles language(s) to search (3 characters code), ordered by preference. Example: ["fre", "eng"].
+ **showLanguages**: _(optional)_ Subtitles language(s) to search by show, will override the _languages_ key.
