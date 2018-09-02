const WebSocket = require('ws');
const crypto = require('crypto');
const sleep = require('../utils/sleep');

class CommsWebsocket {
    constructor(config) {
        this._config = config;
        this._connect();
        this._onPing = this._onPing.bind(this);
        this._keepAliveInterval = setInterval(this._keepAliveCheck.bind(this), config.server.keepAliveTimeout);
        this._lastKeepAlive = -1;
        this._sendQueue = [];
    }

    async _connect() {
        if (this._ws) {
            this._ws.terminate();
        }
        let url = this._config.server.loadBalancer.replace(/^http/i, 'ws');
        if (!url.endsWith('/')) {
            url += '/';
        }
        this._ws = new WebSocket(`${url}rhino/comms`);
        this._ws.on('message', this._onMessage.bind(this));
        this._ws.on('error', () => {}); // keep alive check will clean up
        this._ws.on('ping', this._onPing.bind(this));
        this._ws.on('pong', this._onPing.bind(this));
    }

    _keepAliveCheck() {
        if (this._lastKeepAlive > 0) {
            const diff = Date.now() - this._lastKeepAlive;
            if (diff > this._config.server.keepAliveTimeout) {
                this._connect();
            }
        }
        for (let i = 0; i < this._sendQueue.length; i++) {
            const item = this._sendQueue[i];
            if (Date.now() - item.time > this._config.server.keepAliveTimeout) {
                this._sendQueue.splice(i, 1);
                i--;
                item.reject();
            }
        }
    }

    _onPing() {
        this._lastKeepAlive = Date.now();
        this._ws.pong(() => {});
    }

    _onMessage(data) {
        const json = JSON.parse(data);
        for (let i = 0; i < this._sendQueue.length; i++) {
            const item = this._sendQueue[i];
            if (item.eventId === json.eventId) {
                this._sendQueue.splice(i, 1);
                i--;
                delete json.eventId;
                delete json.event;
                item.resolve(json);
            }
            else if (Date.now() - item.time > this._config.server.keepAliveTimeout) {
                this._sendQueue.splice(i, 1);
                i--;
                item.reject();
            }
        }
    }

    send(eventName, data) {
        const event = Object.assign({
            eventId: crypto.randomBytes(16).toString("hex"),
            event: eventName
        }, data);
        console.log(`sending ${JSON.stringify(event)}`)
        if (this._ws.readyState === WebSocket.OPEN) {
            console.log('sent');
            this._ws.send(JSON.stringify(event));
        }
        return event;
    }

    sendWait(event, data) {
        let resolve;
        let reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        const event = this.send(event, data);
        this._sendQueue.push({
            eventId: event.eventId,
            resolve: resolve,
            reject: reject,
            time: Date.now()
        });
        return promise;
    }

    async getSession(id) {
        return await this.sendWait('session', {

        });
    }

    async getByKeyPattern(pattern) {

    }
    
    async getByKey(key) {

    }
    
    async updateKey(key, val) {

    }
    
    async deleteKeys(keys) {

    }
}

module.exports = CommsWebsocket;
