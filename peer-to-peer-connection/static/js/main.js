/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
callButton.disabled = true;
hangupButton.disabled = true;
startButton.disabled = true;
startButton.addEventListener('click', start);
callButton.addEventListener('click', call);
hangupButton.addEventListener('click', hangup);

let startTime;
var localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');


// Added on 3rd, Oct  --- START
var canvas = document.getElementById('processed_image');
var image_id = document.getElementById('image');

remoteVideo.addEventListener('loadedmetadata', function () {
  // console.log(`Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
  image_id.width = remoteVideo.videoWidth;
  image_id.height = remoteVideo.videoHeight;

  // console.log(`Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
  canvas.width = remoteVideo.videoWidth;
  canvas.height = remoteVideo.videoHeight;
});

// Added on 3rd, Oct  --- END

localVideo.addEventListener('loadedmetadata', function () {
  console.log(`Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});


remoteVideo.addEventListener('resize', () => {
  console.log(`Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`);
  // We'll use the first onsize callback as an indication that video has started
  // playing out.
  if (startTime) {
    const elapsedTime = window.performance.now() - startTime;
    console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
    startTime = null;
  }
});

let localStream;
let pc1;
let pc2;

// Added
let sendChannel;
let receiveChannel;

const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

function getName(pc) {
  return (pc === pc1) ? 'pc1' : 'pc2';
}

function getOtherPc(pc) {
  return (pc === pc1) ? pc2 : pc1;
}

async function start() {

  console.log('Requesting local stream');
  // startButton.disabled = true;
  localVideo.load();
  localVideo.play();

  if (localStream) {
    return;
  }
  try {
    if (localVideo.captureStream) {
      const stream = localVideo.captureStream();
      localStream = stream;
      console.log('Captured stream from leftVideo with captureStream',
        stream);
    } else if (localVideo.mozCaptureStream) {
      const stream = localVideo.mozCaptureStream();
      localStream = stream;
      console.log('Captured stream from leftVideo with mozCaptureStream()',
        stream);
    } else {
      console.log('captureStream() not supported');
    }

    console.log('Received local stream');
    callButton.disabled = false;
  } catch (e) {
    console.log('captureStream() error: ', e);
    //alert(`captureStream() error: ${e.name}`);
  }
}

// async function start() {
//   console.log('Requesting local stream');
//   startButton.disabled = true;
//   try {
//     const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
//     console.log('Received local stream');
//     localVideo.srcObject = stream;
//     localStream = stream;
//     callButton.disabled = false;
//   } catch (e) {
//     alert(`getUserMedia() error: ${e.name}`);
//   }
// }


/**
 * Captures a image frame from the provided video element.
 *
 * @param {Video} video HTML5 video element from where the image frame will be captured.
 * @param {Number} scaleFactor Factor to scale the canvas element that will be return. This is an optional parameter.
 *
 * @return {Canvas}
 */
function capture(video, scaleFactor) {
  if (scaleFactor == null) {
    scaleFactor = 1;
  }
  // var w = video.videoWidth * scaleFactor;
  // var h = video.videoHeight * scaleFactor;
  var w = 432;
  var h = 233;
  // var canvas = document.createElement('canvas');
  var canvas = document.getElementById("canvasOutput");
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, w, h);
  return canvas;
}


var imageCapture;
var socket;

navigator.mediaDevices.getUserMedia({ video: true })
  .then(mediaStream => {
    document.querySelector('video').srcObject = mediaStream;

    const track = mediaStream.getVideoTracks()[0];
    imageCapture = new ImageCapture(track);

    return imageCapture.getPhotoCapabilities();
  })

async function call() {

  callButton.disabled = true;
  hangupButton.disabled = false;
  console.log('Starting call');
  startTime = window.performance.now();
  const videoTracks = localStream.getVideoTracks();
  const audioTracks = localStream.getAudioTracks();

  // console.log("SETTINGS: " + videoTracks[0].getSettings().frameRate)
  if (videoTracks.length > 0) {
    console.log(`Using video device: ${videoTracks[0].label}`);
  }
  if (audioTracks.length > 0) {
    console.log(`Using audio device: ${audioTracks[0].label}`);
  }
  const configuration = {};
  console.log('RTCPeerConnection configuration:', configuration);
  pc1 = new RTCPeerConnection(configuration);
  console.log('Created local peer connection object pc1');
  pc1.addEventListener('icecandidate', e => onIceCandidate(pc1, e));
  pc2 = new RTCPeerConnection(configuration);
  console.log('Created remote peer connection object pc2');
  pc2.addEventListener('icecandidate', e => onIceCandidate(pc2, e));
  pc1.addEventListener('iceconnectionstatechange', e => onIceStateChange(pc1, e));
  pc2.addEventListener('iceconnectionstatechange', e => onIceStateChange(pc2, e));
  pc2.addEventListener('track', gotRemoteStream);

  // Added code
  sendChannel = pc1.createDataChannel('sendDataChannel');
  console.log('Created data channel to send');
  pc2.ondatachannel = receiveChannelCallback;

  socket = io('http://127.0.0.1:5000');

  socket.on('connect', function () {
    console.log("Connected...!", socket.connected)
  });

  localStream.getTracks().forEach(track => {
    const FPS = 50

    setInterval(() => {

      var type = "image/jpeg"
      var frame = capture(localVideo, 1)
      var data = frame.toDataURL(type);
      data = data.replace('data:' + type + ';base64,', '');
      socket.emit('image', data);
    }, 10000 / FPS);

    // const image_id = document.getElementById('image');
    // const canvas_im = document.getElementById('processed_image');
    // After recieving response from socket, add track to pc1
    socket.on('response_back', function (image) {

      // image_id.src = image;
      // var ctx = canvas_im.getContext('2d');
      // ctx.drawImage(image_id, 0, 0, 432, 233);

      sendChannel.send(image);
    });

    // Get the stream
    // var processedStream = canvas_im.captureStream(FPS); // 25 FPS
    // processedStream.getTracks().forEach(track => {
    //   pc1.addTrack(track, localStream)
    // })


  });
  console.log('Added local stream to pc1');

  try {
    console.log('pc1 createOffer start');
    const offer = await pc1.createOffer(offerOptions);
    await onCreateOfferSuccess(offer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
}

function onCreateSessionDescriptionError(error) {
  console.log(`Failed to create session description: ${error.toString()}`);
}

async function onCreateOfferSuccess(desc) {
  console.log(`Offer from pc1\n${desc.sdp}`);
  console.log('pc1 setLocalDescription start');
  try {
    await pc1.setLocalDescription(desc);
    onSetLocalSuccess(pc1);
  } catch (e) {
    onSetSessionDescriptionError();
  }

  console.log('pc2 setRemoteDescription start');
  try {
    await pc2.setRemoteDescription(desc);
    onSetRemoteSuccess(pc2);
  } catch (e) {
    onSetSessionDescriptionError();
  }

  console.log('pc2 createAnswer start');
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  try {
    const answer = await pc2.createAnswer();
    await onCreateAnswerSuccess(answer);
  } catch (e) {
    onCreateSessionDescriptionError(e);
  }
}

function onSetLocalSuccess(pc) {
  console.log(`${getName(pc)} setLocalDescription complete`);
}

function onSetRemoteSuccess(pc) {
  console.log(`${getName(pc)} setRemoteDescription complete`);
}

function onSetSessionDescriptionError(error) {
  console.log(`Failed to set session description: ${error.toString()}`);
}

function gotRemoteStream(e) {
  // if (remoteVideo.srcObject !== e.streams[0]) {
  //   remoteVideo.srcObject = e.streams[0];
  //   console.log('pc2 received remote stream');
  // }
}

async function onCreateAnswerSuccess(desc) {
  console.log(`Answer from pc2:\n${desc.sdp}`);
  console.log('pc2 setLocalDescription start');
  try {
    await pc2.setLocalDescription(desc);
    onSetLocalSuccess(pc2);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }
  console.log('pc1 setRemoteDescription start');
  try {
    await pc1.setRemoteDescription(desc);
    onSetRemoteSuccess(pc1);
  } catch (e) {
    onSetSessionDescriptionError(e);
  }
}

async function onIceCandidate(pc, event) {
  try {
    await (getOtherPc(pc).addIceCandidate(event.candidate));
    onAddIceCandidateSuccess(pc);
  } catch (e) {
    onAddIceCandidateError(pc, e);
  }
  console.log(`${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
}

function onAddIceCandidateSuccess(pc) {
  console.log(`${getName(pc)} addIceCandidate success`);
}

function onAddIceCandidateError(pc, error) {
  console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
}

function onIceStateChange(pc, event) {
  if (pc) {
    console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
    console.log('ICE state change event: ', event);
  }
}

function hangup() {
  console.log('Ending call');
  sendChannel.close();
  receiveChannel.close();
  pc1.close();
  pc2.close();
  pc1 = null;
  pc2 = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
  localVideo.pause();
}

// Added 

function receiveChannelCallback(event) {
  console.log('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.onmessage = onReceiveMessageCallback;
}

function onReceiveMessageCallback(event) {
  var ctx = canvas.getContext('2d');
  // console.log('Received Message: ' + atob(event.data));

  socket.emit('keypoint', event.data);
  socket.on('final-image', function (image) {

    const FPS = 30

    setInterval(() => {
      const image_id = document.getElementById('image');
      image_id.src = image;
      ctx.drawImage(image_id, 0, 0, 280, 280);
    }, 10000 / FPS);

    // remoteVideo.srcObject = data;
    console.log('Received final image');

    // image_id.src = image;
    // ctx.drawImage(image_id, 0, 0, 280, 280);
    // setTimeout(loop, 1000 / 30); // drawing at 30fps

  });
}