import XRDisplay from '../XRDisplay.js'
import XRView from '../XRView.js'
import XRSession from '../XRSession.js'
import XRFieldOfView from '../XRFieldOfView.js'

import MatrixMath from '../fill/MatrixMath.js'
import Quaternion from '../fill/Quaternion.js'
import Vector3 from '../fill/Vector3.js'

import DeviceOrientationTracker from '../fill/DeviceOrientationTracker.js'
import ARKitWrapper from '../platform/ARKitWrapper.js'
import XRPlaneAnchor from '../XRPlaneAnchor.js'
import XRFaceAnchor from '../XRFaceAnchor.js'
import XRAnchor from '../XRAnchor.js'
import XRImageAnchor from '../XRImageAnchor.js'

/*
FlatDisplay takes over a handset's full screen and presents a moving view into a Reality, as if it were a magic window.

If ARKit is present, it uses the ARKit updates to set the headModel pose.
If ARCore is available on the VRDisplays, use that to pose the headModel. (TODO)
Otherwise, use orientation events.
*/
export default class FlatDisplay extends XRDisplay {
	constructor(xr, reality){
		super(xr, 'Flat', false, reality)

		this._started = false
		this._initialized = false

		// This is used if we have ARKit support
		this._arKitWrapper = null

		// This is used if we have ARCore support
		this._vrFrameData = null

		// This is used if we are using orientation events
		this._deviceOrientationTracker = null

		// These are used if we have ARCore support or use window orientation events
		this._deviceOrientation = null			// Quaternion
		this._devicePosition = null				// Vector3
		this._deviceWorldMatrix = null			// Float32Array(16)

		// Currently only support full screen views
		this._views.push(new XRView(this._fov, this._depthNear, this._depthFar))
	}

	_start(parameters=null){
		if(this._reality._vrDisplay){ // Use ARCore
			if(this._vrFrameData === null){
				this._vrFrameData = new VRFrameData()
				this._views[0]._depthNear = this._reality._vrDisplay.depthNear
				this._views[0]._depthFar = this._reality._vrDisplay.depthFar
				this._deviceOrientation = new Quaternion()
				this._devicePosition = new Vector3()
				this._deviceWorldMatrix = new Float32Array(16)
			}
		} else if(ARKitWrapper.HasARKit()){ // Use ARKit
			if(this._initialized === false){
				this._initialized = true
				this._arKitWrapper = ARKitWrapper.GetOrCreate()
				this._arKitWrapper.addEventListener(ARKitWrapper.INIT_EVENT, this._handleARKitInit.bind(this))
				this._arKitWrapper.addEventListener(ARKitWrapper.WATCH_EVENT, this._handleARKitUpdate.bind(this))
				this._arKitWrapper.addEventListener(ARKitWrapper.WINDOW_RESIZE_EVENT, this._handleARKitWindowResize.bind(this))
				this._arKitWrapper.addEventListener(ARKitWrapper.ON_ERROR, this._handleOnError.bind(this))
				this._arKitWrapper.addEventListener(ARKitWrapper.AR_TRACKING_CHANGED, this._handleArTrackingChanged.bind(this))
				this._arKitWrapper.addEventListener(ARKitWrapper.COMPUTER_VISION_DATA, this._handleComputerVisionData.bind(this))
                this._reality.addEventListener(Reality.NEW_WORLD_ANCHOR, this._handleNewWorldAnchor.bind(this))
                this._reality.addEventListener(Reality.UPDATE_WORLD_ANCHOR, this._handleUpdateWorldAnchor.bind(this))
                this._reality.addEventListener(Reality.REMOVE_WORLD_ANCHOR, this._handleRemoveWorldAnchor.bind(this))
                this._arKitWrapper.waitForInit().then(() => {
					// doing this in the reality
					// this._arKitWrapper.watch()
				})
			} else {
				// doing this in the reality
				// this._arKitWrapper.watch()
			}
		} else { // Use device orientation
			if(this._initialized === false){
				this._initialized = true
				this._deviceOrientation = new Quaternion()
				this._devicePosition = new Vector3()
				this._deviceWorldMatrix = new Float32Array(16)
				this._deviceOrientationTracker = new DeviceOrientationTracker()
				this._deviceOrientationTracker.addEventListener(DeviceOrientationTracker.ORIENTATION_UPDATE_EVENT, this._updateFromDeviceOrientationTracker.bind(this))
				this._reality.addEventListener(Reality.COMPUTER_VISION_DATA, this._handleComputerVisionData.bind(this))
				this._reality.addEventListener(Reality.WINDOW_RESIZE_EVENT, this._handleWindowResize.bind(this))
			}
		}
		this.running = true
		this._reality._start(parameters)
	}

	_stop(){
		// TODO figure out how to stop ARKit and ARCore so that CameraReality can still work
		if(this.running === false) return
		this.running = false
		this._reality._stop()
	}

	_fixFov (width, height, focalLength) {
		if (!this.baseLayer) {
			return;
		}
		var ratio = width / this.baseLayer._context.canvas.clientWidth
		focalLength = focalLength / ratio

		var x = 0.5 * this.baseLayer._context.canvas.clientWidth / focalLength
		var fovx = (180/Math.PI) * 2 * Math.atan(x)
		var y = 0.5 * this.baseLayer._context.canvas.clientHeight / focalLength
		var fovy = (180/Math.PI) * 2 * Math.atan(y)

		// var x = (Math.tan(0.5 * fov) / this.baseLayer.framebufferHeight) * this.baseLayer.framebufferWidth
		// var fovx = (Math.atan(x) * 2) / (Math.PI/180);
		this._fov = new XRFieldOfView(fovy/2, fovy/2, fovx/2, fovx/2)

		this._views[0].fov = this._fov
	}

	_handleWindowResize(ev){
		this._fixFov(ev.detail.width, ev.detail.height, ev.detail.focalLength)
	}

    _handleNewWorldAnchor(event) {
		let anchorObject = event.detail
        let coordinateSystem = new XRCoordinateSystem(this, XRCoordinateSystem.TRACKER)
        coordinateSystem._relativeMatrix = anchorObject.transform

		let anchor
        switch (anchorObject.type) {
			case ARKitWrapper.ANCHOR_TYPE_PLANE:
                anchor = new XRPlaneAnchor(coordinateSystem,
                    anchorObject.uuid,
                    anchorObject.plane_center,
				          	[anchorObject.plane_extent.x, anchorObject.plane_extent.z],
                    anchorObject.plane_alignment,
                    anchorObject.geometry)
      				break
            case ARKitWrapper.ANCHOR_TYPE_FACE:
            	anchor = new XRFaceAnchor(coordinateSystem, anchorObject.uuid, anchorObject.geometry, anchorObject.blendShapes)
            	break
            case ARKitWrapper.ANCHOR_TYPE_ANCHOR:
            	anchor = new XRAnchor(coordinateSystem, anchorObject.uuid)
            	break
            case ARKitWrapper.ANCHOR_TYPE_IMAGE:
            	anchor = new XRImageAnchor(coordinateSystem, anchorObject.uuid)
            	break
		}

        this._reality._anchors.set(anchorObject.uuid, anchor)
        //console.log(`New world anchor: ${JSON.stringify(ev)}`)

        try {
            this.dispatchEvent(
                new CustomEvent(
                    XRDisplay.NEW_WORLD_ANCHOR,
                    {
                        source: this,
                        detail: anchor
                    }
                )
            )
        } catch(e) {
            console.error('NEW_WORLD_ANCHOR event error', e)
        }
	}

    _handleUpdateWorldAnchor(event) {
		let anchorUUID = event.detail
		let anchor = this._reality._anchors.get(anchorUUID)
		if (anchor !== null) {
            try {
                this.dispatchEvent(
                    new CustomEvent(
                        XRDisplay.UPDATE_WORLD_ANCHOR,
                        {
                            source: this,
                            detail: anchor
                        }
                    )
                )
            } catch(e) {
                console.error('UPDATE_WORLD_ANCHOR event error', e)
            }
		}
	}

    _handleRemoveWorldAnchor(event) {
		let anchorUUID = event.detail
		let anchor = this._reality._anchors.get(anchorUUID)
		if (anchor !== null) {
            try {
                this.dispatchEvent(
                    new CustomEvent(
                        XRDisplay.REMOVE_WORLD_ANCHOR,
                        {
                            source: this,
                            detail: anchor
                        }
                    )
                )
            } catch(e) {
                console.error('REMOVE_WORLD_ANCHOR event error', e)
            }
		}
	}

	/*
	Called by a session to indicate that its baseLayer attribute has been set.
	FlatDisplay just adds the layer's canvas to DOM elements created by the XR polyfill
	*/
	_handleNewBaseLayer(baseLayer){
		this.baseLayer = baseLayer;
		baseLayer._context.canvas.style.width = "100%";
		baseLayer._context.canvas.style.height = "100%";
		baseLayer.framebufferWidth = this._xr._sessionEls.clientWidth;
		baseLayer.framebufferHeight = this._xr._sessionEls.clientHeight;

		if (this._arKitWrapper === null) {
			// TODO:  Need to remove this listener if a new base layer is set
			window.addEventListener('resize', () => {
				baseLayer.framebufferWidth = baseLayer._context.canvas.clientWidth;
				baseLayer.framebufferHeight = baseLayer._context.canvas.clientHeight;
			}, false)	
		}
		//this._fixFov(baseLayer.framebufferWidth, baseLayer.framebufferHeight, this._reality._focalLength)

		this._xr._sessionEls.appendChild(baseLayer._context.canvas)
	}

	/*
	Called by a session before it hands a new XRPresentationFrame to the app
	*/
	_handleNewFrame(frame){
		if(this._vrFrameData !== null){
			this._updateFromVRDevice()
		}
	}

	_updateFromVRDevice(){
		this._reality._vrDisplay.getFrameData(this._vrFrameData)
		this._views[0].setProjectionMatrix(this._vrFrameData.leftProjectionMatrix)
		this._deviceOrientation.set(...this._vrFrameData.pose.orientation)
		this._devicePosition.set(...this._vrFrameData.pose.position)
		this._devicePosition.add(0, XRViewPose.SITTING_EYE_HEIGHT, 0)
		MatrixMath.mat4_fromRotationTranslation(this._deviceWorldMatrix, this._deviceOrientation.toArray(), this._devicePosition.toArray())
		this._views[0].setViewMatrix(this._deviceWorldMatrix)
		this._headPose._setPoseModelMatrix(this._deviceWorldMatrix)
		this._eyeLevelPose._position = this._devicePosition.toArray()
	}

	_updateFromDeviceOrientationTracker(){
		// TODO set XRView's FOV
		this._deviceOrientationTracker.getOrientation(this._deviceOrientation)
		this._devicePosition.set(this._headPose.poseModelMatrix[12], this._headPose.poseModelMatrix[13], this._headPose.poseModelMatrix[14])
		this._devicePosition.add(0, XRViewPose.SITTING_EYE_HEIGHT, 0)
		MatrixMath.mat4_fromRotationTranslation(this._deviceWorldMatrix, this._deviceOrientation.toArray(), this._devicePosition.toArray())
		this._headPose._setPoseModelMatrix(this._deviceWorldMatrix)
		this._views[0].setViewMatrix(this._deviceWorldMatrix)
		this._eyeLevelPose._position = this._devicePosition.toArray()
	}

	_handleARKitUpdate(...params){
		const cameraTransformMatrix = this._arKitWrapper.getData('camera_transform')
		if (cameraTransformMatrix) {
			this._headPose._setPoseModelMatrix(cameraTransformMatrix)
			this._views[0].setViewMatrix(cameraTransformMatrix)
			this._headPose._poseModelMatrix[13] += XRViewPose.SITTING_EYE_HEIGHT
			this._eyeLevelPose._position = this._headPose._position
		} else {
			console.log('no camera transform', this._arKitWrapper.rawARData)
		}

		const cameraProjectionMatrix = this._arKitWrapper.getData('projection_camera')
		if(cameraProjectionMatrix){
			this._views[0].setProjectionMatrix(cameraProjectionMatrix)
		} else {
			console.log('no projection camera', this._arKitWrapper.rawARData)
		}
	}

	_handleARKitInit(ev){
		// doing this in the reality
		// 	setTimeout(() => {
		// 		this._arKitWrapper.watch({
		// 			location: true,
		// 			camera: true,
		// 			objects: true,
		// 			light_intensity: true,
		//             computer_vision_data: true
		// 		})
		// 	}, 1000)
	}

	_handleARKitWindowResize(ev){
		this.baseLayer.framebufferWidth = ev.detail.width;
		this.baseLayer.framebufferHeight = ev.detail.height;
	}

	_handleOnError(ev){
		//"domain": "error domain",
		//"code": 1234,
		//"message": "error message"
		// Ex: > {code: 3, message: "error.localizedDescription", domain: "error.domain"}
	}

	_handleArTrackingChanged(ev){
		// ev.detail values
		// #define WEB_AR_TRACKING_STATE_NORMAL               @"ar_tracking_normal"
		// #define WEB_AR_TRACKING_STATE_LIMITED              @"ar_tracking_limited"
		// #define WEB_AR_TRACKING_STATE_LIMITED_INITIALIZING @"ar_tracking_limited_initializing"
		// #define WEB_AR_TRACKING_STATE_LIMITED_MOTION       @"ar_tracking_limited_excessive_motion"
		// #define WEB_AR_TRACKING_STATE_LIMITED_FEATURES     @"ar_tracking_limited_insufficient_features"
		// #define WEB_AR_TRACKING_STATE_NOT_AVAILABLE        @"ar_tracking_not_available"
	}


    _handleComputerVisionData(ev) {
        // Do whatever is needed with the image buffers here
		try {
			this.dispatchEvent(
				new CustomEvent(
					"videoFrame",
					{
						source: this,
						detail: ev.detail
					}
				)
			)	
		} catch(e) {
			console.error('computer vision callback error', e)
		}
	}

	_requestVideoFrame() {
		if(this._arKitWrapper){ // Use ARKit
			// call this._arKitWrapper.requestComputerVisionData(buffers) to request a new one
			this._arKitWrapper._requestComputerVisionData()
		} else {
			//  might have webrtc video in the reality
			this._reality._requestVideoFrame()
		}
	}

	_stopVideoFrames() {
		if(this._arKitWrapper){ // Use ARKit
			// call this._arKitWrapper.requestComputerVisionData(buffers) to request a new one
			this._arKitWrapper._stopSendingComputerVisionData()
		} else {
			//  might have webrtc video in the reality
			this._reality._stopVideoFrames()
		}
	}

	_startVideoFrames() {
		if(this._arKitWrapper){ // Use ARKit
			// call this._arKitWrapper.requestComputerVisionData(buffers) to request a new one
			this._arKitWrapper._startSendingComputerVisionData()
		} else {
			//  might have webrtc video in the reality
			this._reality._startVideoFrames()
		}
	}
	
	_createSession(parameters=null){
		this._start(parameters)

		if(ARKitWrapper.HasARKit()){ // Use ARKit
			return this._arKitWrapper.waitForInit().then(() => {
				return super._createSession(parameters)
			})
		} else {
			return super._createSession(parameters)
		}
	}

	_supportedCreationParameters(parameters){
		return parameters.type === XRSession.AUGMENTATION && parameters.exclusive === false	
	}

	//attribute EventHandler ondeactivate; // FlatDisplay never deactivates
}