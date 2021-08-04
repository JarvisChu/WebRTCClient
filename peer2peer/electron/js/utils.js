

const { desktopCapturer } = require('electron')

//var wsUri = "ws://localhost:8080/ws/p2p";
var wsUri = "ws://129.226.189.83:30001/ws/p2p";
var signalingChannel;
var peerConnection;
var isLogined = false;
var username
var flag = 1

var isOfferSender = false

function login() {
    username = document.getElementById("username").value
    console.info('username:', username)
    if(username.length == 0 ){
        alert("please input your name");
        return;
    }

    console.info("login: " + username);

    signalingChannel = new SignalingChannel(wsUri + '?name=' + username);
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
    peerConnection = new RTCPeerConnection(configuration);

    // Get local camera and send to peer
    const localCameraStream = await navigator.mediaDevices.getUserMedia({video: true,audio: false});
    const localCamera = document.querySelector('video#localCamera');
    localCamera.srcObject = localCameraStream;
    localCameraStream.getTracks().forEach(track => {
        console.log('add local camera track:', track); 
        peerConnection.addTrack(track, localCameraStream);
    });

    
    // Get local screen and send to peer
    // !!! Cannot user getDisplayMedia, using desktopCapturer instead
     
    /*
    const displayMediaOptions = {
        video: true,
        audio: false
    }
    const localScreenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    localScreenStream.getTracks().forEach(track => {
        console.log('add local screen track:', track);
        //peerConnection.addTrack(track, localScreenStream);
        peerConnection.addTrack(track);
    });*/

    const sources  = await desktopCapturer.getSources({types: ['window', 'screen']})
    for(const source of sources){
        console.info('source:', source)
        try {
            let localScreenStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video:{
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: source.id,
                        minWidth: 1280,
                        maxWidth: 1280,
                        minHeight: 720,
                        maxHeight: 720
                      }
                }
            })

            localScreenStream.getTracks().forEach(track => {
                console.log('add local screen track:', track);
                peerConnection.addTrack(track);
            });
        }catch(e){
            console.error(e)
        }

        break; // using first screen
    }
    
    // Get remote camera/screen track and set to local video tag
    const remoteCameraStream = new MediaStream();
    const remoteCamera = document.querySelector('#remoteCamera');
    remoteCamera.srcObject = remoteCameraStream;

    const remoteScreenStream = new MediaStream();
    const remoteScreen = document.querySelector('#remoteScreen');
    remoteScreen.srcObject = remoteScreenStream;

    peerConnection.addEventListener('track', async (event) => {
        console.log('add remote track:', event);
        if(event.track.kind == "audio"){
            remoteCameraStream.addTrack(event.track);
        }else if (event.track.kind == "video"){
            if (flag == 1){
                console.info("add camera video")
                remoteCameraStream.addTrack(event.track);
                flag = 2
            }else{
                console.info("add screen video")
                remoteScreenStream.addTrack(event.track);
            }
        }
    });

    // 收集自己的ice candidate，然后通过Siganl通道传输给对端
    // Listen for local ICE candidates on the local RTCPeerConnection
    peerConnection.addEventListener('icecandidate', event => {
        console.info("icecandidate:", event)
        if (event.candidate) {
            signalingChannel.send(JSON.stringify(event.candidate.toJSON()));
        }
    });

     // Listen for negotiationneeded event
     peerConnection.addEventListener('negotiationneeded', async event => {
        console.info("negotiationneeded: ", event)

        if (isOfferSender == true){
            // Create Offer
            await sendOffer();
        }
    })

    // 监听PeerConnection的连接建立事件
    // Listen for connectionstatechange on the local RTCPeerConnection
    peerConnection.addEventListener('connectionstatechange', event => {
        console.info("connectionstatechange: ", event)
        console.info("peerConnection.connectionState: ", peerConnection.connectionState)
        if (peerConnection.connectionState === 'connected') {
            // Peers connected!
            console.info("peer connected")
            
            var senders = peerConnection.getSenders()
            senders.forEach( sender => {
                var iceTransport = sender.transport.iceTransport
                var pair = iceTransport.getSelectedCandidatePair();
                console.info("pair: ", pair)
                console.info("connect type, local: ", pair.local.type, ", remote: ", pair.remote.type)
            })

            //var iceTransport = peerConnection.getSenders()[0].transport.iceTransport;
            //iceTransport.onselectedcandidatepairchange = function(event) {
               // var pair = iceTransport.getSelectedCandidatePair();
                //console.info('pair ', pair)
                //console.info("local proto ", pair.local.protocol.toUpperCase())
                //console.info("remote proto ", pair.remote.protocol.toUpperCase())
            //}

        }else if(peerConnection.connectionState === 'failed'){
            console.info("peer connect failed, restartIce")
            peerConnection.restartIce()
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
    signalingChannel.send("{\"type\":\"calling\", \"caller\":\"" + username + "\"}");
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

    isOfferSender = true
    await initPeerConnection();
    await sendOffer();
}

async function sendOffer(){
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    json = offer.toJSON();
    signalingChannel.send(JSON.stringify(json));
    document.getElementById("call").textContent = "chatting...";
    console.info("send offer:", json)
}

async function sendAnswer(){
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    json = answer.toJSON()
    signalingChannel.send(JSON.stringify(json));
    console.info("send answer: ", json)
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
        console.info("recv offer: ", message);
        peerConnection.setRemoteDescription(new RTCSessionDescription(message));
        await sendAnswer();
    }

    // 呼叫方收到应答方的answer
    else if (message.type == "answer") {
        console.info("recv answer: ", message)
        const remoteDesc = new RTCSessionDescription(message);
        await peerConnection.setRemoteDescription(remoteDesc);
    }

    // 对方发来的iceCandidate
    else if (message.candidate) {
        console.info("recv remote candidate: ", message.candidate )
        try {
            await peerConnection.addIceCandidate(message);
        } catch (e) {
            console.error('Error adding received ice candidate', e);
        }
    }
}