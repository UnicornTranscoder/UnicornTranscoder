/**
 * Created by drouar_b on 27/04/2017.
 */

const env = require('getenv');

module.exports = {
    port:                  env.int   ('SERVER_PORT',           3000),
    host:                  env.string('SERVER_LISTEN',         '127.0.0.1'),
    transcoder_decay_time: env.int   ('TRANSCODER_DECAY_TIME', 120),
    loadbalancer_address:  env.string('LOADBALANCER_ADDRESS',  'https://unicornloadbalancer.myplex.com'),
    ping_frequency:        env.int   ('PING_FREQUENCY',        10),
    instance_address:      env.string('INSTANCE_ADDRESS',      'https://unicorntranscoder.myplex.com'),

    maxmind_key:           env.string('MAXMIND_KEY',           ''),

    transcoder: {
        plex_arch:         env.string('PLEX_ARCH',             'amd64'), // Can be: amd64, arm64, armhf, i386
        plex_build:        env.string('PLEX_BUILD',            '1.18.8.2527-740d4c206'),
        codecs_build:      env.string('CODECS_BUILD',          '0bc617e-2974'),
        eae_version:       env.string('EAE_VERSION',           'eae-69c1de6-42'), // 41 or 42?
        plex_resources:    env.string('PLEX_RESOURCES',        'plexmediaserver/'),
        temp_folder:       env.string('TEMP_FOLDER',           'cache/'),
        codecs_folder:     env.string('CODECS_FOLDER',         'codecs/'),
        plex_transcoder:   env.string('PLEX_TRANSCODER',       'Plex Transcoder'),
        debug:             env.boolish('TRANSCODER_DEBUG',     false),
    },

    performance: {
        maxSessions:        env.int('MAX_SESSIONS',           10),
        maxDownloads:       env.int('MAX_DOWNLOADS',          10),
        maxTranscodes:      env.int('MAX_TRANSCODE',          10),
    },

    //routing: {
    //    'US': 'http://usgateway.myplex.com'
    //},
};
