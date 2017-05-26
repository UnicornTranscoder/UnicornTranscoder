/**
 * Created by drouar_b on 27/04/2017.
 */

let express = require('express');
let router = express.Router();

let m3u8 = require('../core/m3u8');
let stream = require('../core/stream');
let download = require('../core/download');
let transcoder = require('../core/transcoder');
let proxy = require('../core/proxy');
let bodyParser = require('body-parser');

//Stream mode
router.get('/video/:/transcode/universal/start', stream.serve);
router.get('/video/:/transcode/universal/subtitles', stream.serveSubtitles);

//m3u8 mode
router.get('/video/:/transcode/universal/session/:sessionId/base/index.m3u8', m3u8.serve);
router.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.ts', m3u8.serveParts);

// Download files
router.get('/library/parts/:id1/:id2/file.*', download.serve);

//Transcoder progression
router.post('/video/:/transcode/session/:sessionId/seglist', bodyParser.text({ type: "*/*" }), transcoder.chunkProcessCallback);

// Reverse all others to plex
router.all('*', proxy);

module.exports = router;