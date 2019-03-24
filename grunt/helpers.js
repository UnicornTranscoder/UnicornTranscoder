const compareVersions = require('compare-versions');
const config = require('../config');
const codecs = require('./codecs-list');
const PlexDirectories = require('../utils/plex-directories');

class GruntHelpers {
    static mapArch(arch) {
        switch (arch) {
            case 'i386':
                return 'x86';
            case 'amd64':
                return 'x86_64';
            case 'armhf':
                return 'armv7hf_neon';
            case 'arm64':
                return 'aarch64';
       }
    }

    static getPlexDataExt() {
        return (compareVersions(config.transcoder.plex_build, '1.15') === 1 ? '.xz' : '.gz')
    }

    static getPlexArch() {
        const { plex_build, plex_arch } = config.transcoder;
        if (compareVersions(plex_build, '1.15') === 1)
            return `linux-${GruntHelpers.mapArch(plex_arch)}-standard`;
        else
            return `linux-ubuntu-${GruntHelpers.mapArch(plex_arch)}`;
    }

    static getPlexDownloadUrl() {
        const { plex_build, plex_arch } = config.transcoder;
        if (compareVersions(plex_build, '1.15') === 1)
            return `https://downloads.plex.tv/plex-media-server-new/${plex_build}/debian/plexmediaserver_${plex_build}_${plex_arch}.deb`;
        else
            return `https://downloads.plex.tv/plex-media-server/${plex_build}/plexmediaserver_${plex_build}_${plex_arch}.deb`;
    }

    static getEaeDownloadUrl() {
        const { eae_version } = config.transcoder;
        return `https://downloads.plex.tv/codecs/${eae_version}/${GruntHelpers.getPlexArch()}/EasyAudioEncoder-${GruntHelpers.getPlexArch()}.zip`;
    }

    static getCodecDownloadUrl(codecName) {
        const { codecs_build } = config.transcoder;
        return `https://downloads.plex.tv/codecs/${codecs_build}/${GruntHelpers.getPlexArch()}/${codecName}.so`;
    }

    static getCodecsTasks(allowOverwrite) {
        const codecTasks = codecs.reduce((acc, codec) => ({
            ...acc,
            [codec]:{
                options: {
                    src: this.getCodecDownloadUrl(codec),
                    dst: PlexDirectories.getCodecFolder() + codec + '.so',
                    allowOverwrite
                }
            }
        }),  {});
        const codecRunners = codecs.map(c => `request-progress:${c}`);
        return [codecTasks, ['mkdir:codecs', ...codecRunners]]
    }
}

module.exports = GruntHelpers;