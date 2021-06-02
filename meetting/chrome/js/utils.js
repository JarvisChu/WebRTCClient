//var wsUri = "ws://localhost:8080/ws/room";
var wsUri = "ws://129.226.189.83:30001/ws/room";
var signalingChannel;
var peerConnection;
var isLogined = false;
var username
var roomid
var flag = 0
var test = false

const mediaStreamConstraints = {
    video: true,
    audio: true,
};

var localCameraStream
var peerConnections = []
var configuration = {'iceServers': [{'urls': 'stun:stun.ekiga.net'}]};

function showVideo(userName, stream){
    console.info('showVideo, UserName:', userName)

    document.getElementById("videosDiv").hidden = false

    let titleElem = document.createElement('h1')
    titleElem.id = userName + '_title'
    titleElem.textContent = userName
    document.querySelector('#videosDiv').appendChild(titleElem);

    let videoElem = document.createElement('video')
    videoElem.id = userName + '_video'
    videoElem.srcObject   = stream;
    videoElem.autoplay    = true;
    videoElem.muted       = false;
    videoElem.playsinline = true;
    videoElem.controls    = false;
    document.querySelector('#videosDiv').appendChild(videoElem);
}

function removeVideo(userName){
    console.info('removeVideo, userName:', userName)

    let title = document.getElementById(userName+'_title');
    title.parentNode.removeChild(title);

    let video = document.getElementById(userName+'_video');
    video.parentNode.removeChild(video);
}

async function login() {
    username = document.getElementById("username").value
    if(username.length == 0 ){
        if(test){
            username = Math.round(Math.random()*1000).toString();
        }else{
            alert("please input your name");
            return;
        }
    }

    roomid = document.getElementById("roomid").value
    if(roomid.length == 0){
        if(test){
            roomid = 12345
        }else{
            alert("please input room id");
            return;
        }
    }

    console.info("login with name:" + username + ", roomid:" + roomid);

    // show local camera
    localCameraStream = await navigator.mediaDevices.getUserMedia(mediaStreamConstraints)
    showVideo(username, localCameraStream) 

    // login
    signalingChannel = new SignalingChannel(wsUri + '?name=' + username + '&roomid=' + roomid)
    signalingChannel.websocket.onopen = onLoginSuccess
    signalingChannel.websocket.onerror = async function (evt) {
        console.info("onerror: ", evt);
    }
}

function printLog(msg){
    document.getElementById("log").value += msg + '\n'
}

async function onLoginSuccess(evt) {
    console.info("onLoginSuccess: ", evt);
    signalingChannel.websocket.onmessage = function(evt){ onRecvMessage(evt)};

    isLogined = true; 
    document.getElementById("loginDiv").hidden = true
    document.getElementById("statusDiv").hidden = false
    document.getElementById("status").textContent = "login success: username(" + username + "), roomid(" + roomid + ")";
    document.getElementById("status").disabled = true;
    document.getElementById("logDiv").hidden = false
    printLog("user login:" + username)
}

async function onRecvMessage(evt){
    console.info("onmessage: ", evt);
    var message = JSON.parse(evt.data);

    if ( message.to != undefined && message.to.length > 0 && message.to != username) {
        return
    }

    if (message.type == "user_enter") {
        await onUserEnterRoom(message);
    }else if (message.type == "user_exit") {
        onUserExitRoom(message);
    }else if (message.type == "user_in_room") {
        onRecvUserInRoom(message);
    }else if (message.type == "offer") {
        onRecvOffer(message)
    }else if (message.type == "answer") {
        onRecvAnswer(message)
    }else if (message.type == "candidate") {
        onRecvCandidate(message)
    }
}

function initPeerConnection(remoteUserName){
    console.info("initPeerConnection, peer:", remoteUserName)
    peerConnections[remoteUserName] = new RTCPeerConnection(configuration);
    
    // Send Local Camera stream to peer
    localCameraStream.getTracks().forEach(track => {
        console.log('peer:' + remoteUserName + ', add local camera track', track); 
        peerConnections[remoteUserName].addTrack(track, localCameraStream)
    })
    
    // Listen for local ICE candidates on the local RTCPeerConnection
    peerConnections[remoteUserName].addEventListener('icecandidate', event => {
        console.info("got local icecandidate:", event)
        if (event.candidate) {
            var json = event.candidate.toJSON()
            json.type = 'candidate'
            json.from = username
            json.to = remoteUserName
            signalingChannel.send(JSON.stringify(json));
        }
    });

    // Listen for connectionstatechange on the local RTCPeerConnection
    peerConnections[remoteUserName].addEventListener('connectionstatechange', event => {
        console.info("connectionstatechange: ", event)
        console.info("peerConnection.connectionState: ", peerConnections[remoteUserName].connectionState)
        if (peerConnections[remoteUserName].connectionState === 'connected') {
            // Peers connected!
            console.info("peer connected, peer:", remoteUserName)
            printLog("peer connected, peer:" + remoteUserName)
        }else if (peerConnections[remoteUserName].connectionState === 'failed'){
            printLog("peer connect failed, peer:" + remoteUserName)
        }
    });

    // Listen for signalingstatechange
    peerConnections[remoteUserName].addEventListener("signalingstatechange", ev => {
        console.info("signalingstatechange: ", ev)
        switch(peerConnections[remoteUserName].signalingState) {
          case "stable":
            console.info("ICE negotiation complete, peer:", remoteUserName);
            break;
        }
    });

    // Listen for remote tracks, and set to local stream
    const remoteCameraStream = new MediaStream();
    showVideo(remoteUserName, remoteCameraStream)
    peerConnections[remoteUserName].addEventListener('track', async (event) => {
        console.log('add remote track:', event);
        remoteCameraStream.addTrack(event.track)
        /*if(event.track.kind == "audio"){
            remoteCameraStream.addTrack(event.track);
        }else if (event.track.kind == "video"){

            // 简单处理，区分摄像头视频和桌面分享视频
            if(flag == 0){
                remoteCameraStream.addTrack(event.track);
                flag = 1;
            }else{
                remoteScreenStream.addTrack(event.track);
            }
        }*/
    });
}

async function onUserEnterRoom(message){
    console.info("onUserEnterRoom:", message)
    const remoteUserName = message.user_name
    if (remoteUserName == username) {
        return;
    }

    printLog("user login:" + remoteUserName)
    initPeerConnection(remoteUserName)

    // Create Offer
    const offer = await peerConnections[remoteUserName].createOffer();
    await peerConnections[remoteUserName].setLocalDescription(offer);
    var json = offer.toJSON()
    json.from = username
    json.to = remoteUserName
    signalingChannel.send(JSON.stringify(json));
}

function onUserExitRoom(message){
    console.info("onUserExitRoom:", message)
    printLog("user logout:" + message.user_name)
    //peerConnections[message.user_name] = null
    removeVideo(message.user_name)
}

function onRecvUserInRoom(message) {
    console.info("onRecvUserInRoom:", message)
    printLog("user in room:" + message.user_name)
    initPeerConnection(message.user_name)
}

async function onRecvOffer(message) {
    console.info("onRecvOffer:", message)
    
    peerConnections[message.from].setRemoteDescription(new RTCSessionDescription(message));
    const answer = await peerConnections[message.from].createAnswer();
    await peerConnections[message.from].setLocalDescription(answer);

    var json = answer.toJSON()
    json.from = username
    json.to = message.from
    signalingChannel.send(JSON.stringify(json));
}

async function onRecvAnswer(message) {
    console.info("onRecvAnswer: ", message)
    
    const remoteDesc = new RTCSessionDescription(message);
    await peerConnections[message.from].setRemoteDescription(remoteDesc);
}

async function onRecvCandidate(message) {
    console.info("onRecvCandidate: ", message)
    try {
        await peerConnections[message.from].addIceCandidate(message);
    } catch (e) {
        console.error('Error adding received ice candidate', e);
    }
}