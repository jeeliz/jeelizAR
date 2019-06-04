"use strict";

/*
Usage: JeelizCat.init(<dict> spec) with spec having these properties:
  - onSuccess: success callback
  - videoContainerId: id of the container of the video and the canvas

*/

const JeelizCat=(function(){
	//settings:
	const _settings={
		neuralNet: '../../neuralNets/cat.json',
		
		thresholdDetectFactor: 0.7,//0.76,
		nDetectionsPerLoop: 3,
		animateDelay: 1, //in ms
		scan: {
			margins: 0.2,//0.05, // 0-> no margin, 1-> 100% margins
			nSweepXYsteps: 10*6, //number of X,Y steps,
			nSweepSsteps: 2, //number of scale steps. total number of sweep steps = nSweepXYsteps * nSweepSsteps
			sweepScaleRange: [0.2, 0.3],//[0.2, 0.6], //range of the detection window scale. 1-> whole window minDim (do not take account of margins)
			sweepStepMinPx: 2, //minimum size of a step in pixels
			sweepShuffle: false //true,
		},
		trackingFactors: [2.0,2.0,1.0],
		thresholdDetectFactorUnstitch: 0.72,
		shrinkMarkerFactor: 0.7,

		canvasResizeFactor: 0.5, //if 1.0, the detection canvas has same dimentions than the video. 0.5 -> half dims

		isDebug: false
	}


	//private vars:
	let _domVideo, _domCanvas, _domContainer, _domMarker;
	let _nVideoStartTrials=0;
	const _states={ //ENUM like
		notLoaded: -1,
		loading: 0,
		run: 1,
		paused: 2,
		error: -2
	};
	let _state=_states.notLoaded;
	let _videoAspectRatio=1.0;
	let _animateTimeout=null, _animateAnimationFrame=null;
	let _onSuccess;
	const _detectOptions={
		thresholdDetectFactor: _settings.thresholdDetectFactor,
		isSkipConfirmation: true,
		isKeepTracking: true,
		trackingFactors: _settings.trackingFactors,
		thresholdDetectFactorUnstitch: _settings.thresholdDetectFactorUnstitch
	};


	//private functions:

	function check_isMobile(){
    var check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator['userAgent']||navigator['vendor']||window['opera']);
    return check;
  }

	//BEGIN DOM_HELPERS
	function add_videoSource(src){
		const extension=src.split('.').pop().toLowerCase();
		const sourceType='video/'+extension;
		const domSource=document.createElement('source');
		domSource.setAttribute('src', src);
		domSource.setAttribute('type', sourceType);
		_domVideo.appendChild(domSource);
	}

	function create_domDisplay(domType, className){
		const domDisplay=document.createElement(domType);
		if (className){
			domDisplay.setAttribute('class', className);
		}
		return domDisplay;
	}
	//END DOM_HELPERS

	//BEGIN LOADING FUNCTIONS
	function init_AR(){
		JEEARAPI.init({
			canvas: _domCanvas,
			video: _domVideo,
			canvasSize: -1,
			callbackReady: function(errLabel){
				if (errLabel){
					on_error('init_AR() - '+errLabel);
				} else {
					load_neuralNet();
				}
			},
			isDebugRender: _settings.isDebug,
			scanSettings: _settings.scan
		});
	} //end init_AR()


	function load_neuralNet(){
		console.log('INFO in JeelizAR.js : load_neuralNet()');
		JEEARAPI.set_NN(_settings.neuralNet, function(errLabel){
			if (errLabel){
				on_error('load_neuralNet() - '+errLabel);
			} else {
				start();
			}
		});
	}

	function start(){
		_state=_states.run;
		document.addEventListener("scroll", on_scroll);

		if (_onSuccess){
			_onSuccess();
		}
		console.log('INFO in JeelizAR.js : start()');

		//append marker:
		_domMarker=document.createElement('div');
		_domMarker.setAttribute('class', 'JeelizCatMarker');
		_domContainer.appendChild(_domMarker);
		_domContainer.style.opacity='1';

		//start video:
		_domVideo.play();
		_domVideo.addEventListener('canplay', function(){
			_domVideo.play();
		}); //*/

		//launch drawing and detection loop :
		tick_iterate();
	}

	function on_error(msg){
		if (_state===_states.error){
			return;
		}
		console.log('ERROR in JeelizCat: ', msg);

		if (_domVideo && _domVideo.parentElement){
			_domVideo.pause();
			_domContainer.removeChild(_domVideo);
		}
		if (_domCanvas && _domCanvas.parentElement){
			_domContainer.removeChild(_domCanvas);
		}
		if (_domContainer && _domContainer.parentElement){
			_domContainer.parentElement.removeChild(_domContainer);
		}
		
		_state=_states.error;
	}


	function on_videoReady(){
		if (!_domVideo.videoWidth || !_domVideo.videoHeight){
			console.log('WARNING in JeelizCat: the video is not ready. ');
			if (++_nVideoStartTrials===5){
				on_error('cannot load video');
				return;
			}
			setTimeout(on_videoReady, 100);
		}
		console.log('INFO in JeelizCat: the video is ready :)');

		_videoAspectRatio=_domVideo.videoWidth/_domVideo.videoHeight;

		//build the <canvas> element:
		_domCanvas=create_domDisplay('canvas', false);
		_domCanvas.width=_settings.canvasResizeFactor*_domVideo.videoWidth;
		_domCanvas.height=_settings.canvasResizeFactor*_domVideo.videoHeight;

		if (_settings.isDebug){
			document.body.appendChild(_domCanvas);
		}

		init_AR();
	}

	function on_videoEnd(){
		console.log('INFO in JeelizCat: video ended, restart it');
		_domVideo.play();
		JEEARAPI.reset_state();
	}

	//END LOADING FUNCTION



	//BEGIN LOGIC
	function tick_iterate(){
		if (_state!==_states.run){
			return;
		}
		_animateTimeout=setTimeout(iterate, _settings.animateDelay);
	}
	function iterate(){ //detect loop
		if (_state!==_states.run){
			return;
		}

		const detectState = JEEARAPI.detect(_settings.nDetectionsPerLoop, null, _detectOptions);
		if (detectState.label === 'CAT'){
			//console.log('INFO in JeelizAR.js : ', detectState.label, 'IS CONFIRMED YEAH !!!');
			//const winWidth=window.innerWidth;
			const winWidth = _domContainer.getBoundingClientRect().width;
			const w = _settings.shrinkMarkerFactor*detectState.positionScale[2]*winWidth;
			const wPx = Math.round(w).toString()+'px';
			_domMarker.style.left = Math.round(detectState.positionScale[0]*winWidth-w/2.0).toString()+'px';
			_domMarker.style.top = Math.round((1.0-detectState.positionScale[1])*winWidth/_videoAspectRatio-w/2.0).toString()+'px';
			_domMarker.style.width = wPx;
			_domMarker.style.height = wPx;
			_domMarker.style.display = 'block';
		} else {
			_domMarker.style.display = 'none';
		}
		_animateAnimationFrame = window.requestAnimationFrame(tick_iterate);
	}

	function pause(){
		if (_state!==_states.run){
			return;
		}
		_domVideo.pause();
		_state = _states.paused;
		if (_animateAnimationFrame !== null){
			window.cancelAnimationFrame(_animateAnimationFrame);
			_animateAnimationFrame = null;
		}
		if (_animateTimeout){
			clearTimeout(_animateTimeout);
			_animateTimeout = null;
		}
	}

	function wake(){
		if (_state !== _states.paused){
			return;
		}
		_state = _states.run;
		_domVideo.play();
		tick_iterate();
	}
	//END LOGIC



	//BEGIN EVENT HANDLERS
	function on_scroll(event){
		const shouldPause = (document.documentElement.scrollTop>window.innerHeight/2);
		if (shouldPause && _state === _states.run){
			pause();
		} else if (!shouldPause && _state===_states.paused){
			wake();
		}
	}
	//END EVENT HANDLERS



	//public functions:
	const that = {
		init: function(spec){
			if (_state !== _states.notLoaded){
				console.log('WARNING in JeelizCat: main() should be called once');
				return;
			}

			if (check_isMobile() || screen.availWidth<1260){
				console.log('WARNING in JeelizCat: mobile detected, abort');
				//return;
			}
			_state = _states.loading;
			_onSuccess = spec.onSuccess;


			//build the <video> element
			_domVideo = create_domDisplay('video', 'JeelizCatDisplay');
			_domVideo.loop = true;
			_domVideo.setAttribute('poster', 'videos/poster.jpg');
			_domVideo.setAttribute('muted', 'muted');
			_domVideo.muted = true;

			add_videoSource('videos/cat.webm');
			add_videoSource('videos/cat.mp4');
			_domVideo.addEventListener('playing', on_videoEnd);
			
			//append the video to the container
			//otherwide it won't play with shitty browsers like safari
			_domContainer = document.getElementById(spec.videoContainerId);
			_domContainer.appendChild(_domVideo);

			_domVideo.addEventListener('loadeddata', on_videoReady, false);
		}
	}; //end that

	return that;
})();