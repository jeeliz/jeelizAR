/*
Helper to use Jeeliz AR with 8th Wall web SDK
This helper should help to not overload index.js

spec:
  <func> callbackReady(<string|False> errorCode)
  <func> callbackDetect(<dict> detectState)
  <string> neuralNet: path of the neural net
  <int> nDetectionPerLoop: number of detections per loop. Default: 3
  <int> animateDelay: number of ms between 2 detection iterations to avoid lags. Default: 1ms
  <float> scaleFactor: scale factor. Default: 1

*/
"use strict";

const JeelizAR8thWallHelper=(function(){
	//private vars:
	let _domVideo, _domCanvas, _domXRCanvas, _animateDelay, _nDetectionPerLoop, _callbackDetect=false;
	let _scaleFactor=1.0;
	let _isPause=false;
	const _timers={
		timeout: false,
		animationFrame: false
	};
	const _pose={
		x:0,y:0,
		xVp:0, yVp:0, //x and y in the viewport
		yaw:0,
		scale:1
	};
	const _detectOptions={
		cutShader: false,
		thresholdDetectFactor: 0.6
	};


	//private funcs

	//BEGIN MATHS PRIVATE FUNCTIONS
	function clamp(x, min, max) { //analogous to clamp() GLSL func
		return Math.min(Math.max(x, min), max);
	}

	function angleMod(a){ //bring back an angle into ]-PI, PI]
		while(a<=-Math.PI) a+=2.0*Math.PI;
		while(a>Math.PI) a-=2.0*Math.PI;
		return a;
	}
	//END MATHS PRIVATE FUNCTIONS

	//BEGIN INIT FUNCS
	function load_neuralNet(NNurl, callbackReady){
		JEEARAPI.set_NN(NNurl, function(errCode){
		    if (errCode){
		    	callbackReady(errCode);
		    	return;
		    } else {
		    	callbackReady(false);
		      	iterate();
		    }
		});
	}

	function compute_videoCropping(){
		//get dims:
		const vw=_domVideo.videoWidth, vh=_domVideo.videoHeight, cw=_domXRCanvas.width, ch=_domXRCanvas.height;

		//compute aspec ratios:
		const aspectRatioVideo=vw/vh, aspectRatioXRCanvas=cw/ch;

		//init as no cropping;
		var cropX=0, cropY=0, cropW=_domVideo.videoWidth, cropH=_domVideo.videoHeight;

		if (aspectRatioXRCanvas>=aspectRatioVideo){
			//the final rendering is more lanscape than the original video
			//=> we sould crop top and bottom margins

			cropH=vw/aspectRatioXRCanvas; //height of the canvas if it had the same width than the video
			cropY=(vh-cropH)/2;
		} else {
			//we should crop left and right margins

			cropW=vh*aspectRatioXRCanvas; //width of the canvas if it had the same 
			cropX=(vw-cropW)/2;
		}

		const cropArea={
			x: cropX,
			y: cropY,
			w: cropW,
			h: cropH
		};

		console.log('INFO in JeelizAR8thWallHelper() - compute_videoCropping(): cropArea=', cropArea);
		return cropArea;
	}
	//END INIT FUNCS

	//BEGIN SEARCHING LOOP MANAGEMENT
	function clear_timers(){
		if (_timers.timeout!==false){
			clearTimeout(_timers.timeout);
			_timers.timeout=false;
		}
		if (_timers.animationFrame!==false){
			window.cancelAnimationFrame(_timers.animationFrame);
			_timers.animationFrame=false;
		}
	}

	function tick_iterate(){
		if (_isPause){
			return;
		}
		_timers.timeout=setTimeout(iterate, _animateDelay);
	}

	function iterate(){
		if (_isPause){
			return;
		}
	  	const detectState = JEEARAPI.detect(_nDetectionPerLoop, false, _detectOptions);
	  	if (detectState.label){
	    	console.log('INFO in JeelizAR8thWallHelper: ',detectState.label,' IS DETECTED YEAH !!!');
	    	if (_callbackDetect){
	    		_callbackDetect(detectState);
	    	}
	  	}
	  	_timers.animationFrame=window.requestAnimationFrame(tick_iterate);
	}
	//END SEARCHING LOOP MANAGEMENT

	
	//BEGIN COPIED FROM JEELIZWEBXRHELPER

	function extract_lookUpDownAngleFromVector(threeVector){//0 -> vector is horizontally, PI/2 -> point to down
		const eulerX=angleMod(Math.acos(threeVector.y)-Math.PI/2.0); 
		return eulerX;
	}

	function compute_azimuthYThreeVector(threeVec){ //compute the azimuth along Y (vertical axis) of a vector
		//0-> vector is aligned on X axis
		const azimuth=angleMod(Math.atan2(threeVec.z,threeVec.x));
		return azimuth;
	}

	//compute the position X,Y in screen normalized coordinates of the center of the object
	//it will be used by WebXR later for the hitest
	function compute_pose(detectState, threeCamera){
		//the detectState.positionScale is the frame around the object in 2D
		//its center match to the center of the object
		//(the object is centered by ARcase0Trainer using its bounding box)

		//we want the center to match to the bottom of the object along Y (vertical axis)
		//and the center along X and Z axis (horizontal axis)

		//recover camera parameters:
		//cf (common.js), THREE.JS camera parameters are overwritten because projection Matrix is updated without using them
		//so recover params from the matrix
		const cameraMatrixElements=threeCamera.projectionMatrix.elements;
		const projXfactor=threeCamera.projectionMatrix.elements[0], projYfactor=threeCamera.projectionMatrix.elements[5];
		const cameraFov=2*Math.atan(1/projXfactor);
		const cameraAspect=projYfactor/projXfactor;

		//Transform the detection.positionScale from the video coordinates to screen coordinates:
		//(the video is a bit cropped to fit fullscreen. top/bottom or left/right margins are crop equally)
		let x=detectState.positionScale[0];
		let y=detectState.positionScale[1];
		let sx=detectState.positionScale[2];
		let sy=detectState.positionScale[3];
		const detectCameraAspect=JEEARAPI.get_aspectRatio();
		if (detectCameraAspect>cameraAspect){ //detectCamera is more lanscape than 3D scene camera -> right and left margins are cropped
			const aspectRatiosRatio=detectCameraAspect/cameraAspect;
			x=aspectRatiosRatio*(x-0.5)+0.5;
			sx*=aspectRatiosRatio;
		} else { //detectCamera is less landscape -> top and bottom margins are cropped (Ipad)
			const aspectRatiosRatio=cameraAspect/detectCameraAspect; //=1.33 for ipad
			y=aspectRatiosRatio*(y-0.5)+0.5;
			sy*=aspectRatiosRatio;
			//DebugUtils.log_domConsole('Crop top and bottom margins. aspectRatiosRatio=',aspectRatiosRatio);
		}
		//DebugUtils.log_domConsole('x=',x,'y=',y,'sx=',sx,'sy=',sy);

		//Compute the vector launched from (x,y):
		//compute x and y in the viewport:
		const threeViewPortCenterObj=new THREE.Vector3(x*2.0-1.0, y*2.0-1.0,-1.0);
		threeViewPortCenterObj.unproject(threeCamera);
		threeViewPortCenterObj.sub(threeCamera.getWorldPosition());
		threeViewPortCenterObj.normalize();

		const lookUpDownAngle=extract_lookUpDownAngleFromVector(threeViewPortCenterObj); //0 -> camera looks horizontally, PI/2 -> vertically
		const driftY=(sy/3)*Math.abs(Math.cos(lookUpDownAngle));
		_pose.x=x;
		_pose.y=y-driftY;
		_pose.y=1.0-_pose.y; //invert along Y axis. Y should be given from top to bottom (HTML way)
		//DebugUtils.log_domConsole('lookUpDownAngle=', lookUpDownAngle,'driftY=',driftY,'threeViewPortCenterObj=',threeViewPortCenterObj.toArray().toString());
		
		//compute scale precursors:
		const fovRadVt=cameraFov*Math.PI/180; //vertical field of view in radians
		const fovRadHt=fovRadVt*cameraAspect; //aspect is width/height
		_pose.learningDistance=detectState.distance; //detectState.distance is the learning distance
		_pose.angularDiameter=sx*fovRadHt; //in radians 
		
		//copy yaw:
		_pose.yaw=detectState.yaw;

		//compute x and y in the viewport (between -1 and 1);
		_pose.xVp=_pose.x*2.0 - 1.0;
		_pose.yVp=-(_pose.y*2.0 - 1.0);

		return _pose;
	} //end compute_pose()

	function update_pose(threePositionAnchoredWorld, threeCamera, pose){
		//compute scale: if anchorOffset is far from the camera, the object is bigger
		//cf https://en.wikipedia.org/wiki/Angular_diameter for formulas
		//var threePositionAnchoredWorld=new THREE.Vector3().setFromMatrixPosition(threeMatrixAnchoredWorld);
		const threePositionCameraWorld=threeCamera.getWorldPosition();
		const distance=threePositionAnchoredWorld.distanceTo(threePositionCameraWorld);
		
		pose.scale=_scaleFactor*_pose.learningDistance //constant for a given object 
				   *distance*Math.tan(_pose.angularDiameter/2.0); //sin -> for sphere. tan -> for plane object

		//update yaw: pose.yaw is currently the yaw between object and camera
		//but it should be the yaw between object and anchor
		const threeEulerAnchoredWorld=new THREE.Euler(0,0,0,'XYZ');//.setFromRotationMatrix(threeMatrixAnchoredWorld);
		const anchoredWorldAzimythY=angleMod(threeEulerAnchoredWorld.y);
		//unit vector from camera to anchored, in world coords
		const threeVectorCameraAnchored=threePositionAnchoredWorld.clone().sub(threePositionCameraWorld);
		const cameraAnchoredAzimuthY=compute_azimuthYThreeVector(threeVectorCameraAnchored);


		//DebugUtils.log_domConsole('anchoredWorldAzimythY=',anchoredWorldAzimythY,'cameraAnchoredAzimuthY=',cameraAnchoredAzimuthY, 'pose.yaw=',pose.yaw);
		//put yaw in the world ref:
		pose.yaw=pose.yaw-cameraAnchoredAzimuthY;

		//put yaw in the anchor ref:
		pose.yaw+=anchoredWorldAzimythY;
	} //end update_pose()

	//END COMPIED FROM JEELIZWEBXRHELPER


	//public methods:
	const that={
		init: function(spec){
			_domVideo=document.getElementsByTagName('video')[0];
			if (!_domVideo){
				spec.callbackReady('VIDEO_NOTFOUND');
				return;
			}

			_domXRCanvas=document.getElementById('xrweb');
			if (!_domXRCanvas){
				spec.callbackReady('XRCANVAS_NOTFOUND');
				return;
			}

			_domCanvas=document.createElement('canvas');
			_domCanvas.width=512;
			_domCanvas.height=512;

			if (!JEEARAPI){
				spec.callbackReady('JEEARAPI_NOTFOUND');
				return;
			}

			if (spec.callbackDetect){
				_callbackDetect=spec.callbackDetect;
			}
			if (spec.scaleFactor){
				_scaleFactor=spec.scaleFactor;
			}

			_nDetectionPerLoop=(spec.nDetectionPerLoop)?spec.nDetectionPerLoop:3;
			_animateDelay=(spec.animateDelay)?1:spec.animateDelay;

			JEEARAPI.init({
			    canvas: _domCanvas,
			    video: _domVideo,
			    videoCrop: compute_videoCropping(),
			    callbackReady: function(errCode){
			      if (errCode){
			        spec.callbackReady(errCode);
			        return;
			      } else {
			        load_neuralNet(spec.neuralNet, spec.callbackReady);
			      }
			    }
			});

		}, //end init()

		pause: function(){
			_isPause=true;
			clear_timers();
		},

		play: function(){
			clear_timers();
			_isPause=false;
			iterate();
		},

		check_size: function(pose, diameterRange){
			return (pose.scale>diameterRange[0] && pose.scale<diameterRange[1]);
		},

		compute_pose: compute_pose,
		update_pose: update_pose,

		//compute the intersection point between a ray from the [pose.xVp, pose.yVp] point
		//and the plane y = 0
		//pose.xVp, pose.yVP are in viewport coordinates (between 0 and 2)
		compute_hitPoint: function(pose, threeCamera){
			const threeRay=new THREE.Vector3(pose.xVp, pose.yVp, 0.0);
			threeRay.unproject(threeCamera); //--> directly in world coordinates. gives the position in world co of a 3D points matching the threeRay
			
			//get the unit direction vector in world co:
			const threeCameraWorldPos=threeCamera.getWorldPosition();
			threeRay.sub(threeCameraWorldPos);
			threeRay.normalize();

			//compute the intersection point I between the ray (threeCameraWorldPos, threeRay) and the plane Y=0:
			//we have: I = threeCameraWorldPos + k * threeRay
			//projected on Y: 0 = threeCameraWorldPos.y + k * threeRay.y => k = -threeCameraWorldPos.y/threeRay.y
			const k=-threeCameraWorldPos.y/threeRay.y;
			
			const threeHitPoint=threeRay.clone().multiplyScalar(k).add(threeCameraWorldPos);



			//console.log(threeHitPoint); debugger;

			//TODO
			return threeHitPoint;
		}
	} //end that
	return that;
})() 
