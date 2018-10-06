/**
 * Created by drouar_b on 27/04/2017.
 */

const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();

const dash = require('../core/dash');
const m3u8 = require('../core/m3u8');
const stream = require('../core/stream');
const download = require('../core/download');
const universal = require('../core/universal');
const ffmpeg = require('../core/ffmpeg');
const proxy = require('../core/proxy');

//Dash routes
router.get('/video/:/transcode/universal/start.mpd', dash.serve);
router.get('/video/:/transcode/universal/dash/:sessionId/:streamId/initial.mp4', dash.serveInit);
router.get('/video/:/transcode/universal/dash/:sessionId/:streamId/:partId.m4s', dash.serveChunk);

//m3u8 mode
router.get('/video/:/transcode/universal/start.m3u8', m3u8.saveSession);
router.get('/video/:/transcode/universal/session/:sessionId/base/index.m3u8', m3u8.serve);
router.get('/video/:/transcode/universal/session/:sessionId/base-x-mc/index.m3u8', m3u8.serve);
router.get('/video/:/transcode/universal/session/:sessionId/vtt-base/index.m3u8', proxy);
router.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.ts', m3u8.serveChunk);
router.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.vtt', m3u8.serveSubtitles);

//Stream mode
router.get('/video/:/transcode/universal/start', stream.serve);
router.get('/video/:/transcode/universal/subtitles', stream.serveSubtitles);

//Universal endpoints
router.get('/video/:/transcode/universal/stop', universal.stopTranscoder);
router.get('/video/:/transcode/universal/ping', universal.ping);
router.get('/:/timeline', universal.timeline);

// Download files
router.get('/library/parts/:id1/:id2/file.*', download.serve);

//Transcoder progression
router.post('/video/:/transcode/session/:sessionId/:ffmpeg/seglist', bodyParser.text({ type: () => {return true}, limit: '50mb' }), ffmpeg.seglistParser);
router.post('/video/:/transcode/session/:sessionId/:ffmpeg/manifest', bodyParser.text({ type: () => {return true}, limit: '50mb' }), ffmpeg.manifestParser);

//Transcoder stats
router.get('/api/stats', universal.stats);

module.exports = router;
