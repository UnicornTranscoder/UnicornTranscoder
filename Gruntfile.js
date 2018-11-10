const ar = require('ar');
const fs = require('fs');
const path = require('path');
const util = require('util');
const config = require('./config');
const PlexDirectories = require('./utils/plex-directories');

module.exports = (grunt) => {
    let codecsFolder = PlexDirectories.getCodecFolder();
    let plexFolder = PlexDirectories.getPlexBuildFolder();

    let gruntConfig = {
        'mkdir': {
            codecs: {
                options: {
                    create: [codecsFolder]
                },
            },
            plex: {
                options: {
                    create: [plexFolder]
                }
            }
        },
        'request-progress': {
            plex: {
                options: {
                    allowOverwrite: true,
                    dst: plexFolder + 'plex.deb',
                    src: `https://downloads.plex.tv/plex-media-server/${config.transcoder.plex_build}/plexmediaserver_${config.transcoder.plex_build}_amd64.deb`
                }
            }
        },
        'arx': {
            plex: {
                src: plexFolder + "plex.deb",
                dst: plexFolder
            }
        },
        'untar': {
            plex: {
                options: {
                    mode: 'tgz'
                },
                files: {
                    [plexFolder]: plexFolder + 'data.tar.gz',
                }
            }
        }
    };

    //Generate codecs downloads
    // for f in *; do sed "s/\(.*\).so/'\1',/" <<< "$f"; done
    const codecs = [
        'libaac_decoder',
        'libaac_encoder',
        'libac3_decoder',
        'libac3_encoder',
        'libcook_decoder',
        'libdca_decoder',
        'libflv_decoder',
        'libh264_decoder',
        'libhevc_decoder',
        'liblibmp3lame_encoder',
        'liblibx264_encoder',
        'libmp2_decoder',
        'libmp3_decoder',
        'libmpeg2video_decoder',
        'libmpeg4_decoder',
        'libmsmpeg4v3_decoder',
        'librv30_decoder',
        'librv40_decoder',
        'libvc1_decoder',
        'libvp8_decoder',
        'libvp9_decoder',
        'libwmav2_decoder',
        'libwmv2_decoder',
    ];
    const codecTaskSample = {
            dst: codecsFolder,
            src: 'https://downloads.plex.tv/codecs/%s/linux-ubuntu-x86_64/%s.so',
            allowOverwrite: true
    };
    codecs.forEach((codec) => {
        let codecTask = { options: {...codecTaskSample}, };
        codecTask.options.src = util.format(codecTask.options.src, config.transcoder.codecs_build, codec);
        codecTask.options.dst = codecTask.options.dst + codec + ".so";
        gruntConfig["request-progress"][codec] = codecTask;
    });
    let codecsTask = codecs.map(c => 'request-progress:' + c);
    codecsTask.unshift('mkdir:codecs');

    //The deb extraction task
    grunt.registerMultiTask('arx', 'Extract a GNU ar archive', function() {
        let archive = new ar.Archive(fs.readFileSync(this.data.src));
        let files = archive.getFiles();
        files.forEach((file) => {
            grunt.file.write(path.resolve(this.data.dst, file.name()), file.fileData());
        });
    });

    grunt.initConfig(gruntConfig);
    grunt.loadNpmTasks('grunt-request-progress');
    grunt.loadNpmTasks('grunt-mkdir');
    grunt.loadNpmTasks('grunt-untar');

    grunt.registerTask('plex', ['mkdir:plex', 'request-progress:plex', 'arx:plex', 'untar:plex']);
    grunt.registerTask('codecs', codecsTask);
    grunt.registerTask('default', ['plex', 'codecs']);

};