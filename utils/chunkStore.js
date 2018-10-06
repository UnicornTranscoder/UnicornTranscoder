/**
 * Created by drouar_b on 27/04/2017.
 */

const EventEmitter = require('events');
const utils = require('./utils');

class ChunkStore {
    constructor(last = 0) {
        this.chunkStore = {};
        this.destroying = false;
    }

    _getChunk(streamId, chunkId) {
        if (!(streamId in this.chunkStore))
            this.chunkStore[streamId] = {};
        if (!(chunkId in this.chunkStore[streamId]))
            this.chunkStore[streamId][chunkId] = new EventEmitter();
        return this.chunkStore[streamId][chunkId];
    }

    saveChunk(streamId, chunkId, value) {
        if (this.destroying)
            return;

        if (chunkId !== 'init')
            chunkId = utils.pad(chunkId, 5);

        let chunk = this._getChunk(streamId, chunkId);
        if (chunk instanceof EventEmitter)
            chunk.emit('event', value);
        this.chunkStore[streamId][chunkId] = value;
    }

    getChunk(streamId, chunkId, callback) {
        if (this.destroying)
            return callback('destroyed');

        if (chunkId !== 'init')
            chunkId = utils.pad(chunkId, 5);

        if (typeof callback === 'undefined') {
            if ((!(streamId in this.chunkStore) ||
                    !(chunkId in this.chunkStore[streamId]) ||
                    (this.chunkStore[streamId][chunkId] instanceof EventEmitter)))
                return null;
            else
                return this.chunkStore[streamId][chunkId];
        }

        let chunk = this._getChunk(streamId, chunkId);

        if (typeof chunk === 'string') {
            callback(chunk);
        } else {
            let timeout = null;

            let eventCb = (...args) => {
                if (timeout !== null)
                    clearTimeout(timeout);
                chunk.removeListener('event', eventCb);
                callback(...args);
            };

            let timeoutCb = () => {
                chunk.removeListener('event', eventCb);
                callback('timeout');
            };

            chunk.on('event', eventCb);
            timeout = setTimeout(timeoutCb, 10000);
        }
    }

    hasChunk(streamId, chunkId) {
        if (chunkId !== 'init')
            chunkId = utils.pad(chunkId, 5);

        return (streamId in this.chunkStore) && (chunkId in this.chunkStore[streamId]) &&
            !(this.chunkStore[streamId][chunkId] instanceof EventEmitter);
    }

    clean() {
        let oldCs = this.chunkStore;
        this.chunkStore = {};

        Object.keys(oldCs).forEach((streamId) => {
            Object.keys(oldCs[streamId]).forEach((chunkId) => {
                if (oldCs[streamId][chunkId] instanceof EventEmitter) {
                    oldCs[streamId][chunkId].emit('event', 'clean');
                    oldCs[streamId][chunkId].removeAllListeners('event');
                }
            })
        })
    }

    destroy() {
        this.destroying = true;

        Object.keys(this.chunkStore).forEach((streamId) => {
            Object.keys(this.chunkStore[streamId]).forEach((chunkId) => {
                if (this.chunkStore[streamId][chunkId] instanceof EventEmitter) {
                    this.chunkStore[streamId][chunkId].emit('event', 'destroyed');
                    this.chunkStore[streamId][chunkId].removeAllListeners('event');
                }
            })
        });

        this.chunkStore = {};
    }

    getLast() {
        return this.last;
    }

    setLast(last) {
        this.last = last;
    }
}

module.exports = ChunkStore;