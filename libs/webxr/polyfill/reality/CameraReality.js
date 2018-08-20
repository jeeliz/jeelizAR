import Reality from '../Reality.js'
import XRAnchor from '../XRAnchor.js'
import XRViewPose from '../XRViewPose.js'

import XRAnchorOffset from '../XRAnchorOffset.js'
import XRLightEstimate from '../XRLightEstimate.js'

import MatrixMath from '../fill/MatrixMath.js'
import Quaternion from '../fill/Quaternion.js'

import ARKitWrapper from '../platform/ARKitWrapper.js'
import ARCoreCameraRenderer from '../platform/ARCoreCameraRenderer.js'
import XRImageAnchor from "../XRImageAnchor.js"
import XRPlaneAnchor from "../XRPlaneAnchor.js"
import XRFaceAnchor from "../XRFaceAnchor.js"

/*
CameraReality displays the forward facing camera.

If this is running in the iOS ARKit wrapper app, the camera data will be displayed in a Metal layer below the WKWebKit layer.
If this is running in the Google ARCore Chrome application, it will create a canvas element and use the ARCore provided camera data.
If there is no ARKit or ARCore available, it will use WebRTC's MediaStream to render camera data into a canvas.
*/
export default class CameraReality extends Reality {
	constructor(xr){
		super(xr, 'Camera', true, true)

		this._initialized = false
		this._running = false

		// camera fovy: start with 70 degrees on the long axis of at 320x240
		this._cameraFov = 70 * Math.PI/180
		this._focalLength = 160 / Math.tan(this._cameraFov / 2)
		/*this._cameraIntrinsics = [this._focalLength, 0 , 0,
								  0, this._focalLength,  0,
								  160, 120, 1 ]*/
		this._cameraIntrinsics = [this._focalLength, 0 , 0,
								  0, this._focalLength,  0,
								  640,480, 1 ] //JEELIZMODIF

		// These are used if we have access to ARKit
		this._arKitWrapper = null

		// These are used if we do not have access to ARKit
		this._mediaStream = null
		this._videoEl = null

		// These are used if we're using the Google ARCore web app
		this._arCoreCameraRenderer = null
		this._arCoreCanvas = null
		this._elContext = null
		this._vrDisplay = null
		this._vrFrameData = null

		// dealing with video frames from webrtc
		this._sendingVideo = false;
		this._videoFramesPaused = false;
		this._sendVideoFrame = false;
		this._videoProjectionMatrix = MatrixMath.mat4_generateIdentity();
		this._videoViewMatrix = MatrixMath.mat4_generateIdentity();

		this._lightEstimate = new XRLightEstimate();

		// Try to find a WebVR 1.1 display that supports Google's ARCore extensions
		if(typeof navigator.getVRDisplays === 'function'){
			navigator.getVRDisplays().then(displays => {
				for(let display of displays){
					if(display === null) continue
					if(display.capabilities.hasPassThroughCamera){ // This is the ARCore extension to WebVR 1.1
						this._vrDisplay = display
						this._vrFrameData = new VRFrameData()
						if (!window.WebARonARKitSetData) {
							this._arCoreCanvas = document.createElement('canvas')
							this._xr._realityEls.appendChild(this._arCoreCanvas)
							this._arCoreCanvas.width = window.innerWidth
							this._arCoreCanvas.height = window.innerHeight
							this._elContext = this._arCoreCanvas.getContext('webgl')
							if(this._elContext === null){
								throw 'Could not create CameraReality GL context'
							}
						}
						break
					}
				}
			})
		}

		window.addEventListener('resize', () => {
			if(this._arCoreCanvas){
				this._arCoreCanvas.width = window.innerWidth
				this._arCoreCanvas.height = window.innerHeight
			}
			if (this._videoEl) {
				setTimeout(() => {
					this._adjustVideoSize();
				}, 10)
			}
		}, false)
	}

	_setFovy (fovy) {
		this._cameraFov = fovy * Math.PI/180
		if (!this._videoEl) {
			this._focalLength = 0
			return 
		}

		if (this._videoRenderWidth > this._videoRenderHeight) {
			this._focalLength = (this._videoRenderWidth/2) / Math.tan(this._cameraFov / 2)
		} else {
			this._focalLength = (this._videoRenderHeight/2) / Math.tan(this._cameraFov / 2)
		}			
		this._cameraIntrinsics = [this._focalLength, 0 , 0,
								  0, this._focalLength,  0,
								  (this._videoRenderWidth/2), (this._videoRenderHeight/2), 1 ]
	}

	_adjustVideoSize () {
		
		var canvasWidth  = this._videoRenderWidth;
		var canvasHeight = this._videoRenderHeight;
		var cameraAspect = canvasWidth / canvasHeight;

		var width = this._videoEl.videoWidth;
		var height = this._videoEl.videoHeight;
		console.log('INFO in CameraReality.js : videoWidth videoHeight =', width, height);
		var videoSourceAspect = width / height;
		if (videoSourceAspect != cameraAspect) {
			// let's pick a size such that the video is below 512 in size in both dimensions
			//while (width > 512 || height > 512) { //JEELIZMODIF : COMMENT
			//	width = width / 2
			//	height = height / 2
			//}

			canvasWidth = this._videoRenderWidth = width;
			canvasHeight = this._videoRenderHeight = height;				
			var cameraAspect = canvasWidth / canvasHeight;

			this._videoFrameCanvas.width = width;
			this._videoFrameCanvas.height = height;
		}

		this._setFovy(this._cameraFov / (Math.PI/180))

		var windowWidth = this._xr._realityEls.clientWidth;
		var windowHeight = this._xr._realityEls.clientHeight;
		var windowAspect = windowWidth / windowHeight;

		var translateX = 0;
		var translateY = 0;
		if (cameraAspect > windowAspect) {
			canvasWidth = canvasHeight  * windowAspect;
			windowWidth = windowHeight * cameraAspect;
			translateX = -(windowWidth - this._xr._realityEls.clientWidth)/2;
		} else {
			canvasHeight = canvasWidth / windowAspect;
			windowHeight = windowWidth / cameraAspect; 
			translateY = -(windowHeight - this._xr._realityEls.clientHeight)/2;
		}

		this._videoEl.style.width = windowWidth.toFixed(2) + 'px'
		this._videoEl.style.height = windowHeight.toFixed(2) + 'px'		
		this._videoEl.style.transform = "translate(" + translateX.toFixed(2) + "px, "+ translateY.toFixed(2) + "px)"

		try {
			this.dispatchEvent(
				new CustomEvent(
					Reality.WINDOW_RESIZE_EVENT,
					{
						source: this,
						detail: {
							width: canvasWidth,
							height: canvasHeight,
							focalLength: this._focalLength
						}
					}
				)
			)
        } catch(e) {
            console.error('WINDOW_RESIZE_EVENT error', e)
        }
	}
	
	/*
	Called by a session before it hands a new XRPresentationFrame to the app
	*/
	_handleNewFrame(frame){
		if(this._vrDisplay){
			if (this._arCoreCameraRenderer) {
				this._arCoreCameraRenderer.render()
			}
			this._vrDisplay.getFrameData(this._vrFrameData)
		}

		// WebRTC video
		if (this._videoEl && this._sendVideoFrame && !this._videoFramesPaused) {
			this._sendVideoFrame = false;
			
			var canvasWidth  = this._videoRenderWidth;
			var canvasHeight = this._videoRenderHeight;
			this._videoCtx.drawImage(this._videoEl, 0, 0, canvasWidth, canvasHeight);
			var imageData = this._videoCtx.getImageData(0, 0, canvasWidth, canvasHeight);

			var data = imageData.data
			var len = imageData.data.length
			// imageData = new ArrayBuffer(len)
			// var buffData = new Uint8Array(imageData);
			// for (var i = 0; i < len; i++) buffData[i] = data[i] 
			
			var buffers = [
				{
					size: {
					  width: canvasWidth,
					  height: canvasHeight,
					  bytesPerRow: canvasWidth * 4,
					  bytesPerPixel: 4
					},
					buffer: imageData
				}];

			var pixelFormat = XRVideoFrame.IMAGEFORMAT_RGBA32;

			var timestamp = frame.timestamp; 
			
			// set from frame
			var view = frame.views[0];

			//this._videoViewMatrix.set(view.viewMatrix);
			MatrixMath.mat4_invert(this._videoViewMatrix, view.viewMatrix)
			
			this._videoProjectionMatrix.set(view.projectionMatrix)
			
			var camera = {
				arCamera: false,
				cameraOrientation: 0,
				cameraIntrinsics: this._cameraIntrinsics.slice(0),
				// cameraIntrinsics: [(this._videoEl.videoWidth/2) / Math.tan(view._fov.leftDegrees * Math.PI/180), 0, (this._videoEl.videoWidth/2), 
				// 					0, (this._videoEl.videoHeight/2) / Math.tan(view._fov.upDegrees * Math.PI/180), (this._videoEl.videoHeight/2), 
				// 					0, 0, 1],
				cameraImageResolution: {
						width: this._videoEl.videoWidth,
						height: this._videoEl.videoHeight
					},				  
				viewMatrix: this._videoViewMatrix,
				projectionMatrix: this._videoProjectionMatrix
			}
			//debugger;

			var xrVideoFrame = new XRVideoFrame(buffers, pixelFormat, timestamp, camera )

			try {
				this.dispatchEvent(
					new CustomEvent(
						Reality.COMPUTER_VISION_DATA,
						{
							source: this,
							detail: xrVideoFrame
						}
					)
				)
			} catch(e) {
				console.error('COMPUTER_VISION_DATA event error', e)
			}
		}
		// TODO update the anchor positions using ARCore or ARKit
	}

	_start(parameters=null){
		if(this._running) return
		this._running = true

		if(this._vrDisplay !== null){ // Using WebAR
			if (window.WebARonARKitSetData) {
				// WebARonARKit renders camera separately
			} else {
				this._arCoreCameraRenderer = new ARCoreCameraRenderer(this._vrDisplay, this._elContext)
			}
			this._initialized = true
		} else if(ARKitWrapper.HasARKit()){ // Using ARKit
			if(this._initialized === false){
				this._initialized = true
				this._arKitWrapper = ARKitWrapper.GetOrCreate()
				this._arKitWrapper.addEventListener(ARKitWrapper.WATCH_EVENT, this._handleARKitWatch.bind(this))
				this._arKitWrapper.waitForInit().then(() => {
					this._arKitWrapper.watch(parameters)
				})
			} else {
				this._arKitWrapper.watch(parameters)
			}
		} else { // Using WebRTC
			if(this._initialized === false){
				this._initialized = true
				navigator.mediaDevices.getUserMedia({
					audio: false,
					video: { facingMode: "environment" }
				}).then(stream => {
					this._videoEl = document.createElement('video')
					this._xr._realityEls.appendChild(this._videoEl)
					this._videoEl.setAttribute('class', 'camera-reality-video')
                    this._videoEl.setAttribute('playsinline', true);
					this._videoEl.style.width = '100%'
					this._videoEl.style.height = '100%'
					this._videoEl.srcObject = stream
					this._videoEl.play()
					this._setupWebRTC(parameters)
				}).catch(err => {
					console.error('Could not set up video stream', err)
					this._initialized = false
					this._running = false
				})
			} else {
				if (this._videoEl) {
						this._xr._realityEls.appendChild(this._videoEl)
						this._videoEl.play()
						this._setupWebRTC(parameters)
					}
			}
		}
	}

	_setupWebRTC(parameters) {
		if (parameters.videoFrames) {
			this._sendingVideo = true;

			this._videoEl.addEventListener('loadedmetadata', () => {
				var width = this._videoEl.videoWidth;
				var height = this._videoEl.videoHeight;

				// let's pick a size such that the video is below 512 in size in both dimensions
				//while (width > 256 || height > 256) { //JEELIZMODIF : COMMENT
				//	width = width / 2
				//	height = height / 2
				//}

				this._videoRenderWidth = width;
				this._videoRenderHeight = height;				
				this._videoFrameCanvas =  document.createElement('canvas');
				this._videoFrameCanvas.width = width;
				this._videoFrameCanvas.height = height;
				this._videoCtx = this._videoFrameCanvas.getContext('2d');

				this._adjustVideoSize();
				
				this._sendVideoFrame = true;
			});
		}
	}

	_requestVideoFrame() {
		this._sendVideoFrame = true;
	}

	_stopVideoFrames() {
		this._videoFramesPaused = true;
	}

	_startVideoFrames() {
		this._videoFramesPaused = false;
	}

	_stop(){
		if(this._running === false) return
		this._running = false
		if(ARKitWrapper.HasARKit()){
			if(this._arKitWrapper === null){
				return
			}
			this._arKitWrapper.stop()
		} else if(this._arCoreCanvas){
			this._xr._realityEls.removeChild(this._arCoreCanvas)
			this._arCoreCanvas = null
		} else if(this._videoEl !== null){
			this._videoEl.pause()
			this._xr._realityEls.removeChild(this._videoEl)
		}
	}

	_handleARKitWatch(ev){
		if(ev.detail && ev.detail.objects){
			for(let anchorInfo of ev.detail.objects){
				this._updateAnchorFromARKitUpdate(anchorInfo.uuid, anchorInfo)
				try {
					this.dispatchEvent(
						new CustomEvent(
							Reality.UPDATE_WORLD_ANCHOR,
							{
								source: this,
								detail: anchorInfo.uuid
							}
						)
					)
				} catch(e) {
					console.error('UPDATE_WORLD_ANCHOR event error', e)
				}
			}
		}

		if (ev.detail && ev.detail.removedObjects) {
			for (let removedAnchor of ev.detail.removedObjects) {
				try {
					this.dispatchEvent(
						new CustomEvent(
							Reality.REMOVE_WORLD_ANCHOR,
							{
								source: this,
								detail: removedAnchor
							}
						)
					)
				} catch(e) {
					console.error('REMOVE_WORLD_ANCHOR event error', e)
				}
				this._deleteAnchorFromARKitUpdate(removedAnchor)
			}
		}

        if (ev.detail && ev.detail.newObjects) {
            for (let addedAnchor of ev.detail.newObjects) {
				try {
					this.dispatchEvent(
						new CustomEvent(
							Reality.NEW_WORLD_ANCHOR,
							{
								source: this,
								detail: addedAnchor
							}
						)
					)
				} catch(e) {
					console.error('NEW_WORLD_ANCHOR event error', e)
				}
			}
        }
	}

    _deleteAnchorFromARKitUpdate(anchorUUID) {
        this._anchors.delete(anchorUUID)
	}

	_handleARKitAddObject(anchorInfo){
		this._updateAnchorFromARKitUpdate(anchorInfo.uuid, anchorInfo)
	}

	_updateAnchorFromARKitUpdate(uid, anchorInfo){
		const anchor = this._anchors.get(uid) || null
		if(anchor === null){
			// console.log('unknown anchor', anchor)
			return
		}
		// This assumes that the anchor's coordinates are in the tracker coordinate system
		anchor.coordinateSystem._relativeMatrix = anchorInfo.transform

		// update internal data if any
        switch (anchorInfo.type) {
			case ARKitWrapper.ANCHOR_TYPE_PLANE:
				anchor.center = anchorInfo.plane_center
				anchor.extent =  
					[anchorInfo.plane_extent.x, anchorInfo.plane_extent.z]
				anchor.alignment = anchorInfo.plane_alignment
				anchor.geometry = anchorInfo.geometry
				break
			case ARKitWrapper.ANCHOR_TYPE_FACE:
			 	if (anchorInfo.geometry) {
					anchor.geometry.vertices = anchorInfo.geometry.vertices
				 }
				 if (anchorInfo.blendShapes) {
					anchor.updateBlendShapes(anchorInfo.blendShapes)
				 }
				break
            case ARKitWrapper.ANCHOR_TYPE_ANCHOR:
            	break
            case ARKitWrapper.ANCHOR_TYPE_IMAGE:
            	break
		}
		
	}

	_addAnchor(anchor, display){
		// Convert coordinates to the tracker coordinate system so that updating from ARKit transforms is simple
		if(this._arKitWrapper !== null){
			this._arKitWrapper.addAnchor(anchor.uid, anchor.coordinateSystem._poseModelMatrix).then(
				detail => this._handleARKitAddObject(detail)
			)
		}
		// ARCore as implemented in the browser does not offer anchors except on a surface, so we just use untracked anchors
		// We also use untracked anchors for in-browser display, with WebRTC
		this._anchors.set(anchor.uid, anchor)
		return anchor.uid
	}

	/*
	Creates an anchor offset relative to a surface, as found by a ray
	normalized screen x and y are in range 0..1, with 0,0 at top left and 1,1 at bottom right
	returns a Promise that resolves either to an AnchorOffset with the first hit result or null if the hit test failed
	*/
	_findAnchor(normalizedScreenX, normalizedScreenY, display, testOptions=null){
		return new Promise((resolve, reject) => {
			if(this._arKitWrapper !== null){	
				// Perform a hit test using the ARKit integration
				this._arKitWrapper.hitTest(normalizedScreenX, normalizedScreenY, testOptions || ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANES).then(hits => {
					if(hits.length === 0){
						resolve(null)
						// console.log('miss')
						return
					}
					const hit = this._pickARKitHit(hits)

					// if it's a plane
					if (hit.anchor_transform) {
						hit.anchor_transform[13] += XRViewPose.SITTING_EYE_HEIGHT
						hit.world_transform[13] += XRViewPose.SITTING_EYE_HEIGHT

						// Use the first hit to create an XRAnchorOffset, creating the XRAnchor as necessary

						// TODO use XRPlaneAnchor for anchors with extents;  hopefully the plane will have been created, tho
						let anchor = this._getAnchor(hit.uuid)
						if(anchor === null){
							let coordinateSystem = new XRCoordinateSystem(display, XRCoordinateSystem.TRACKER)
							coordinateSystem._relativeMatrix = hit.anchor_transform
							anchor = new XRAnchor(coordinateSystem, hit.uuid)
							this._anchors.set(anchor.uid, anchor)
						}

						const offsetPosition = [
							hit.world_transform[12] - hit.anchor_transform[12],
							hit.world_transform[13] - hit.anchor_transform[13],
							hit.world_transform[14] - hit.anchor_transform[14]
						]
						const worldRotation = new Quaternion().setFromRotationMatrix(hit.world_transform)
						const inverseAnchorRotation = new Quaternion().setFromRotationMatrix(hit.anchor_transform).inverse()
						const offsetRotation = new Quaternion().multiplyQuaternions(worldRotation, inverseAnchorRotation)
						const anchorOffset = new XRAnchorOffset(anchor.uid)
						anchorOffset.poseMatrix = MatrixMath.mat4_fromRotationTranslation(new Float32Array(16), offsetRotation.toArray(), offsetPosition)
						resolve(anchorOffset)
					} else {
						let coordinateSystem = new XRCoordinateSystem(display, XRCoordinateSystem.TRACKER)
						coordinateSystem._relativeMatrix = hit.world_transform
						const anchor = new XRAnchor(coordinateSystem, hit.uuid)
						this._anchors.set(anchor.uid, anchor)

						const anchorOffset = new XRAnchorOffset(anchor.uid)
						resolve(anchorOffset)
					}
				})
			} else if(this._vrDisplay !== null){
				// Perform a hit test using the ARCore data
				let hits = this._vrDisplay.hitTest(normalizedScreenX, normalizedScreenY)
				if(hits.length == 0){
					resolve(null)
					return
				}
				hits.sort((a, b) => a.distance - b.distance)
				let anchor = this._getAnchor(hits[0].uuid)
				if(anchor === null){
					let coordinateSystem = new XRCoordinateSystem(display, XRCoordinateSystem.TRACKER)
					coordinateSystem._relativeMatrix = hits[0].modelMatrix
					coordinateSystem._relativeMatrix[13] += XRViewPose.SITTING_EYE_HEIGHT
					anchor = new XRAnchor(coordinateSystem)
					this._anchors.set(anchor.uid, anchor)
				}
				resolve(new XRAnchorOffset(anchor.uid))
			} else {
				resolve(null) // No platform support for finding anchors
			}
		})
	}

    /**
	 * Creates an ARReferenceImage in the ARKit native side
     * @param uid the ID of the image to create
     * @param buffer the base64 encoded image
     * @param width
     * @param height
     * @param physicalWidthInMeters
     * @returns a promise when the image has been created, error otherwise
     * @private
     */
    _createImageAnchor(uid, buffer, width, height, physicalWidthInMeters) {
		if (this._arKitWrapper) {
            return this._arKitWrapper.createImageAnchor(uid, buffer, width, height, physicalWidthInMeters)
        } else {
			return null;
		}
	}

    /**
	 * _activateDetectionImage Uses the ARKit wrapper to add a new reference image to the set of detection images in the ARKit configuration object
	 * and runs the session again. The promise is resolved when the image is detected by ARKit
     * @param uid The name (id) if the image to activate. It has to be previously created calling the "createImageAnchor" method
     * @param display The current display
     * @returns {Promise<any>} A promise resolved with the image transform in case of success, rejected with error otherwise
     */
    _activateDetectionImage(uid, display) {
        return new Promise((resolve, reject) => {
            if (this._arKitWrapper) {
                this._arKitWrapper.activateDetectionImage(uid).then(aRKitImageAnchor => {
                    if (aRKitImageAnchor.activated === true) {
                    	let coordinateSystem = new XRCoordinateSystem(display, XRCoordinateSystem.TRACKER)
						coordinateSystem._relativeMatrix = aRKitImageAnchor.imageAnchor.transform
						let anchor = new XRImageAnchor(coordinateSystem, aRKitImageAnchor.imageAnchor.uuid)
						this._anchors.set(aRKitImageAnchor.imageAnchor.uuid, anchor)
                        resolve(aRKitImageAnchor.imageAnchor.transform)
					} else if (aRKitImageAnchor.error !== null) {
                		reject(aRKitImageAnchor.error)
					} else {
                    	reject(null)
					}
				})
            } else {
                reject('ARKit not supported')
            }
        })
	}

	_removeAnchor(uid){
		if(this._arKitWrapper) {
			this._arKitWrapper.removeAnchor(uid)
		} else if (this._getAnchor(uid)) {
			this._anchors.delete(uid)
		}
	}

	_pickARKitHit(data){
		if(data.length === 0) return null
		let info = null

		let planeResults = data.filter(
			hitTestResult => hitTestResult.type != ARKitWrapper.HIT_TEST_TYPE_FEATURE_POINT
		)
		let planeExistingUsingExtentResults = planeResults.filter(
			hitTestResult => hitTestResult.type == ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE_USING_EXTENT
		)
		let planeExistingResults = planeResults.filter(
			hitTestResult => hitTestResult.type == ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE
		)

		if (planeExistingUsingExtentResults.length) {
			// existing planes using extent first
			planeExistingUsingExtentResults = planeExistingUsingExtentResults.sort((a, b) => a.distance - b.distance)
			info = planeExistingUsingExtentResults[0]
		} else if (planeExistingResults.length) {
			// then other existing planes
			planeExistingResults = planeExistingResults.sort((a, b) => a.distance - b.distance)
			info = planeExistingResults[0]
		} else if (planeResults.length) {
			// other types except feature points
			planeResults = planeResults.sort((a, b) => a.distance - b.distance)
			info = planeResults[0]
		} else {
			// feature points if any
			info = data[0]
		}
		return info
	}

	/*
	Found intersections with anchors and planes by a ray normalized screen x and y are in range 0..1, with 0,0 at top left and 1,1 at bottom right
	returns an Array of VRHit
	*/
	_hitTestNoAnchor(normalizedScreenX, normalizedScreenY, display){
		if(this._arKitWrapper !== null){
			// Perform a hit test using the ARKit integration
			let hits = this._arKitWrapper.hitTestNoAnchor(normalizedScreenX, normalizedScreenY);
			for (let i = 0; i < hits.length; i++) {
				hits[i].modelMatrix[13] += XRViewPose.SITTING_EYE_HEIGHT
			}
			if(hits.length == 0){
				return null;
			}
			return hits;
		} else if(this._vrDisplay !== null) {
			// Perform a hit test using the ARCore data
			let hits = this._vrDisplay.hitTest(normalizedScreenX, normalizedScreenY)
			for (let i = 0; i < hits.length; i++) {
				hits[i].modelMatrix[13] += XRViewPose.SITTING_EYE_HEIGHT
			}
			if(hits.length == 0){
				return null;
			}
			return hits;
		} else {
			// No platform support for finding anchors
			return null;
		}
	}

	_getHasLightEstimate(){
		if(this._arKitWrapper !== null){
			return true;
		}else{
			return false;
		}
	}

	_getLightAmbientIntensity(){
		if(this._arKitWrapper !== null){
			this._lightEstimate.ambientIntensity = this._arKitWrapper.lightIntensity;
			return this._lightEstimate.ambientIntensity;
		}else{
			// No platform support for ligth estimation
			return null;
		}
	}

	_getTimeStamp(timestamp) {
		if(this._arKitWrapper !== null){
			return this._arKitWrapper.timestamp;
		}else{
			// use performance.now()
			//return 	( performance || Date ).now();
			return timestamp
		}
	}
	/*
	No floor in AR
	*/
	_findFloorAnchor(display, uid=null){
		return new Promise((resolve, reject) => {
			resolve(null)
		})
	}

	
}
