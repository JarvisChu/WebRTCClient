//var wsUri = "ws://localhost:8080/ws";
var wsUri = "ws://129.226.189.83:30001/ws";
var signalingChannel;
var peerConnection;
var isLogined = false;
var username

function log(msg){
    var pre = document.createElement("p");
    pre.style.wordWrap = "break-word";
    pre.innerHTML = msg;

    var output = document.getElementById("status");
    output.appendChild(pre);
}

function login() {
    username = document.getElementById("username").value
    console.info('username:', username)
    if(username.length == 0 ){
        alert("please input your name");
        return;
    }

    console.info("login: " + username);

    signalingChannel = new SignalingChannel(wsUri + '?id=' + username);
    signalingChannel.websocket.onopen = async function (evt) {
        console.info("onopen: ", evt);
        isLogined = true;
        signalingChannel.websocket.onmessage = function(evt){ onRecvMessage(evt)};
        document.getElementById("login").disabled = true;
        document.getElementById("login").textContent = "login success";
    }
    signalingChannel.websocket.onerror = async function (evt) {
        console.info("onerror: ", evt);
    }
}

async function initPeerConnection(){
    console.info("initPeerConnection");
    
    const configuration = {'iceServers': [{'urls': 'stun:stun.ekiga.net'}]};
    /*
    const configuration = {'iceServers': [
        {'urls': 'stun:stun.ekiga.net'},
        {'urls':'stun:stun4.l.google.com:19302'},
        {'urls': 'stun:stun.voipbuster.com:3478'},
        {'urls': 'stun:stun.wirlab.net:3478'},
        {'urls': 'stun:stun.l.google.com:19302'},
        {'urls': 'stun:stun.xten.com:3478'},
        {'urls': 'stun:stun.sipgate.net:3478'},   
        {'urls': 'stun:stun.ideasip.com:3478'},
        {'urls': 'stun:stun.schlund.de:3478'},
        {'urls': 'stun:stun.voiparound.com:3478'},
        {'urls': 'stun:stun.voipstunt.com:3478'},
        {'urls': 'stun:stun.counterpath.com:3478'},
        {'urls': 'stun:stun.1und1.de:3478'},
        {'urls': 'stun:stun.gmx.net:3478'},
        {'urls': 'stun:stun.callwithus.com:3478'},
        {'urls': 'stun:sstun.counterpath.net:3478'}]};    */

    peerConnection = new RTCPeerConnection(configuration);

    // Set local media
    const localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
    const localVideo = document.querySelector('video#localVideo');
    localVideo.srcObject = localStream;
    localStream.getTracks().forEach(track => {
        console.log('add local track:', track);
        peerConnection.addTrack(track, localStream);
    });

    // Set remote media
    const remoteStream = new MediaStream();
    const remoteVideo = document.querySelector('#remoteVideo');
    remoteVideo.srcObject = remoteStream;
    peerConnection.addEventListener('track', async (event) => {
        console.log('add remote track:', event);
        remoteStream.addTrack(event.track, remoteStream);
    });

    // 收集自己的ice candidate，然后通过Siganl通道传输给对端
    // Listen for local ICE candidates on the local RTCPeerConnection
    peerConnection.addEventListener('icecandidate', event => {
        console.info("icecandidate:", event)
        log("get local icecandidate: ", event)
        if (event.candidate) {
            signalingChannel.send(JSON.stringify(event.candidate.toJSON()));
        }
    });

    // 监听PeerConnection的连接建立事件
    // Listen for connectionstatechange on the local RTCPeerConnection
    peerConnection.addEventListener('connectionstatechange', event => {
        console.info("connectionstatechange: ", event)
        if (peerConnection.connectionState === 'connected') {
            // Peers connected!
            console.info("peer connected")
        }
    });

    peerConnection.addEventListener("signalingstatechange", ev => {
        console.info("signalingstatechange: ", ev)
        switch(peerConnection.signalingState) {
          case "stable":
            console.info("ICE negotiation complete");
            break;
        }
    }, false);

}

// 呼叫
function call(){
    var peername = document.getElementById("peername").value
    console.info('peername:', peername)
    if(peername.length == 0 ){
        alert("please input peer name");
        return;
    }

    if(!isLogined){
        alert("please login first");
        return;
    }

    console.info("call, peername" + peername);

    signalingChannel.send("set-peer:" + peername);
    signalingChannel.send("{\"type\":\"calling\", \"caller\":" + username + "}");
    document.getElementById("call").disabled = true; 
    document.getElementById("call").textContent = "calling...";
}

// 收到对方的呼叫请求
function onPeerCall(message){
    console.info("onCall: " + message);
    var r =confirm("receive calling from: " + message.caller + ", pickup or not ?");
	if (r==true){ 
        accept(message.caller);
    } else{
		reject(message.caller);
	}
}

// 拒接
function reject(caller){
    console.info("reject");
    signalingChannel.send("set-peer:" + caller);
    signalingChannel.send("{\"type\":\"reject\"}");
}

// 对方拒绝接听
function onPeerReject(){
    console.info("onPeerReject");
    document.getElementById("call").disabled = false; 
    document.getElementById("call").textContent = "peer reject. call again?";
}

// 接听
async function accept(caller){
    console.info("accept");
    signalingChannel.send("set-peer:" + caller);
    await initPeerConnection();   
    signalingChannel.send("{\"type\":\"accept\"}");

    document.getElementById("call").disabled = true;
    document.getElementById("call").textContent = "chatting...";
}

// 对方接听
async function onPeerAccept(){
    console.info("onPeerAccept");
    await initPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    signalingChannel.send(JSON.stringify(offer.toJSON()));

    document.getElementById("call").textContent = "chatting...";
}

// 挂断
function hangup(){
    console.info("hangup");
    signalingChannel.send("{\"type\":\"hangup\"}");
}

// 对方挂断
function onPeerHangup(){
    console.info("onPeerHangup");
}

async function onRecvMessage(evt){
    console.info("onmessage: ", evt);
    var message = JSON.parse(evt.data);

    // 收到呼叫请求
    if (message.type == "calling") {
        onPeerCall(message);
    }

    // 对方拒绝接听
    else if (message.type == "reject") {
        onPeerReject();
    }

    // 对方接听
    else if (message.type == "accept") {
        onPeerAccept();
    }

    // 对方挂断
    else if (message.type == "hangup") {
        onPeerHangup();
    }

    // 应答方收到呼叫方的offer
    else if (message.type == "offer") {
        log("recv offer: ", message);
        peerConnection.setRemoteDescription(new RTCSessionDescription(message));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        signalingChannel.send(JSON.stringify(answer.toJSON()));
    }

    // 呼叫方收到应答方的answer
    else if (message.type == "answer") {
        log("recv answer: ", message)
        const remoteDesc = new RTCSessionDescription(message);
        await peerConnection.setRemoteDescription(remoteDesc);
    }

    // 对方发来的iceCandidate
    else if (message.candidate) {
        log("recv remote candidate: ", message.candidate )
        console.info("add remote candidate", message.candidate)
        try {
            await peerConnection.addIceCandidate(message);
        } catch (e) {
            console.error('Error adding received ice candidate', e);
        }
    }
}