/**
 * Created by drouar_b on 27/04/2017.
 */

const EventEmitter = require('events');
const utils = require('./utils');

class ChunkStore {
    constructor() {
        this.last = {};
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
        if (this.destroying) {
            if (typeof callback === 'function')
                callback('destroyed');
            return null;
        }

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

    clean() {
        let oldCs = this.chunkStore;
        this.chunkStore = {};
        this.last = {};

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

        this.last = {};
        this.chunkStore = {};
    }

    getLast(streamId) {
        return this.last[streamId] || 0;
    }

    setLast(streamId, last) {
        this.last[streamId] = last;
    }
}

module.exports = ChunkStore;