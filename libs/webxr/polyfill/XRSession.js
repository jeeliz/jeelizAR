import EventHandlerBase from './fill/EventHandlerBase.js'
import MatrixMath from './fill/MatrixMath.js'
import XRDisplay from './XRDisplay.js'
import XRFaceAnchor from './XRFaceAnchor.js'
import XRImageAnchor from './XRImageAnchor.js'
import XRAnchor from './XRAnchor.js'
import ARKitWrapper from './platform/ARKitWrapper.js'
import XRPlaneAnchor from './XRPlaneAnchor.js'

/*
A script that wishes to make use of an XRDisplay can request an XRSession.
An XRSession provides a list of the available Reality instances that the script may request as well as make a request for an animation frame.
*/
export default class XRSession extends EventHandlerBase {
	constructor(xr, display, createParameters){
		super(xr)
		this._xr = xr
		this._display = display
		this._createParameters = createParameters
		this._ended = false

		this._baseLayer = null
		this._stageBounds = null

		this._skip = false;

		this._frameAnchors = []
		this._tempMatrix = MatrixMath.mat4_generateIdentity()		
		this._tempMatrix2 = MatrixMath.mat4_generateIdentity()

		this._display.addEventListener(XRDisplay.NEW_WORLD_ANCHOR, this._handleNewWorldAnchor.bind(this))
		this._display.addEventListener(XRDisplay.REMOVE_WORLD_ANCHOR, this._handleRemoveWorldAnchor.bind(this))
		this._display.addEventListener(XRDisplay.UPDATE_WORLD_ANCHOR, this._handleUpdateWorldAnchor.bind(this))
    }

	get display(){ return this._display }

	get createParameters(){ return this._parameters }

	get realities(){ return this._xr._sharedRealities }

	get reality(){ return this._display._reality }

	get baseLayer(){
		return this._baseLayer
	}

	set baseLayer(value){
		this._baseLayer = value
		this._display._handleNewBaseLayer(this._baseLayer)
	}

	get depthNear(){ this._display._depthNear }
	set depthNear(value){ this._display._depthNear = value }

	get depthFar(){ this._display._depthFar }
	set depthFar(value){ this._display._depthFar = value }

	get hasStageBounds(){ this._stageBounds !== null }

	get stageBounds(){ return this._stageBounds }

	requestFrame(callback){
		if(this._ended) return null
		if(typeof callback !== 'function'){
			throw 'Invalid callback'
		}
		return this._handleRequestFrame(callback)
	}

    _handleRequestFrame(callback) {
		return this._display._requestAnimationFrame((timestamp) => {
			if (this._skip) {
				this._skip = false;
				return this._handleRequestFrame(callback)
			}
			//this._skip = true;  // try skipping every second raf
			const frame = this._createPresentationFrame(timestamp)
			this._updateCameraAnchor(frame)

			this._display._reality._handleNewFrame(frame)
			this._display._handleNewFrame(frame)
			callback(frame)
			this._display._handleAfterFrame(frame)
		})
	}

	cancelFrame(handle){
		return this._display._cancelAnimationFrame(handle)
	}

	end(){
		if(this._ended) return
		for (var i = 0; i< this._frameAnchors.length; i++) {
			this._display._reality._removeAnchor(this._frameAnchors[i].uid)			
		}
		this._frameAnchors = [];
		this._ended = true
		this._display._stop()
		return new Promise((resolve, reject) => {
			resolve()
		})
	}

	_updateCameraAnchor(frame) {
		// new anchor each minute
		if (this._frameAnchors.length == 0 || (this._frameAnchors[0].timestamp + 60000) < frame.timestamp) {
			const headCoordinateSystem = frame.getCoordinateSystem(XRCoordinateSystem.EYE_LEVEL)
			const anchorUID = frame.addAnchor(headCoordinateSystem, [0,-1,0])
			const anchor = frame.getAnchor(anchorUID)
			anchor.timestamp = frame.timestamp;
			this._frameAnchors.unshift(anchor)

			if (this._frameAnchors.length > 10) {
				var oldAnchor = this._frameAnchors.pop()
				this._display._reality._removeAnchor(oldAnchor.uid)
			}
			return anchor;
		} else {
			return this._frameAnchors[0]
		}		
	}

	_transformToCameraAnchor(camera) {
		if (this._frameAnchors.length == 0) return camera.viewMatrix
		
		var matrix = camera.viewMatrix
		camera._anchorUid = this._frameAnchors[0].uid

		const anchorCoords = this._frameAnchors[0].coordinateSystem

		// should only have to invert anchor coords, but we're sending in the inverse
		// of the camera pose ...

		// get world to anchor by inverting anchor to world
		MatrixMath.mat4_invert(this._tempMatrix, anchorCoords._poseModelMatrix)

		// get camera to world by inverting world to camera
		// MatrixMath.mat4_invert(this._tempMatrix2, matrix)
		// MatrixMath.mat4_multiply(camera.viewMatrix, this._tempMatrix, this._tempMatrix2)
		MatrixMath.mat4_multiply(camera.viewMatrix, this._tempMatrix, matrix)
	}

	setVideoFrameHandler(callback) {
		if (callback instanceof Worker) {
			var worker = callback;
			callback = 	(ev => { 
				// var cv = ev.detail
				// var buffers = cv.frame.buffers
				// var buffs = []
				// for (var i = 0; i < buffers.length; i++) {
				// 	buffs.push(buffers[i].buffer)
				// }
				// worker.postMessage(cv, buffs);
				this._transformToCameraAnchor(ev.detail.camera)
				ev.detail.postMessageToWorker(worker, {type: "newVideoFrame"})
				ev.detail.release()
			})	
		} else {
			var originalCallback = callback;
			callback = (ev => {
				this._transformToCameraAnchor(ev.detail.camera)
				originalCallback(ev)
			})
		}
		this._display.addEventListener("videoFrame", callback)
	}

    getVideoFramePose(videoFrame, poseOut)
    {
        if (!videoFrame.camera._anchorUid) return 

		var anchorPose;
		var anchor = this.reality._getAnchor(videoFrame.camera._anchorUid)
		if (anchor) {
			anchorPose = anchor.coordinateSystem._poseModelMatrix
		} else {
			var i =0;
			for (; i < this._frameAnchors.length; i++) {
				if (videoFrame.camera._anchorUid == this._frameAnchors[i].uid) {
					anchorPose = this._frameAnchors[i].coordinateSystem._poseModelMatrix;
					break;
				}
			}

			if (i == this._frameAnchors.length) {
				// shouldn't happen!
				console.warn("should never get here: session.getVideoFramePose can't find anchor")
				return;
			}
		}
		MatrixMath.mat4_multiply(poseOut, anchorPose, videoFrame.camera.viewMatrix )

	}

	// normalized screen x and y are in range 0..1, with 0,0 at top left and 1,1 at bottom right
	hitTest(normalizedScreenX, normalizedScreenY, options=null){
		// Promise<XRAnchorOffset?> findAnchor(float32, float32); // cast a ray to find or create an anchor at the first intersection in the Reality
		return this.reality._findAnchor(normalizedScreenX, normalizedScreenY, this.display, options)
	}
	
	requestVideoFrame() {
		this._display._requestVideoFrame();
	}

	stopVideoFrames() {
		this._display._stopVideoFrames();
	}
	
	startVideoFrames() {
		this._display._startVideoFrames();
	}

	_createPresentationFrame(timestamp){
		return new XRPresentationFrame(this, timestamp)
	}

	_getCoordinateSystem(...types){
		for(let type of types){
			switch(type){
				case XRCoordinateSystem.HEAD_MODEL:
					return this._display._headModelCoordinateSystem
				case XRCoordinateSystem.EYE_LEVEL:
					return this._display._eyeLevelCoordinateSystem
				case XRCoordinateSystem.TRACKER:
					return this._display._trackerCoordinateSystem
				case XRCoordinateSystem.GEOSPATIAL:
					// Not supported yet
				default:
					continue
			}
		}
		return null
	}

    createImageAnchor(uid, buffer, width, height, physicalWidthInMeters) {
        return this.reality._createImageAnchor(uid, buffer, width, height, physicalWidthInMeters)
    }

    activateDetectionImage(uid) {
        return this.reality._activateDetectionImage(uid, this._display)
	}

    _handleNewWorldAnchor(event) {
		let xrAnchor = event.detail
        //console.log(`New world anchor: ${JSON.stringify(xrAnchor)}`)

		try {
			this.dispatchEvent(
				new CustomEvent(
					XRSession.NEW_WORLD_ANCHOR,
					{
						source: this,
						detail: xrAnchor
					}
				)
			)
        } catch(e) {
            console.error('NEW_WORLD_ANCHOR event error', e)
        }
    }

    _handleUpdateWorldAnchor(event) {
        let xrAnchor = event.detail
        //console.log(`New world anchor: ${JSON.stringify(xrAnchor)}`)

		try {
			this.dispatchEvent(
				new CustomEvent(
					XRSession.UPDATE_WORLD_ANCHOR,
					{
						source: this,
						detail: xrAnchor
					}
				)
			)
        } catch(e) {
            console.error('UPDATE_WORLD_ANCHOR event error', e)
        }
	}
	
    _handleRemoveWorldAnchor(event) {
		let xrAnchor = event.detail
        //console.log(`Remove world anchor: ${JSON.stringify(xrAnchor)}`)

		try {
			this.dispatchEvent(
				new CustomEvent(
					XRSession.REMOVE_WORLD_ANCHOR,
					{
						source: this,
						detail: xrAnchor
					}
				)
			)
        } catch(e) {
            console.error('REMOVE_WORLD_ANCHOR event error', e)
        }
    }
	/*
	attribute EventHandler onblur;
	attribute EventHandler onfocus;
	attribute EventHandler onresetpose;
	attribute EventHandler onrealitychanged;
	attribute EventHandler onrealityconnect;
	attribute EventHandler onrealitydisconnect;
	attribute EventHandler onboundschange;
	attribute EventHandler onended;
	*/
}

XRSession.REALITY = 'reality'
XRSession.AUGMENTATION = 'augmentation'

XRSession.TYPES = [XRSession.REALITY, XRSession.AUGMENTATION]

XRSession.NEW_WORLD_ANCHOR = 'world-anchor'
XRSession.UPDATE_WORLD_ANCHOR = 'update-world-anchor'
XRSession.REMOVE_WORLD_ANCHOR = 'remove-world-anchor'