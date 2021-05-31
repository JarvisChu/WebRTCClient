class SignalingChannel {
    constructor(wsUri) {
        this.websocket = new WebSocket(wsUri);
    }
    send(data) {
        this.websocket.send(data);
    }
    addEventListener(evt, cb, options) {
        this.websocket.addEventListener(evt, cb) ;
    }
}





