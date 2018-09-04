const io = require('socket.io-client');
const crypto = require('crypto');
const sleep = require('../utils/sleep');

class CommsWebsocket {
    constructor(config) {
        this._config = config;
        this._sendQueue = [];
        this._connected = false;
        this._queueInterval = setInterval(this._queueCheck.bind(this), config.server.queueTimeout);

        this._onConnected = this._onConnected.bind(this);
        this._onDisconnect = this._onDisconnect.bind(this);
        this._onMessage = this._onMessage.bind(this);
        this._connect();
    }

    async _connect() {
        let url = this._config.server.loadBalancer.replace(/^http/i, 'ws');
        if (!url.endsWith('/')) {
            url += '/';
        }
        this._ws = io(url, {
            transports: ['websocket'],
            path: '/rhino/comms'
        });
        
        this._ws.on('connect', () => this._onConnected);
        this._ws.on('connect_error', e => {
            console.error('Could not connect to upstream Load Balancer.');
            console.error(e.stack);
            process.exit(-5);
        });
        this._ws.on('reconnect', this._onConnected);
        this._ws.on('disconnect', this._onDisconnect);
        this._ws.on('error', this._onDisconnect);
        this._ws.on('message', this._onMessage);
    }

    _onConnected() {
        console.log('Connected to upstream Load Balancer');
        this._connected = true
    }

    _onDisconnect() {
        console.error('Cannot reach upstream Load Balancer.');
        this._connected = false;
    }

    _queueCheck() {
        for (let i = 0; i < this._sendQueue.length; i++) {
            const item = this._sendQueue[i];
            if (Date.now() - item.time > this._config.server.queueTimeout) {
                this._sendQueue.splice(i, 1);
                i--;
                item.reject();
            }
        }
    }

    _onMessage(json) {
        for (let i = 0; i < this._sendQueue.length; i++) {
            const item = this._sendQueue[i];
            if (item.eventId === json.eventId) {
                this._sendQueue.splice(i, 1);
                i--;
                delete json.eventId;
                delete json.event;
                item.resolve(json);
            }
            else if (Date.now() - item.time > this._config.server.queueTimeout) {
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
        if (this._connected) {
            this._ws.binary(true).compress(true).emit('message', event);
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
