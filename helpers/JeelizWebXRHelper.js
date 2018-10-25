"use strict";

/*
	Bundle some useful functions for WebXR
	argument of init() method, spec :
	* <DOMElement> DOMCanvasParent : DOM element where to append the <canvas>$
	* <int> nDetections: number of successive detections (higher -> slower but detects easier). Default: 2
    * <function> visionDoneCallback: called when the detection has been proceeded
    * <string> neuralNet: URL of the neural network JSON file
    * <boolean> isDebugRender: display the debug rendering or not
    * <float> scaleFactor: scale factor. Default: _settings.scaleFactor
*/


const JeelizWebXRHelper=(function(){
	//settings:
	const _settings={
		isIOScolorProcessing: false, //process IOS video with color. not advised
		IOSthresholdDetectFactor: {
			'basic4.json': 1,
			'basic4Light.json': 0.42 //should lower the threshold because input size of the NN (128px)
			 					     //is too high resolution compared to the ipad video buffer got (270x480px)
			 					     //so the input is blurry and the detection is bad
		},
		scaleFactor: 40
	}


	//private vars:
	const _states={
	    notLoaded : -1,
	    loading: 0,
	    idle: 1,
	    error: 2,
	    pauseDetect:3
	};
	var _state=_states.notLoaded;
	var _detectState=false;
	var _nDetections=2;
	var _scaleFactor=_settings.scaleFactor;
	var _visionDoneCallback=false;
	const _pose={
		x:0,y:0,
		yaw:0,
		scale:1
	};
	const _iOSvideoBuffer={
		isInitialized: false,
		rgba32: {
			size: {
				width: 0, height: 0
			},
			buffer: null
		}
	};
	const _detectOptions={
		cutShader: false
	};
	var _IOSthresholdDetectFactor=1;


	//private functions:
	//BEGIN MISC PRIVATE FUNCTIONS
	function get_settingsFromNeuralNet(settingKey, neuralNet, defaultValue){
		const neuralNetName=neuralNet.split('/').pop();
		if (_settings[settingKey][neuralNetName]){
			return _settings[settingKey][neuralNetName];
		} else {
			return defaultValue;
		}
	}

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

	//BEGIN THREEJS PRIVATE FUNCTIONS
	function compute_azimuthYThreeVector(threeVec){ //compute the azimuth along Y (vertical axis) of a vector
		//0-> vector is aligned on X axis
		const azimuth=angleMod(Math.atan2(threeVec.z,threeVec.x));
		return azimuth;
	}
	//END THREEJS PRIVATE FUNCTIONS

	//BEGIN WEBXR VIDEO PRIVATE FUNCTIONS
	function init_IOSvideoBuffer(width, height){
		//invert width and height otherwise image is rotated 90°
		_iOSvideoBuffer.rgba32.size.height=width, _iOSvideoBuffer.rgba32.size.width=height;
		var n=width*height*4;
		_iOSvideoBuffer.rgba32.buffer=new Uint8Array(n);
		for (var i=0;i<n;i+=4){
			_iOSvideoBuffer.rgba32.buffer[i+3]=255; //alpha (opaque)
		};
		_iOSvideoBuffer.isInitialized=true;
	}

	//convert from YCbCr colorspace to RGBA32
	//for IOS
	//cf https://en.wikipedia.org/wiki/YCbCr
	//warning : YFrame is smaller than CbCr
	function convert_YCbCr2rgba32Color(YFrame, CbCrFrame, outFrame){ //for IOS
		const outHeight=outFrame.size.width,
			outWidth=outFrame.size.height;

		var outX, outY, p, cb, cr, y, u, v, cg, outN, lum, lumX, lumY;
		for (outY=0; outY<outHeight; ++outY){
			for (outX=0; outX<outWidth; ++outX){

				//compute the RGBA32 of outFrame buffer (outX, outY):
				//get the lum value:
				lumX=Math.round(outX*YFrame.size.width/outWidth);
				lumY=Math.round(outY*YFrame.size.height/outHeight);
				lum=YFrame.buffer[lumY*YFrame.size.bytesPerRow + lumX*YFrame.size.bytesPerPixel];
				//lum=0.5;

				//inspired from worker.js in Mozilla webxr-polyfill demos simplecv:
				// https://github.com/mozilla/webxr-polyfill/blob/master/examples/simplecv/worker.js
				// look at colorAtCenterLUV() function
				//p = outY * CbCrFrame.size.bytesPerRow + outX;
				p = outY*CbCrFrame.size.bytesPerRow + outX*CbCrFrame.size.bytesPerPixel ;
				cb = CbCrFrame.buffer[p++];
		    	cr = CbCrFrame.buffer[p];

		    	// luv -> rgb.  see https://www.fourcc.org/fccyvrgb.php
			    y=1.1643*(lum-16);
			    u=cb-128;
			    v=cr-128;
			    cr=clamp(y+1.5958*v,            0, 255);
			    cg=clamp(y-0.39173*u-0.81290*v, 0, 255);
			    cb=clamp(y+2.017*u,             0, 255); 

			    //write the result:
			    //outN=4*(outX+outFrame.size.width*outY);
			    outN=4*((outHeight-1-outY)+outFrame.size.width*outX);
			    outFrame.buffer[outN]=Math.round(cr);
			    outFrame.buffer[outN+1]=Math.round(cg);
			    outFrame.buffer[outN+2]=Math.round(cb);

			} //end for outX
		} //end for outY
	}


	//same than convert_YCbCr2rgba32Color() but extracts only luminosity. faster
	function convert_YCbCr2rgba32GrayScale(YFrame, outFrame){
		const outHeight=outFrame.size.width,
			outWidth=outFrame.size.height;

		var outX, outY, outN, lum;
		for (outY=0; outY<outHeight; ++outY){
			for (outX=0; outX<outWidth; ++outX){

				//get the lum value:
				lum=YFrame.buffer[outY*YFrame.size.bytesPerRow + outX*YFrame.size.bytesPerPixel];

			    //write the result:
			    outN=4*((outHeight-1-outY)+outFrame.size.width*outX);
			    outFrame.buffer[outN]=Math.round(lum); //we use IOS cutShader, which requires only red channel

			} //end for outX
		} //end for outY
	}
	//END WEBXR VIDEO PRIVATE FUNCTIONS

	//public functions:
	const that={
		init: function(spec){ //initialization
			if (_state!==_states.notLoaded){
				console.log('ERROR in JeelizWebXRHelper: cannot initialize multiple times. Abort');
				return;
			}
			_state=_states.loading;

			var jeelizCanvas = document.createElement('canvas');
			if (spec.DOMCanvasParent){
				spec.DOMCanvasParent.appendChild(jeelizCanvas);
				jeelizCanvas.className='jeelizCanvas';
			}

			if (spec.nDetections){
				_nDetections=spec.nDetections;
			}
			if (spec.visionDoneCallback){
				_visionDoneCallback=spec.visionDoneCallback;
			}
			if (spec.scaleFactor){
				_scaleFactor=spec.scaleFactor;
			}

			_IOSthresholdDetectFactor=get_settingsFromNeuralNet('IOSthresholdDetectFactor', spec.neuralNet, 1);

			console.log('INFO in JeelizWebXRHelper.js : init JEEARAPI...');
			JEEARAPI.init({
                //video: _DOMvideo,
                canvas: jeelizCanvas,
                isDebugRender: spec.isDebugRender,
                callbackReady: function(errLabel){
                	//DebugUtils.log_domConsole('INFO in JeelizWebXRHelper.js: JEEARAPI callbackReady launched with errLabel='+errLabel.toString());
                    if (errLabel){
                        _state=_states.error;
                        console.log('ERROR in JeelizWebXRHelper.js - cannot init JEEAR : ', errLabel);
                    } else {
                    	that.load_neuralNet(spec.neuralNet);
                    }
                }
                //,canvasId: 'debugCanvas'
            });
		}, //end init()

		load_neuralNet: function(NNurl){
			if (_state===_states.error){
				return;
			}
			_state=_states.loading;
			JEEARAPI.set_NN(NNurl, function(errLabel){
				if (errLabel){
					console.log('INFO in JeelizWebXRHelper.js: cannot load neural net ', NNurl);
				} else {
					console.log('INFO in JeelizWebXRHelper.js: ready for detection :)');
                	_state=_states.idle;
                }
            });
		},

		videoWorker: function(event){
			if (_state===_states.error){
				return;
			}
			if (!event || !event.type){
				console.log('WARNING in JeelizWebXRHelper: INVALID EVENT. event =', event);
			}
			if (_state===_states.pauseDetect){
				if (_visionDoneCallback){
					_visionDoneCallback(false);
				}
				return;
			}
			switch(event.type){
				case 'videoFrame':
					//get videoFrame and its buffer
					const videoFrame=event.detail;
					const videoFrameBuffer0=videoFrame.buffer(0);
					let videoFrameBufferRGBA32;

					// The video frames will come in different formats on different platforms.  
			        // The call to videoFrame.buffer(i) retrieves the i-th plane for the frame;  
			        // (in the case of the WebXR Viewer, it also converts the base64 encoded message
			        // into an ArrayBuffer, which we don't do until the plane is used)
			        //DebugUtils.log_domConsoleOnce('videoFrame.pixelFormat: '+videoFrame.pixelFormat);  
					switch(videoFrame.pixelFormat){
						// the WebXR Viewer uses iOS native YCbCr, which is two buffers, one for Y and one for CbCr
        				case XRVideoFrame.IMAGEFORMAT_YUV420P:

        					if (_settings.isIOScolorProcessing){
	        					const videoFrameBufferCbCr=videoFrame.buffer(1);
	        					const width=videoFrameBufferCbCr.size.width, height=videoFrameBufferCbCr.size.height;
	        					if(!_iOSvideoBuffer.isInitialized){
	        						init_IOSvideoBuffer(width, height);
	        						_detectOptions.thresholdDetectFactor=_IOSthresholdDetectFactor;
	        					}

	        					//color detection:
	        					convert_YCbCr2rgba32Color(videoFrameBuffer0, videoFrameBufferCbCr, _iOSvideoBuffer.rgba32);
        					} else { //if Grayscale processing. We don't give a fuck of CbCr buffer:
        						const width=videoFrameBuffer0.size.width, height=videoFrameBuffer0.size.height;
        						if(!_iOSvideoBuffer.isInitialized){
	        						init_IOSvideoBuffer(width, height);
	        						_detectOptions.cutShader='IOS';
	        						_detectOptions.thresholdDetectFactor=_IOSthresholdDetectFactor;
	        					}

        						//grayscale detection:
	        					convert_YCbCr2rgba32GrayScale(videoFrameBuffer0, _iOSvideoBuffer.rgba32);
        					}

        					videoFrameBufferRGBA32=_iOSvideoBuffer.rgba32;
        					break;

        				// WebRTC uses web-standard RGBA
						case XRVideoFrame.IMAGEFORMAT_RGBA32:
							videoFrameBufferRGBA32=videoFrameBuffer0;
							break;
					}
                	_detectState=JEEARAPI.detect(_nDetections, videoFrameBufferRGBA32, _detectOptions);

                	// utility function to send the video frame and additional parameters back.
			        // Want to use this so we pass ArrayBuffers back and forth to avoid having to 
			        // reallocate them every frame.
			        videoFrame.release();
			        if (_visionDoneCallback){
			        	_visionDoneCallback(_detectState);
			        }
					break;

				default:
					console.log('WARNING in JeelizWebXRHelper: unknow event type received ', event.type);
					break;
			} //end switch event.type
		}, //end videoWorker()

		extract_lookUpDownAngleFromCamera: function(threeCamera){ //0 -> camera looks horizontally, PI/2 -> vertically (down)
			const threeCameraWorldMatrix=threeCamera.matrixWorld;
			const threeCameraEuler=new THREE.Euler(0,0,0,'ZYX');
			threeCameraEuler.setFromRotationMatrix(threeCameraWorldMatrix);
			//threeCameraEuler.x=   PI->hzt,  3PI/2->looking down
			//        or            0->hzt    PI/2->down    
			// so PI should be equivalent to 0
			var cameraEulerX=angleMod(threeCameraEuler.x); 
			if (cameraEulerX>Math.PI/2) cameraEulerX-=Math.PI;
			return Math.abs(cameraEulerX);//Math.PI-threeCameraEuler.x;
		},

		extract_lookUpDownAngleFromVector: function(threeVector){//0 -> vector is horizontally, PI/2 -> point to down
			const eulerX=angleMod(Math.acos(threeVector.y)-Math.PI/2.0); 
			return eulerX;
		},

		switch_detect: function(isDetect){
			if (_state===_states.idle && !isDetect){
				_state=_states.pauseDetect;
			} else if (_state===_states.pauseDetect && isDetect){
				_state=_states.idle;
			}
		},

		//compute the position X,Y in screen normalized coordinates of the center of the object
		//it will be used by WebXR later for the hitest
		compute_pose: function(detectState, threeCamera){
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

			const lookUpDownAngle=that.extract_lookUpDownAngleFromVector(threeViewPortCenterObj); //0 -> camera looks horizontally, PI/2 -> vertically
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

			return _pose;
		},

		update_pose: function(threeMatrixAnchoredWorld, threeCamera, pose){
			//compute scale: if anchorOffset is far from the camera, the object is bigger
			//cf https://en.wikipedia.org/wiki/Angular_diameter for formulas
			var threePositionAnchoredWorld=new THREE.Vector3().setFromMatrixPosition(threeMatrixAnchoredWorld);
			var threePositionCameraWorld=threeCamera.getWorldPosition();
			var distance=threePositionAnchoredWorld.distanceTo(threePositionCameraWorld);
			
			pose.scale=_scaleFactor*_pose.learningDistance //constant for a given object 
					   *distance*Math.tan(_pose.angularDiameter/2.0); //sin -> for sphere. tan -> for plane object

			//update yaw: pose.yaw is currently the yaw between object and camera
			//but it should be the yaw between object and anchor
			var threeEulerAnchoredWorld=new THREE.Euler(0,0,0,'XYZ').setFromRotationMatrix(threeMatrixAnchoredWorld);
			var anchoredWorldAzimythY=angleMod(threeEulerAnchoredWorld.y);
			//unit vector from camera to anchored, in world coords
			var threeVectorCameraAnchored=threePositionAnchoredWorld.clone().sub(threePositionCameraWorld);
			var cameraAnchoredAzimuthY=compute_azimuthYThreeVector(threeVectorCameraAnchored);


			//DebugUtils.log_domConsole('anchoredWorldAzimythY=',anchoredWorldAzimythY,'cameraAnchoredAzimuthY=',cameraAnchoredAzimuthY, 'pose.yaw=',pose.yaw);
			//put yaw in the world ref:
			pose.yaw=pose.yaw-cameraAnchoredAzimuthY;

			//put yaw in the anchor ref:
			pose.yaw+=anchoredWorldAzimythY;
		},

		check_size: function(pose, diameterRange){
			return (pose.scale>diameterRange[0] && pose.scale<diameterRange[1]);
		}

	}; //end that
	return that;
})();
