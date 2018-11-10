const path = require('path');
const config = require('../config');

class PlexDirectories {
    static getCodecFolder() {
        return path.resolve(`${config.transcoder.codecs_folder}/${config.transcoder.codecs_build}-linux-ubuntu-x86_64`) + '/';
    }

    static getPlexBuildFolder() {
        return path.resolve(`${config.transcoder.plex_resources}/${config.transcoder.plex_build}`) + '/';
    }

    static getPlexFolder() {
        return path.resolve(this.getPlexBuildFolder(), 'usr/lib/plexmediaserver') + '/';
    }
}

module.exports = PlexDirectories;