import EventHandlerBase from '../fill/EventHandlerBase.js'
import * as glMatrix from "../fill/gl-matrix/common.js";
import * as mat4 from "../fill/gl-matrix/mat4.js";
import * as quat from "../fill/gl-matrix/quat.js";
import * as vec3 from "../fill/gl-matrix/vec3.js";
import base64 from "../fill/base64-binary.js";
import Quaternion from '../fill/Quaternion.js';
import MatrixMath from '../fill/MatrixMath.js';

/*	
ARKitWrapper talks	 to Apple ARKit, as exposed by Mozilla's test ARDemo app.
It won't function inside a browser like Firefox.

ARKitWrapper is a singleton. Use ARKitWrapper.GetOrCreate() to get the instance, then add event listeners like so:

	if(ARKitWrapper.HasARKit()){
		let arKitWrapper = ARKitWrapper.GetOrCreate()
		arKitWrapper.addEventListener(ARKitWrapper.INIT_EVENT, ev => { console.log('ARKit initialized', ev) })
		arKitWrapper.addEventListener(ARKitWrapper.WATCH_EVENT, ev => { console.log('ARKit update', ev) })
		arKitWrapper.watch({
			location: boolean,
			camera: boolean,
			objects: boolean,
			light_intensity: boolean
		})
	}

*/

export default class ARKitWrapper extends EventHandlerBase {
	constructor(){
		super()
		if(ARKitWrapper.HasARKit() === false){
			throw 'ARKitWrapper will only work in Mozilla\'s ARDemo test app'
		}
		if(typeof ARKitWrapper.GLOBAL_INSTANCE !== 'undefined'){
			throw 'ARKitWrapper is a singleton. Use ARKitWrapper.GetOrCreate() to get the global instance.'
		}

		this._deviceId = null
		this._isWatching = false
		this._isInitialized = false
		this._rawARData = null

		// worker to convert buffers
		// var blobURL = this._buildWorkerBlob()
		// this._worker = new Worker(blobURL);
		// URL.revokeObjectURL(blobURL);

		// var self = this;
		// this._worker.onmessage = function (ev) {
		// 	setTimeout(function () {
		// 		self.dispatchEvent(
		// 			new CustomEvent(
		// 				ARKitWrapper.COMPUTER_VISION_DATA,
		// 				{
		// 					source: self,
		// 					detail: ev.data
		// 				}
		// 			)
		// 		)	
		// 	})
		// }

		this.lightIntensity = 1000;
		/**
		 * The current projection matrix of the device.
		 * @type {Float32Array}
		 * @private
		 */
		this.projectionMatrix_ = new Float32Array(16);
		/**
		 * The current view matrix of the device.
		 * @type {Float32Array}
		 * @private
		 */
		this.viewMatrix_ = new Float32Array(16);
		/**
		 * The list of planes coming from ARKit.
		 * @type {Map<number, ARPlane}
		 * @private
		 */
		this.planes_ = new Map();
		this.anchors_ = new Map();

		this._timeOffsets = []
		this._timeOffset = 0;
		this._timeOffsetComputed = false;
		this.timestamp = 0;


		this._globalCallbacksMap = {} // Used to map a window.arkitCallback method name to an ARKitWrapper.on* method name
		// Set up the window.arkitCallback methods that the ARKit bridge depends on
		let callbackNames = ['onInit', 'onWatch']
		for(let i=0; i < callbackNames.length; i++){
			this._generateGlobalCallback(callbackNames[i], i)
		}
			
		// default options for initializing ARKit
		this._defaultOptions = {
			location: true,
			camera: true,
			objects: true,
			light_intensity: true,
			computer_vision_data: false
		}
		this._m90 = mat4.fromZRotation(mat4.create(), 90*MatrixMath.PI_OVER_180);
		this._m90neg = mat4.fromZRotation(mat4.create(), -90*MatrixMath.PI_OVER_180);
		this._m180 = mat4.fromZRotation(mat4.create(), 180*MatrixMath.PI_OVER_180);
		this._mTemp = mat4.create();

		// temp storage for CV arraybuffers
		//this._ab = []

		// Set up some named global methods that the ARKit to JS bridge uses and send out custom events when they are called
		let eventCallbacks = [
			['arkitStartRecording', ARKitWrapper.RECORD_START_EVENT],
			['arkitStopRecording', ARKitWrapper.RECORD_STOP_EVENT],
			['arkitDidMoveBackground', ARKitWrapper.DID_MOVE_BACKGROUND_EVENT],
			['arkitWillEnterForeground', ARKitWrapper.WILL_ENTER_FOREGROUND_EVENT],
			['arkitInterrupted', ARKitWrapper.INTERRUPTED_EVENT],
			['arkitInterruptionEnded', ARKitWrapper.INTERRUPTION_ENDED_EVENT], 
			['arkitShowDebug', ARKitWrapper.SHOW_DEBUG_EVENT],
			['arkitWindowResize', ARKitWrapper.WINDOW_RESIZE_EVENT],
			['onError', ARKitWrapper.ON_ERROR],
			['arTrackingChanged', ARKitWrapper.AR_TRACKING_CHANGED],
			['userGrantedComputerVisionData', ARKitWrapper.USER_GRANTED_COMPUTER_VISION_DATA],
			['userGrantedWorldSensingData', ARKitWrapper.USER_GRANTED_WORLD_SENSING_DATA]
            //,['onComputerVisionData', ARKitWrapper.COMPUTER_VISION_DATA]
		]
		for(let i=0; i < eventCallbacks.length; i++){
			window[eventCallbacks[i][0]] = (detail) => {
				detail = detail || null
				try {
					this.dispatchEvent(
						new CustomEvent(
							eventCallbacks[i][1],
							{
								source: this,
								detail: detail
							}
						)
					)	
				} catch(e) {
					console.error(eventCallbacks[i][0] + ' callback error', e)
				}
			}
		}
		/*
		 * Computer vision needs massaging
		 */
		window['onComputerVisionData'] = (detail) => {
			this._onComputerVisionData(detail);
		}

		window['setNativeTime'] = (detail) => {
			this._timeOffsets.push (( performance || Date ).now() - detail.nativeTime)
			this._timeOffsetComputed = true;
			this._timeOffset = 0;
			for (var i = 0; i < this._timeOffsets.length; i++) {
				this._timeOffset += this._timeOffsets[i];
			}
			this._timeOffset = this._timeOffset / this._timeOffsets.length;
			console.log("Native time: " + detail.nativeTime + ", new timeOffset: " + this._timeOffset)
		}
			
		this._adjustARKitTime = function(time) {
			// if (!this._timeOffsetComputed && adjust) {
			// 	this._timeOffsetComputed = true;
			// 	this._timeOffset = ( performance || Date ).now() - time;
			// }
			if (this._timeOffsetComputed) {
				return time + this._timeOffset; 
			} else {
				return ( performance || Date ).now()
			}
		}

		/**
		 * The result of a raycast into the AR world encoded as a transform matrix.
		 * This structure has a single property - modelMatrix - which encodes the
		 * translation of the intersection of the hit in the form of a 4x4 matrix.
		 * @constructor
		 */
		function VRHit() {
			this.modelMatrix = new Float32Array(16);
			return this;
		};

		var self = this;
		/**
		 * Get an iterable of plane objects representing ARKit's current understanding of the world.
		 * @return {iterator<Object>} The iterable of plane objects.
		 */
		this.getPlanes = function() {
			return Array.from(this.planes_.values());
		};
    /**
     * Get intersection array with planes ARKit detected for the screen coords.
     *
     * @param {number} x The x coordinate in normalized screen space [0,1].
     * @param {number} y The y coordinate in normalized screen space [0,1].
     *
     * @return {!Array<VRHit>} The array of hits sorted based on distance.
     */
		this.hitTestNoAnchor = (function() {
			/**
			* Cached vec3, mat4, and quat structures needed for the hit testing to
			* avoid generating garbage.
			* @type {Object}
			*/
			var hitVars = {
			 rayStart: vec3.create(),
			 rayEnd: vec3.create(),
			 cameraPosition: vec3.create(),
			 cameraQuaternion: quat.create(),	
			 modelViewMatrix: mat4.create(),
			 projectionMatrix: mat4.create(),
			 projViewMatrix: mat4.create(),
			 worldRayStart: vec3.create(),
			 worldRayEnd: vec3.create(),
			 worldRayDir: vec3.create(),
			 planeMatrix: mat4.create(),
			 planeExtent: vec3.create(),
			 planePosition: vec3.create(),
			 planeCenter: vec3.create(),
			 planeNormal: vec3.create(),
			 planeIntersection: vec3.create(),
			 planeIntersectionLocal: vec3.create(),
			 planeHit: mat4.create(),
			 planeQuaternion: quat.create()
		 };
 
		 /**
			* Sets the given mat4 from the given float[16] array.
			*
			* @param {!mat4} m The mat4 to populate with values.
			* @param {!Array<number>} a The source array of floats (must be size 16).
			*/
		 var setMat4FromArray = function(m, a) {
			 mat4.set(
				 m,
				 a[0],
				 a[1],
				 a[2],
				 a[3],
				 a[4],
				 a[5],
				 a[6],
				 a[7],
				 a[8],
				 a[9],
				 a[10],
				 a[11],
				 a[12],
				 a[13],
				 a[14],
				 a[15]
			 );
		 };	
		 /**
			* Tests whether the given ray intersects the given plane.
			*
			* @param {!vec3} planeNormal The normal of the plane.
			* @param {!vec3} planePosition Any point on the plane.
			* @param {!vec3} rayOrigin The origin of the ray.
			* @param {!vec3} rayDirection The direction of the ray (normalized).
			* @return {number} The t-value of the intersection (-1 for none).
			*/
		 var rayIntersectsPlane = (function() {
			 var rayToPlane = vec3.create();
			 return function(planeNormal, planePosition, rayOrigin, rayDirection) {
				 // assuming vectors are all normalized
				 var denom = vec3.dot(planeNormal, rayDirection);
				 vec3.subtract(rayToPlane, planePosition, rayOrigin);
				 return vec3.dot(rayToPlane, planeNormal) / denom;
			 };
		 })();
 
		 /**
			* Sorts based on the distance from the VRHits to the camera.
			*
			* @param {!VRHit} a The first hit to compare.
			* @param {!VRHit} b The second hit item to compare.
			* @returns {number} -1 if a is closer than b, otherwise 1.
			*/
		 var sortFunction = function(a, b) {
			 // Get the matrix of hit a.
			 setMat4FromArray(hitVars.planeMatrix, a.modelMatrix);
			 // Get the translation component of a's matrix.
			 mat4.getTranslation(hitVars.planeIntersection, hitVars.planeMatrix);
			 // Get the distance from the intersection point to the camera.
			 var distA = vec3.distance(
				 hitVars.planeIntersection,
				 hitVars.cameraPosition
			 );
 
			 // Get the matrix of hit b.
			 setMat4FromArray(hitVars.planeMatrix, b.modelMatrix);
			 // Get the translation component of b's matrix.
			 mat4.getTranslation(hitVars.planeIntersection, hitVars.planeMatrix);
			 // Get the distance from the intersection point to the camera.
			 var distB = vec3.distance(
				 hitVars.planeIntersection,
				 hitVars.cameraPosition
			 );
 
			 // Return comparison of distance from camera to a and b.
			 return distA < distB ? -1 : 1;
		 };
 
		 return function(x, y) {
			 // Coordinates must be in normalized screen space.
			 if (x < 0 || x > 1 || y < 0 || y > 1) {
				 throw new Error(
						 "hitTest - x and y values must be normalized [0,1]!")
				 ;
			 }
 
			 var hits = [];
			 // If there are no anchors detected, there will be no hits.
			 var planes = this.getPlanes();
			 if (!planes || planes.length == 0) {
				 return hits;
			 }
 
			 // Create a ray in screen space for the hit test ([-1, 1] with y flip).
			 vec3.set(hitVars.rayStart, 2 * x - 1, 2 * (1 - y) - 1, 0);
			 vec3.set(hitVars.rayEnd, 2 * x - 1, 2 * (1 - y) - 1, 1);
			 // Set the projection matrix.
			 setMat4FromArray(hitVars.projectionMatrix, self.projectionMatrix_);
 
			 // Set the model view matrix.
			 setMat4FromArray(hitVars.modelViewMatrix, self.viewMatrix_);
 
			 // Combine the projection and model view matrices.
			 mat4.multiply(
				 hitVars.projViewMatrix,
				 hitVars.projectionMatrix,
				 hitVars.modelViewMatrix
			 );
			 // Invert the combined matrix because we need to go from screen -> world.
			 mat4.invert(hitVars.projViewMatrix, hitVars.projViewMatrix);
 
			 // Transform the screen-space ray start and end to world-space.
			 vec3.transformMat4(
				 hitVars.worldRayStart,
				 hitVars.rayStart,
				 hitVars.projViewMatrix
			 );
			 vec3.transformMat4(
				 hitVars.worldRayEnd,
				 hitVars.rayEnd,
				 hitVars.projViewMatrix
			 );
 
			 // Subtract start from end to get the ray direction and then normalize.
			 vec3.subtract(
				 hitVars.worldRayDir,
				 hitVars.worldRayEnd,
				 hitVars.worldRayStart
			 );
			 vec3.normalize(hitVars.worldRayDir, hitVars.worldRayDir);
 
			 // Go through all the anchors and test for intersections with the ray.
			 for (var i = 0; i < planes.length; i++) {
				 var plane = planes[i];
				 // Get the anchor transform.
				 setMat4FromArray(hitVars.planeMatrix, plane.modelMatrix);
 
				 // Get the position of the anchor in world-space.
				 vec3.set(
					 hitVars.planeCenter,
                     plane.center.x,
                     plane.center.y,
                     plane.center.z
				 );
				 vec3.transformMat4(
					 hitVars.planePosition,
					 hitVars.planeCenter,
					 hitVars.planeMatrix
				 );

				 hitVars.planeAlignment = plane.alignment

				 // Get the plane normal.
				 if (hitVars.planeAlignment === 0) {
                     vec3.set(hitVars.planeNormal, 0, 1, 0);
				 } else {
                     vec3.set(hitVars.planeNormal, hitVars.planeMatrix[4], hitVars.planeMatrix[5], hitVars.planeMatrix[6]);
				 }

				 // Check if the ray intersects the plane.
				 var t = rayIntersectsPlane(
					 hitVars.planeNormal,
					 hitVars.planePosition,
					 hitVars.worldRayStart,
					 hitVars.worldRayDir
				 );
 
				 // if t < 0, there is no intersection.
				 if (t < 0) {
					 continue;
				 }
 
				 // Calculate the actual intersection point.
				 vec3.scale(hitVars.planeIntersection, hitVars.worldRayDir, t);
				 vec3.add(
					 hitVars.planeIntersection,
					 hitVars.worldRayStart,
					 hitVars.planeIntersection
				 );
				 // Get the plane extents (extents are in plane local space).
				 vec3.set(hitVars.planeExtent, plane.extent[0], 0, plane.extent[1]);
 
				 /*
					 ///////////////////////////////////////////////
					 // Test by converting extents to world-space.
					 // TODO: get this working to avoid matrix inversion in method below.
 
					 // Get the rotation component of the anchor transform.
					 mat4.getRotation(hitVars.planeQuaternion, hitVars.planeMatrix);
 
					 // Convert the extent into world space.
					 vec3.transformQuat(
					 hitVars.planeExtent, hitVars.planeExtent, hitVars.planeQuaternion);
 
					 // Check if intersection is outside of the extent of the anchor.
					 if (Math.abs(hitVars.planeIntersection[0] - hitVars.planePosition[0]) > hitVars.planeExtent[0] / 2) {
					 continue;
					 }
					 if (Math.abs(hitVars.planeIntersection[2] - hitVars.planePosition[2]) > hitVars.planeExtent[2] / 2) {
					 continue;
					 }
					 ////////////////////////////////////////////////
					 */
 
				 ////////////////////////////////////////////////
				 mat4.getRotation(hitVars.planeQuaternion, hitVars.planeMatrix)

				 // Test by converting intersection into plane-space.

				 mat4.invert(hitVars.planeMatrix, hitVars.planeMatrix);
				 vec3.transformMat4(
					 hitVars.planeIntersectionLocal,
					 hitVars.planeIntersection,
					 hitVars.planeMatrix
				 );
 
				 // Check if intersection is outside of the extent of the anchor.
				 // Tolerance is added to match the behavior of the native hitTest call.
				 var tolerance = 0.0075;
				 if (
					 Math.abs(hitVars.planeIntersectionLocal[0]) >
					 hitVars.planeExtent[0] / 2 + tolerance
				 ) {
					 continue;
				 }
				 if (
					 Math.abs(hitVars.planeIntersectionLocal[2]) >
					 hitVars.planeExtent[2] / 2 + tolerance
				 ) {
					 continue;
				 }
 
				 ////////////////////////////////////////////////
 
				 // The intersection is valid - create a matrix from hit position.
				 //mat4.fromTranslation(hitVars.planeHit, hitVars.planeIntersection);
                 mat4.fromRotationTranslation(hitVars.planeHit, hitVars.planeQuaternion, hitVars.planeIntersection);
				var hit = new VRHit();
				 for (var j = 0; j < 16; j++) {
					 hit.modelMatrix[j] = hitVars.planeHit[j];
				 }
				 hit.i = i;
				 hits.push(hit);
			 }
 
			 // Sort the hits by distance.
			 hits.sort(sortFunction);
			 return hits;
		 };

		 })();
	}

	static GetOrCreate(options=null){
		if(typeof ARKitWrapper.GLOBAL_INSTANCE === 'undefined'){
			ARKitWrapper.GLOBAL_INSTANCE = new ARKitWrapper()
			options = (options && typeof(options) == 'object') ? options : {}
			let defaultUIOptions = {
				browser: true,
				points: true,
				focus: false,
				rec: true,
				rec_time: true,
				mic: false,
				build: false,
				plane: true,
				warnings: true,
				anchors: false,
				debug: true,
				statistics: false
			}
			let uiOptions = (typeof(options.ui) == 'object') ? options.ui : {}
			options.ui = Object.assign(defaultUIOptions, uiOptions)
			ARKitWrapper.GLOBAL_INSTANCE._sendInit(options)
		} 
		return ARKitWrapper.GLOBAL_INSTANCE
	}

	static HasARKit(){
		return typeof window.webkit !== 'undefined'
	}

	get deviceId(){ return this._deviceId } // The ARKit provided device ID
	get isWatching(){ return this._isWatching } // True if ARKit is sending frame data
	get isInitialized(){ return this._isInitialized } // True if this instance has received the onInit callback from ARKit
	get hasData(){ return this._rawARData !== null } // True if this instance has received data via onWatch

	/*
	Useful for waiting for or immediately receiving notice of ARKit initialization
	*/
	waitForInit(){
		return new Promise((resolve, reject) => {
			if(this._isInitialized){
				resolve()
				return
			}
			const callback = () => {
				this.removeEventListener(ARKitWrapper.INIT_EVENT, callback, false)
				resolve()
			}
			this.addEventListener(ARKitWrapper.INIT_EVENT, callback, false)
		})
	}

	/*
	getData looks into the most recent ARKit data (as received by onWatch) for a key
	returns the key's value or null if it doesn't exist or if a key is not specified it returns all data
	*/
	getData(key=null){
		if (key === null){
			return this._rawARData
		}
		if(this._rawARData && typeof this._rawARData[key] !== 'undefined'){
			return this._rawARData[key]
		}
		return null
	}	

	/*
	returns
		{
			uuid: DOMString,
			transform: [4x4 column major affine transform]
		}

	return null if object with `uuid` is not found
	*/
	getObject(uuid){
		if (!this._isInitialized){
			return null
		}
		const objects = this.getKey('objects')
		if(objects === null) return null
		for(const object of objects){
			if(object.uuid === uuid){
				return object
			}
		}
		return null
	}

	/*
	Sends a hitTest message to ARKit to get hit testing results
	x, y - screen coordinates normalized to 0..1 (0,0 is at top left and 1,1 is at bottom right)
	types - bit mask of hit testing types
	
	Returns a Promise that resolves to a (possibly empty) array of hit test data:
	[
		{
			type: 1,							// A packed mask of types ARKitWrapper.HIT_TEST_TYPE_*
			distance: 1.0216870307922363,		// The distance in meters from the camera to the detected anchor or feature point.
			world_transform:  [float x 16],		// The pose of the hit test result relative to the world coordinate system. 
			local_transform:  [float x 16],		// The pose of the hit test result relative to the nearest anchor or feature point

			// If the `type` is `HIT_TEST_TYPE_ESTIMATED_HORIZONTAL_PLANE`, `HIT_TEST_TYPE_EXISTING_PLANE`, or `HIT_TEST_TYPE_EXISTING_PLANE_USING_EXTENT` (2, 8, or 16) it will also have anchor data:
			anchor_center: { x:float, y:float, z:float },
			anchor_extent: { x:float, y:float },
			uuid: string,

			// If the `type` is `HIT_TEST_TYPE_EXISTING_PLANE` or `HIT_TEST_TYPE_EXISTING_PLANE_USING_EXTENT` (8 or 16) it will also have an anchor transform:
			anchor_transform: [float x 16]
		},
		...
	]
	@see https://developer.apple.com/documentation/arkit/arframe/2875718-hittest
	*/
	hitTest(x, y, types=ARKitWrapper.HIT_TEST_TYPE_ALL){
		return new Promise((resolve, reject) => {
			if (!this._isInitialized){
				reject(new Error('ARKit is not initialized'));
				return;
			}
			window.webkit.messageHandlers.hitTest.postMessage({
				x: x,
				y: y,
				type: types,
				callback: this._createPromiseCallback('hitTest', resolve)
			})
		})
	}

	/*
	Sends an addAnchor message to ARKit
	Returns a promise that returns:
	{
		uuid - the anchor's uuid,
		transform - anchor transformation matrix
	}
	*/
    addAnchor(uid, transform){
		return new Promise((resolve, reject) => {
			if (!this._isInitialized){
				reject(new Error('ARKit is not initialized'));
				return;
			}
			window.webkit.messageHandlers.addAnchor.postMessage({
				uuid: uid,
				transform: transform,
				callback: this._createPromiseCallback('addAnchor', resolve)
			})
		})
	}

	removeAnchor(uid) {
		window.webkit.messageHandlers.removeAnchors.postMessage([uid])
	}

	/*
	 * ask for an image anchor.
	 * 
	 * Provide a uid for the anchor that will be created.
	 * Supply the image in an ArrayBuffer, typedArray or ImageData
	 * width and height are in meters 
	 */
    createImageAnchor(uid, buffer, width, height, physicalWidthInMeters) {
		return new Promise((resolve, reject) => {
            if (!this._isInitialized){
                reject(new Error('ARKit is not initialized'));
                return;
            }

            let b64 = base64.encode(buffer);

            window.webkit.messageHandlers.createImageAnchor.postMessage({
                uid: uid,
                buffer: b64,
                imageWidth: width,
                imageHeight: height,
                physicalWidth: physicalWidthInMeters,
				callback: this._createPromiseCallback('createImageAnchor', resolve)
            })
		})
	}

    /***
	 * activateDetectionImage activates an image and waits for the detection
     * @param uid The UID of the image to activate, previously created via "createImageAnchor"
     * @returns {Promise<any>} a promise that will be resolved when ARKit detects the image, or an error otherwise
     */
	activateDetectionImage(uid) {
        return new Promise((resolve, reject) => {
            if (!this._isInitialized){
                reject(new Error('ARKit is not initialized'));
                return;
            }

            window.webkit.messageHandlers.activateDetectionImage.postMessage({
                uid: uid,
                callback: this._createPromiseCallback('activateDetectionImage', resolve)
            })
        })
	}

	/* 
	RACE CONDITION:  call stop, then watch:  stop does not set isWatching false until it gets a message back from the app,
	so watch will return and not issue a watch command.   May want to set isWatching false immediately?
	*/

	/*
	If this instance is currently watching, send the stopAR message to ARKit to request that it stop sending data on onWatch
	*/
	stop(){
		return new Promise((resolve, reject) => {
			if (!this._isWatching){
				resolve();
				return;
			}
			console.log('----STOP');
			window.webkit.messageHandlers.stopAR.postMessage({
				callback: this._createPromiseCallback('stop', resolve)
			})
		})
	}
	
	/*
	If not already watching, send a watchAR message to ARKit to request that it start sending per-frame data to onWatch
	options: the options map for ARKit
		{
			location: boolean,
			camera: boolean,
			objects: boolean,
			light_intensity: boolean,
			computer_vision_data: boolean
		}
	*/

	watch(options=null){
		if (!this._isInitialized){
			return false
		}
		if(this._isWatching){
			return true
		}
		this._isWatching = true

		var newO = Object.assign({}, this._defaultOptions);

		if(options != null) {
			newO = Object.assign(newO, options)
		}

		// option to WebXRView is different than the WebXR option
		if (newO.videoFrames) {
			delete newO.videoFrames
			newO.computer_vision_data = true;
		}

		const data = {
			options: newO,
			callback: this._globalCallbacksMap.onWatch
		}
		console.log('----WATCH');
		window.webkit.messageHandlers.watchAR.postMessage(data)
		return true
	}

	/*
	Sends a setUIOptions message to ARKit to set ui options (show or hide ui elements)
	options: {
		browser: boolean,
		points: boolean,
		focus: boolean,
		rec: boolean,
		rec_time: boolean,
		mic: boolean,
		build: boolean,
		plane: boolean,
		warnings: boolean,
		anchors: boolean,
		debug: boolean,
		statistics: boolean
	}
	*/
	setUIOptions(options){
		window.webkit.messageHandlers.setUIOptions.postMessage(options)
	}

	/*
	Called during instance creation to send a message to ARKit to initialize and create a device ID
	Usually results in ARKit calling back to _onInit with a deviceId
	options: {
		ui: {
			browser: boolean,
			points: boolean,
			focus: boolean,
			rec: boolean,
			rec_time: boolean,
			mic: boolean,
			build: boolean,
			plane: boolean,
			warnings: boolean,
			anchors: boolean,
			debug: boolean,
			statistics: boolean
		}
	}
	*/
	_sendInit(options){
		// get device id
		console.log('----INIT');
		window.webkit.messageHandlers.initAR.postMessage({
			options: options,
			callback: this._globalCallbacksMap.onInit
		})
	}

	/*
	Callback for when ARKit is initialized
	deviceId: DOMString with the AR device ID
	*/
	_onInit(deviceId){
		this._deviceId = deviceId
		this._isInitialized = true
		try {
			this.dispatchEvent(new CustomEvent(ARKitWrapper.INIT_EVENT, {
				source: this
			}))
        } catch(e) {
            console.error('INIT_EVENT event error', e)
        }
	}

	/*
	_onWatch is called from native ARKit on each frame:
		data:
		{
			"timestamp": time value
			"light_intensity": value
			"camera_view":[4x4 column major affine transform matrix],
			"projection_camera":[4x4 projection matrix],
			"newObjects": [
				{
					uuid: DOMString (unique UID),
					transform: [4x4 column major affine transform],
					plane_center: {x, y, z},  // only on planes
					plane_center: {x, y, z}	// only on planes, where x/z are used,
				}, ...
			],
			"removeObjects": [
				uuid: DOMString (unique UID), ...
			]
			"objects":[
				{
					uuid: DOMString (unique UID),
					transform: [4x4 column major affine transform]
					plane_center: {x, y, z},  // only on planes
					plane_center: {x, y, z}	// only on planes, where x/z are used,
				}, ...
			]
		}

	*/

	_onWatch(data){
		this._rawARData = data
		try {
			this.dispatchEvent(new CustomEvent(ARKitWrapper.WATCH_EVENT, {
				source: this,
				detail: this._rawARData
			}))
        } catch(e) {
            console.error('WATCH_EVENT event error', e)
        }
		this.timestamp = this._adjustARKitTime(data.timestamp)
		this.lightIntensity = data.light_intensity;
		this.viewMatrix_ = data.camera_view;
		this.projectionMatrix_ = data.projection_camera;

		if(data.newObjects.length){
			for (let i = 0; i < data.newObjects.length; i++) {
				const element = data.newObjects[i];
				if(element.plane_center){
					this.planes_.set(element.uuid, {
						id: element.uuid,
						center: element.plane_center,
						extent: [element.plane_extent.x, element.plane_extent.z],
						modelMatrix: element.transform,
						alignment: element.plane_alignment
					});
				}else{
					this.anchors_.set(element.uuid, {
						id: element.uuid,
						modelMatrix: element.transform
					});
				}
			}
		}

		if(data.removedObjects.length){
			for (let i = 0; i < data.removedObjects.length; i++) {
				const element = data.removedObjects[i];
				if(this.planes_.get(element)){
					this.planes_.delete(element);
				}else{
					this.anchors_.delete(element);
				}
			}
		}

		if(data.objects.length){
			for (let i = 0; i < data.objects.length; i++) {
				const element = data.objects[i];
				if(element.plane_center){
					var plane = this.planes_.get(element.uuid);
					if(!plane){
						this.planes_.set(element.uuid, {
							id: element.uuid,
							center: element.plane_center,
							extent: [element.plane_extent.x, element.plane_extent.z],
							modelMatrix: element.transform,
							alignment: element.plane_alignment
						});
					} else {
						plane.center = element.plane_center;
						plane.extent[0] = element.plane_extent.x
						plane.extent[1] = element.plane_extent.y
						plane.modelMatrix = element.transform;
						plane.alignment = element.plane_alignment
					}
				}else{
					var anchor = this.anchors_.get(element.uuid);
					if(!anchor){
						this.anchors_.set(element.uuid, {
							id: element.uuid,
							modelMatrix: element.transform
						});
					}else{
						anchor.modelMatrix = element.transform;
					}
				}
			}
		}
	}

	/*
	Callback from ARKit for when sending per-frame data to onWatch is stopped
	*/
	_onStop(){
		this._isWatching = false
	}

	_createPromiseCallback(action, resolve){
		const callbackName = this._generateCallbackUID(action);
		window[callbackName] = (data) => {
			delete window[callbackName]
			const wrapperCallbackName = '_on' + action[0].toUpperCase() +
				action.slice(1);
			if (typeof(this[wrapperCallbackName]) == 'function'){
				this[wrapperCallbackName](data);
			}
			resolve(data)
		}
		return callbackName;
	}

	_generateCallbackUID(prefix){
		return 'arkitCallback_' + prefix + '_' + new Date().getTime() + 
			'_' + Math.floor((Math.random() * Number.MAX_SAFE_INTEGER))
	}

	/*
	The ARKit iOS app depends on several callbacks on `window`. This method sets them up.
	They end up as window.arkitCallback? where ? is an integer.
	You can map window.arkitCallback? to ARKitWrapper instance methods using _globalCallbacksMap
	*/
	_generateGlobalCallback(callbackName, num){
		const name = 'arkitCallback' + num
		this._globalCallbacksMap[callbackName] = name
		const self = this
		window[name] = function(deviceData){
			self['_' + callbackName](deviceData)
		}
	}

	/*
	ev.detail contains:
		{
		  "frame": {
			"buffers": [ // Array of base64 encoded string buffers
			  {
				"size": {
				  "width": 320,
				  "height": 180,
				  "bytesPerRow": 320,
				  "bytesPerPixel": 1
				},
				"buffer": "e3x...d7d"   /// convert to Uint8 buffer in code below
			  },
			  {
				"size": {
//				  "width": 160,
				  "height": 90,
				  "bytesPerRow": 320,
				  "bytesPerPixel": 2
				},
				"buffer": "ZZF.../fIJ7"  /// convert to Uint8 buffer in code below
			  }
			],
			"pixelFormatType": "kCVPixelFormatType_420YpCbCr8BiPlanarFullRange",
			"pixelFormat": "YUV420P",  /// Added in the code below, clients should ignore pixelFormatType
			"timestamp": 337791
		  },
		  "camera": {
			"cameraIntrinsics": [3x3 matrix],
				fx 0   px
				0  fy  py
				0  0   1
				fx and fy are the focal length in pixels.
				px and py are the coordinates of the principal point in pixels.
				The origin is at the center of the upper-left pixel.

			"cameraImageResolution": {
			  "width": 1280,
			  "height": 720
			},
			"viewMatrix": [4x4 camera view matrix],
			"arCamera": true;
		    "cameraOrientation": 0,  // orientation in degrees of image relative to display
                            // normally 0, but on video mixed displays that keep the camera in a fixed 
                            // orientation, but rotate the UI, like on some phones, this will change
                            // as the display orientation changes
			"interfaceOrientation": 3,
				// 0 UIDeviceOrientationUnknown
				// 1 UIDeviceOrientationPortrait
				// 2 UIDeviceOrientationPortraitUpsideDown
				// 3 UIDeviceOrientationLandscapeRight
				// 4 UIDeviceOrientationLandscapeLeft
			"projectionMatrix": [4x4 camera projection matrix]
		  }
		}
	 */
	_onComputerVisionData(detail) {
		// convert the arrays
		if (!detail) {
			console.error("detail passed to _onComputerVisionData is null")
			this._requestComputerVisionData() 
			return;
		}
		// convert the arrays
		if (!detail.frame || !detail.frame.buffers || detail.frame.buffers.length <= 0) {
			console.error("detail passed to _onComputerVisionData is bad, no buffers")
			this._requestComputerVisionData() 
			return;
		}

		// the orientation matrix we get is relative to the current view orientation.  
		// We need to add an orientation around z, so that we have the orientation that goes from 
		// camera frame to the current view orientation, since the camera is fixed and the view
		// changes as we rotate the device. 
		//
		// We also set a cameraOrientation value for the orientation of the camera relative to the
		// display.  This will be particular to video-mixed-AR where the camera is the video on the
		// screen, since any other setup would need to use the full orientation (and probably 
		// wouldn't be rotating the content / UI)
		detail.camera.arCamera = true;
		var orientation = detail.camera.interfaceOrientation;
		detail.camera.viewMatrix = detail.camera.inverse_viewMatrix;
		// mat4.copy(this._mTemp, detail.camera.viewMatrix)
        switch (orientation) {
			case 1: 
				// rotate by -90;
				detail.camera.cameraOrientation = -90;
				// mat4.multiply(detail.camera.viewMatrix, this._mTemp, this._m90neg)
				break;

			case 2: 
				// rotate by 90;
				detail.camera.cameraOrientation = 90;
				// mat4.multiply(detail.camera.viewMatrix, this._mTemp, this._m90)
				break;
			case 3: 
				detail.camera.cameraOrientation = 0;
			// rotate by nothing
				break;
			case 4: 
				// rotate by 180;
				detail.camera.cameraOrientation = 180;
				// mat4.multiply(detail.camera.viewMatrix, this._mTemp, this._m180)
				break;
		}
		// convert buffers in place
		//var buffers = detail.frame.buffers;

		// if there are too many cached array buffers, drop the unneeded ones
		// if (this._ab.length > buffers.length) {
		// 	this._ab = this._ab.slice(0, buffer.length)
		// }
		
		// if (this._worker) {
		// 	detail.ab = this._ab;
		// 	if (this._ab) {
		// 		this._worker.postMessage(detail, this._ab);
		// 	} else {
		// 		this._worker.postMessage(detail);
		// 	}
		// } else {
			// for (var i = 0; i < buffers.length; i++) {
			// 	// gradually increase the size of the ab[] array to hold the temp buffers, 
			// 	// and add null so it gets allocated properly
			// 	if (this._ab.length <= i) {
			// 		this._ab.push(null)
			// 	}
			// 	var bufflen = buffers[i].buffer.length;
			// 	this._ab[i] = buffers[i].buffer = base64.decodeArrayBuffer(buffers[i].buffer, this._ab[i]);
			// 	var buffersize = buffers[i].buffer.byteLength;
			// 	var imagesize = buffers[i].size.height * buffers[i].size.bytesPerRow;
			// }
			switch(detail.frame.pixelFormatType) {
				case "kCVPixelFormatType_420YpCbCr8BiPlanarFullRange":
					detail.frame.pixelFormat = "YUV420P";
					break;
				default:
					detail.frame.pixelFormat = detail.frame.pixelFormatType; 
					break;
			}

			var xrVideoFrame = new XRVideoFrame(detail.frame.buffers, detail.frame.pixelFormat, this._adjustARKitTime(detail.frame.timestamp), detail.camera )
			try {
				this.dispatchEvent(
					new CustomEvent(
						ARKitWrapper.COMPUTER_VISION_DATA,
						{
							source: this,
							detail: xrVideoFrame
						}
					)
				)
			} catch(e) {
				console.error('COMPUTER_VISION_DATA event error', e)
			}
			//}	
	}

	/*
	Requests ARKit a new set of buffers for computer vision processing
	 */
    _requestComputerVisionData() {
        window.webkit.messageHandlers.requestComputerVisionData.postMessage({})
	}

	/*
	Requests ARKit to start sending CV data (data is send automatically when requested and approved)
	 */
    _startSendingComputerVisionData() {
        window.webkit.messageHandlers.startSendingComputerVisionData.postMessage({})
	}

	/*
	Requests ARKit to stop sending CV data
	 */
    _stopSendingComputerVisionData() {
        window.webkit.messageHandlers.stopSendingComputerVisionData.postMessage({})
	}


	// _buildWorkerBlob() {
	// 	var blobURL = URL.createObjectURL( new Blob([ '(',

	// 	function(){
	// 		// could not get workers working, so am not using this.
	// 		//
	// 		// Tried to use Transferable ArrayBuffers but kept getting DOM Error 25. 
	// 		// 

	// 		var b64 = {
	// 			_keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

	// 			/* will return a  Uint8Array type */
	// 			decodeArrayBuffer: function(input, buffer) {
	// 				var bytes = (input.length/4) * 3;
	// 				if (!buffer || buffer.byteLength != bytes) {
	// 					// replace the buffer with a new, appropriately sized one
	// 					buffer = new ArrayBuffer(bytes);
	// 				}
	// 				this.decode(input, buffer);
					
	// 				return buffer;
	// 			},

	// 			removePaddingChars: function(input){
	// 				var lkey = this._keyStr.indexOf(input.charAt(input.length - 1));
	// 				if(lkey == 64){
	// 					return input.substring(0,input.length - 1);
	// 				}
	// 				return input;
	// 			},

	// 			decode: function(input, arrayBuffer) {
	// 				//get last chars to see if are valid
	// 				input = this.removePaddingChars(input);
	// 				input = this.removePaddingChars(input);

	// 				var bytes = parseInt((input.length / 4) * 3, 10);
					
	// 				var uarray;
	// 				var chr1, chr2, chr3;
	// 				var enc1, enc2, enc3, enc4;
	// 				var i = 0;
	// 				var j = 0;
					
	// 				if (arrayBuffer)
	// 					uarray = new Uint8Array(arrayBuffer);
	// 				else
	// 					uarray = new Uint8Array(bytes);
					
	// 				input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
					
	// 				for (i=0; i<bytes; i+=3) {	
	// 					//get the 3 octects in 4 ascii chars
	// 					enc1 = this._keyStr.indexOf(input.charAt(j++));
	// 					enc2 = this._keyStr.indexOf(input.charAt(j++));
	// 					enc3 = this._keyStr.indexOf(input.charAt(j++));
	// 					enc4 = this._keyStr.indexOf(input.charAt(j++));

	// 					chr1 = (enc1 << 2) | (enc2 >> 4);
	// 					chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
	// 					chr3 = ((enc3 & 3) << 6) | enc4;

	// 					uarray[i] = chr1;			
	// 					if (enc3 != 64) uarray[i+1] = chr2;
	// 					if (enc4 != 64) uarray[i+2] = chr3;
	// 				}

	// 				return uarray;	
	// 			}
	// 		}

	// 		self.addEventListener('message',  function(event){
	// 			var frame = event.data.frame
	// 			var camera = event.data.camera

	// 			var ab = event.data.ab;

	// 			// convert buffers in place
	// 			var buffers = frame.buffers;
	// 			var buffs = []
	// 			// if there are too many cached array buffers, drop the unneeded ones
	// 			if (ab.length > buffers.length) {
	// 				ab = ab.slice(0, buffer.length)
	// 			}
	// 			for (var i = 0; i < buffers.length; i++) {
	// 				// gradually increase the size of the ab[] array to hold the temp buffers, 
	// 				// and add null so it gets allocated properly
	// 				if (ab.length <= i) {
	// 					ab.push(null)
	// 				}
	// 				ab[i] = buffers[i].buffer = b64.decodeArrayBuffer(buffers[i].buffer, ab[i]);
	// 				buffs.push(buffers[i].buffer)
	// 			}
	// 			switch(frame.pixelFormatType) {
	// 				case "kCVPixelFormatType_420YpCbCr8BiPlanarFullRange":
	// 					frame.pixelFormat = "YUV420P";
	// 					break;
	// 				default:
	// 					frame.pixelFormat = frame.pixelFormatType; 
	// 					break;
	// 			}

	// 			postMessage(event.data, buffs);
	// 		});
	// 	}.toString(),
	// 	')()' ], { type: 'application/javascript' } ) )
		
	// 	return( blobURL );			
	// }
	
}

// ARKitWrapper event names:
ARKitWrapper.INIT_EVENT = 'arkit-init'
ARKitWrapper.WATCH_EVENT = 'arkit-watch'
ARKitWrapper.RECORD_START_EVENT = 'arkit-record-start'
ARKitWrapper.RECORD_STOP_EVENT = 'arkit-record-stop'
ARKitWrapper.DID_MOVE_BACKGROUND_EVENT = 'arkit-did-move-background'
ARKitWrapper.WILL_ENTER_FOREGROUND_EVENT = 'arkit-will-enter-foreground'
ARKitWrapper.INTERRUPTED_EVENT = 'arkit-interrupted'
ARKitWrapper.INTERRUPTION_ENDED_EVENT = 'arkit-interruption-ended'
ARKitWrapper.SHOW_DEBUG_EVENT = 'arkit-show-debug'
ARKitWrapper.WINDOW_RESIZE_EVENT = 'arkit-window-resize'
ARKitWrapper.ON_ERROR = 'on-error'
ARKitWrapper.AR_TRACKING_CHANGED = 'ar_tracking_changed'
ARKitWrapper.COMPUTER_VISION_DATA = 'cv_data'
ARKitWrapper.USER_GRANTED_COMPUTER_VISION_DATA = 'user-granted-cv-data'
ARKitWrapper.USER_GRANTED_WORLD_SENSING_DATA = 'user-granted-world-sensing-data'

// ARKit Detection Image Orientations
ARKitWrapper.ORIENTATION_UP = 1        			// 0th row at top,    0th column on left   - default orientation
ARKitWrapper.ORIENTATION_UP_MIRRORED = 2    	// 0th row at top,    0th column on right  - horizontal flip
ARKitWrapper.ORIENTATION_DOWN = 3          		// 0th row at bottom, 0th column on right  - 180 deg rotation
ARKitWrapper.ORIENTATION_DOWN_MIRRORED = 4  	// 0th row at bottom, 0th column on left   - vertical flip
ARKitWrapper.ORIENTATION_LEFT_MIRRORED = 5  	// 0th row on left,   0th column at top
ARKitWrapper.ORIENTATION_RIGHT = 6         		// 0th row on right,  0th column at top    - 90 deg CW
ARKitWrapper.ORIENTATION_RIGHT_MIRRORED = 7 	// 0th row on right,  0th column on bottom
ARKitWrapper.ORIENTATION_LEFT = 8				// 0th row on left,   0th column at bottom - 90 deg CCW

// hit test types
ARKitWrapper.HIT_TEST_TYPE_FEATURE_POINT = 1
ARKitWrapper.HIT_TEST_TYPE_ESTIMATED_HORIZONTAL_PLANE = 2
ARKitWrapper.HIT_TEST_TYPE_ESTIMATED_VERTICAL_PLANE = 4
ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE = 8
ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE_USING_EXTENT = 16
ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE_USING_GEOMETRY = 32

ARKitWrapper.HIT_TEST_TYPE_ALL = ARKitWrapper.HIT_TEST_TYPE_FEATURE_POINT |
	ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE |
	ARKitWrapper.HIT_TEST_TYPE_ESTIMATED_HORIZONTAL_PLANE |
	ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE_USING_EXTENT

ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANES = ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE |
	ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE_USING_EXTENT

ARKitWrapper.ANCHOR_TYPE_PLANE = 'plane'
ARKitWrapper.ANCHOR_TYPE_FACE = 'face'
ARKitWrapper.ANCHOR_TYPE_ANCHOR = 'anchor'
ARKitWrapper.ANCHOR_TYPE_IMAGE = 'image'