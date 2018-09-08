const xml2js = require('xml2js');
const util = require('util');
const pad = require('../utils/pad');
const LeakyBucket = require('leaky-bucket');

class FFMPEG {
    constructor(websocket) {
        this._ws = websocket;
        this._parseXmlString = util.promisify(xml2js.parseString);
        this._buckets = {};
    }

    _createBucket(sessionId, res) {
        if (this._buckets[sessionId] === void (0)) {
            this._buckets[sessionId] = new LeakyBucket(1, 1, 1);
        }
        return new Promise(resolve => this._buckets[sessionId].reAdd(1, err => {
            if (err) {
                res.end();
            }
            resolve(!!err);
        }));
    }

    async seglistParser(req, res) {
        if (!(await this._createBucket(req.params.sessionId, res))) {
            return;
        }

        let last = -1;

        try {
            const savedChunks = await this._ws.getByKeyPattern(`${req.params.sessionId}:*`);
            for (let itm of req.body.split(/\r?\n/)) {
                itm = itm.split(',');
                let chk = itm.shift();

                //Long polling
                if (chk.match(/^chunk-[0-9]{5}/)) {
                    const chunkId = chk.replace(/chunk-([0-9]{5})/, '$1');
                    const searchStr = `${req.params.sessionId}:0:${chunkId}`;
                    if (savedChunks.indexOf(searchStr) === -1) {
                        this._ws.updateKey(searchStr, itm.toString());

                        let beginning = Math.ceil(parseFloat(itm[0]));
                        let end = Math.floor(parseFloat(itm[1]));

                        if (beginning < end - 10) {
                            beginning = end - 10;
                        }

                        for (let i = beginning; i < end + 1; i++) {
                            this._ws.updateKey(`${req.params.sessionId}:timecode:${i}`, chunkId);
                        }
                    }
                    last = parseInt(chunkId);
                }
                if (chk.match(/^sub-chunk-[0-9]{5}/)) {
                    const chunkId = chk.replace(/sub-chunk-([0-9]{5})/, '$1');
                    const searchStr = `${req.params.sessionId}:sub:${chunkId}`;
                    if (savedChunks.indexOf(searchStr) === -1) {
                        this._ws.updateKey(searchStr, itm.toString())
                    }
                }

                //M3U8
                if (chk.match(/^media-[0-9]{5}\.ts/)) {
                    const chunkId = chk.replace(/media-([0-9]{5})\.ts/, '$1');
                    const searchStr = `${req.params.sessionId}:0:${chunkId}`;
                    if (savedChunks.indexOf(searchStr) === -1) {
                        this._ws.updateKey(searchStr, itm.toString());
                    }
                    last = parseInt(chunkId);
                }
                if (chk.match(/^media-[0-9]{5}\.vtt/)) {
                    const chunkId = chk.replace(/media-([0-9]{5})\.vtt/, '$1');
                    const searchStr = `${req.params.sessionId}:sub:${chunkId}`;
                    if (savedChunks.indexOf(searchStr) === -1) {
                        this._ws.updateKey(searchStr, itm.toString());
                    }
                }
            }

            if (last !== -1) {
                this._ws.updateKey(`${req.params.sessionId}:last`, last);
            }

            res.end();
        }
        catch (e) {
            console.error(`Segment list parsing failed: ${e}\n${e.stack}`);
        }
    }

    manifestParser(req, res) {
        if (!(await this._createBucket(req.params.sessionId, res))) {
            return;
        }

        try {
            const reply = await this._ws.getSession(req.params.sessionId);
            if (reply === void (0)) {
                res.end();
                return;
            }

            let parsed = JSON.parse(reply);
            if (parsed === null) {
                res.end();
                return;
            }

            let prev = null;
            let segmentTime = 5;
            for (let i = 0; i < parsed.args.length; i++) {
                if (prev === "-min_seg_duration") {
                    segmentTime = parsed.args[i] / 1000000;
                    break;
                }
                prev = parsed.args[i];
            }

            const savedChunks = await this._ws.getByKeyPattern(req.params.sessionId + ":[0-9]:*");
            const mpd = await this._parseXmlString(req.body);

            let last = -1;

            let offset = 1;
            for (let adaptationSet of mpd.MPD.Period[0].AdaptationSet) {
                let c = 0;
                let i = 0;
                let streamId = adaptationSet.Representation[0]["$"].id;
                let timeScale = adaptationSet.Representation[0].SegmentTemplate[0]["$"].timescale;

                for (let s of adaptationSet.Representation[0].SegmentTemplate[0].SegmentTimeline[0].S) {
                    if (s["$"].t !== void (0) && streamId === 0) {
                        offset = Math.round((s["$"].t / timeScale) / segmentTime);
                    }
                    for (i = c; i < c + (s["$"].r !== void (0) ? parseInt(s["$"].r) + 1 : 1); i++) {
                        if (savedChunks.indexOf(req.params.sessionId + ":" + streamId + ":" + pad(i + offset, 5)) === -1) {
                            this._ws.updateKey(req.params.sessionId + ":" + streamId + ":" + pad(i + offset, 5), s["$"].d);
                        }
                        if (i + offset > last) {
                            last = i + offset;
                        }
                    }
                    c = i;
                }

                if (last !== -1) {
                    this._ws.updateKey(req.params.sessionId + ":" + streamId + ":00000", 0);
                    if (streamId === 0) {
                        this._ws.updateKey(req.params.sessionId + ":last", last);
                    }
                }
            }
        }
        catch (e) {
            console.error('Parsing manifest failed.');
        }
        res.end();
    }
}

module.exports = FFMPEG;