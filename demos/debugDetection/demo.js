"use strict";

//global vars :
var DOMVIDEO;

function main(){ //entry point
	DOMVIDEO=JeelizMediaStreamAPIHelper.get_videoElement();
	//document.body.appendChild(DOMVIDEO);
	JeelizMediaStreamAPIHelper.get(DOMVIDEO, init, function(){
		alert('Cannot get video bro :(');
	}, {
		"video": true,/*
			"width": {"min": VIDEOSETTINGS.minWidth, "max": VIDEOSETTINGS.maxWidth, "ideal": VIDEOSETTINGS.idealWidth},
			"height": {"min": VIDEOSETTINGS.minHeight, "max": VIDEOSETTINGS.maxHeight, "ideal": VIDEOSETTINGS.idealHeight}
		},*/
		"audio": false
	})
}

function init(){
	JEEARAPI.init({
		canvasId: 'debugJeeARCanvas',
		video: DOMVIDEO,
		callbackReady: function(errLabel){
			if (errLabel){
				alert('An error happens bro: ',errLabel);
			} else {
				load_neuralNet();
			}
		}
	});
}

function load_neuralNet(){
	JEEARAPI.set_NN('../../neuralNets/basic4.json', function(errLabel){
		if (errLabel){
			console.log('ERROR : cannot load the neural net', errLabel);
		} else {
			start();
		}
	});
}

function start(){
	console.log('INFO in demo.js : start()');

	//scale the canvas with CSS to have the same aspectRatio than the video :
	var sx=1, sy=1;
	var aspectRatioVideo=DOMVIDEO.videoWidth/DOMVIDEO.videoHeight;
	if (aspectRatioVideo>1){ //landscape
		sy=1/aspectRatioVideo;
	} else { //portrait
		sx=aspectRatioVideo;
	}
	var domCanvas=document.getElementById('debugJeeARCanvas');
    domCanvas.style.transformOrigin='50% 0%';
	domCanvas.style.transform='scale('+sx.toFixed(2)+','+sy.toFixed(2)+') translate(-50%, -50%) rotateY(180deg)';

	//launch drawing and detection loop :
	iterate();
}

function iterate(){ //detect loop
	var detectState = JEEARAPI.detect(3);
	if (detectState.label){
		console.log('INFO in demo.js : ', detectState.label, 'IS CONFIRMED YEAH !!!');
	}
	window.requestAnimationFrame(iterate);
}