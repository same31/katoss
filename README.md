katoss
======

KATOSS is an acronym for KickAss Torrents + Open Subtitles Search.

Katoss allows you to download TV Show episodes from [KickAss Torrents](https://kat.cr) platform
along with matched subtitles from [OpenSubtitles](http://http://www.opensubtitles.org) database.


Requirements
------------

Katoss needs [Node.js](https://nodejs.org) to run.

To be able to download subtitles from [OpenSubtitles](http://www.opensubtitles.org) database,
you need to register as a user on [www.opensubtitles.org](http://www.opensubtitles.org) and request
a personal user agent string following these directions:
[How to request a new user agent](http://trac.opensubtitles.org/projects/opensubtitles/wiki/DevReadFirst).


Installation
------------

1. Clone this repository: `git clone https://github.com/same31/katoss.git`
2. Type `npm install` to install the dependencies.
3. Rename (or copy) the _katoss/sampleConfig.json_ configuration file to _katoss/config.json_
4. Fill in your Open Subtitles user agent string into this configuration file


Configuration
-------------

See the _katoss/sampleConfig.json_ for a sample configuration file.

+ **openSubtitlesUserAgent**: Your personal Open Subtitles user agent string,
see [How to request a new user agent](http://trac.opensubtitles.org/projects/opensubtitles/wiki/DevReadFirst).
+ **outputPath**: _(optional)_ The path where to downloads torrent and subtitles files, default is directory from where the script is launched.
+ **qualityOrder**: The list of allowed qualities to download, ordered by preference.
Valid values are _2160p_, _1080p_, _720p_, _480p_ and _unknown_.
+ **distributionOrder**: The list of allowed distribution releases to download, ordered by preference.
Valid values are _BluRay_, _WEB-DL_, _HDTV_ and _unknown_.
+ **ignoredWords**: _(optional)_ Torrent releases containing a word in this list will be ignored.
+ **languages**: Subtitles language(s) to search (3 characters code), ordered by preference. Example: `["fre", "eng"]`.
+ **showLanguages**: _(optional)_ Subtitles language(s) to search by show, will override the _languages_ key.
+ **sickBeard**: _(optional)_ Configuration used when connection to a Sick Beard API.
    - **apiKey**: Your Sick Beard API key.
    - **protocol**: _(optional)_ The protocol used to connect to the Sick Beard server, default is _http_.
    - **host**: _(optional)_ The host used to connect to the Sick Beard server, default is _127.0.0.1_.
    - **port**: _(optional)_ The port used to connect to the Sick Beard server, default is _80_.


Usage
-----

Search can be performed by providing a JSON search file or using a Sick Beard API.


### Search with a JSON file

1. Rename (or copy) the file _utils/sampleSearch.json_ to _utils/search.json_.
2. Edit the _Sample TV Show title_ by the desired TV show title.
3. Under the _seasons_ key, write a season number followed by the list of episodes to search and download.
4. Repeat for each desired season and TV show.
5. Run `node utils/searchJSONFile.js` to search and download torrent and subtitles files.

### Search using a Sick Beard API

1. Fill in the _sickBeard_ part into the configuration file.
2. In the Sick Beard admin page, go to _Post-processing_ and enter
`/<path to node bin>/node /<path to katoss>/utils/postProcessSickBeard.js` into the _Extra scripts_ field.
3. Run `node utils/searchSickBeard.js` to search and download the episodes marked as _Wanted_.

#### Search in order to replace low quality episodes

Run `node utils/searchSickBeard.js --replace-low-quality` to search and download the episodes marked as _Downloaded_ and
which quality does not match the first of the _qualityOrder_ in the configuration file.


About
-----

Torrent service powered by [Kickass Torrents](https://kat.cr).

[![Kickass Torrents logo](https://kastatic.com/images/logos/kickasstorrents.png "Kickass Torrents")](https://kat.cr)


Subtitles service powered by [Open Subtitles](http://www.opensubtitles.org).

[![Open Subtitles logo](http://static.opensubtitles.org/gfx/logo-transparent.png "Open Subtitles")](http://www.opensubtitles.org)

License
-------

MIT. Feel free to modify and distribute.
