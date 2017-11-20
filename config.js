/**
 * Created by drouar_b on 27/04/2017.
 */

const getenv = require('getenv');

module.exports = getenv.multi({
    // app config
    port:                  ["PORT", 3000, 'int'],
    wait_time:             ['WAIT_TIME', 1000, 'int'],
    max_tries:             ['MAX_TRIES', 30, 'int'],
    mount_point:           ['MOUNT_POINT', '/mnt/acd'],
    workers:               ['WORKERS', require('os').cpus().length],
    transcoder_decay_time: ['TRANSCODER_DECAY_TIME', 120, 'int'],

    //plex config
    srt_url:  ['SRT_URL', 'https://srt.localhost'],
    api_url:  ['API_URL', 'https://api.localhost'],
    plex_url: ['PLEX_URL', 'http://myplex.com:32400'],

    //redis config
    redis_host: ['REDIS_HOST', '127.0.0.1'],
    redis_port: ['REDIS_PORT', '6379'],
    redis_pass: ['REDIS_PASSWORD', ''],
    redis_db:   ['REDIS_DB', 1, 'int'],

    //Transcoder settings
    video_content_type:       ['VIDEO_CONTENT_TYPE', 'video/x-matroska'],
    subtitles_content_type:   ['SUBTITLES_CONTENT_TYPE', 'text/vtt'],
    ld_library_path:          ['LD_LIBRARY_PATH', '/root/UnicornTranscoder/Resources/'],
    transcoder_path:          ['TRANSCODER_PATH', '/root/UnicornTranscoder/Resources/Plex Transcoder'],
    ffmpeg_external_libs:     ['FFMPEG_EXTERNAL_LIBS', '/root/UnicornTranscoder/Codecs/'],
    eae_root:                 ['EAE_ROOT', '/root/UnicornTranscoder/Cache/'],
    xdg_cache_home:           ['XDG_CACHE_HOME', '/root/UnicornTranscoder/Cache/'],
    xdg_data_home:            ['XDG_DATA_HOME', '/root/UnicornTranscoder/Resources/Resources/'],
    plex_ressources:          ['PLEX_RESSOURCES', '/root/UnicornTranscoder/Resources/']
});

// TODO Remove API
module.exports.endpoints = {
    path: "/path/",
    transcode: "/transcode/"
};
