import EventHandlerBase from './fill/EventHandlerBase.js'

/*
A Reality represents a view of the world, be it the real world via sensors or a virtual world that is rendered with WebGL or WebGPU.
*/
export default class Reality extends EventHandlerBase {
	constructor(xr, name, isShared, isPassthrough){
		super()
		this._xr = xr
		this._name = name
		this._isShared = isShared
		this._isPassthrough = isPassthrough
		this._anchors = new Map()
	}

	get name(){ return this._name }

	get isShared(){ return this._isShared }

	get isPassthrough(){ return this._isPassthrough }

	getCoordinateSystem(...types){
		//XRCoordinateSystem? getCoordinateSystem(XRFrameOfReferenceType type, ...); // Tries the types in order, returning the first match or null if none is found
		throw new Error('Not implemented')
	}

	/*
	Called when at least one active XRSession is using this Reality
	*/
	_start(parameters){
		throw new Error('Exending classes should implement _start')
	}

	/*
	Called when no more active XRSessions are using this Reality
	*/
	_stop(){
		throw new Error('Exending classes should implement _stop')
	}

	/*
	Request another video frame be generated, typically from video-mixed Realities.
	*/
	_requestVideoFrame() {
	}

	/*
	Start or stop video frames
	*/
	_stopVideoFrames() {
	}

	_startVideoFrames() {
	}
	
	/*
	Called by a session before it hands a new XRPresentationFrame to the app
	*/
	_handleNewFrame(){}

	/*
	Create an anchor hung in space
	*/
	_addAnchor(anchor, display){
		// returns DOMString anchor UID
		throw new Error('Exending classes should implement _addAnchor')
	}

	/*
	Create an anchor attached to a surface, as found by a ray
	returns a Promise that resolves either to an AnchorOffset or null if the hit test failed
	normalized screen x and y are in range 0..1, with 0,0 at top left and 1,1 at bottom right
	*/
	_findAnchor(normalizedScreenX, normalizedScreenY, display){
		throw new Error('Exending classes should implement _findAnchor')
	}

    _createImageAnchor(uid, buffer, width, height, physicalWidthInMeters) {
        throw new Error('Exending classes should implement _createImageAnchor')
	}

    activateDetectionImage(uid, display) {
        throw new Error('Exending classes should implement _activateDetectionImage')
    }

	/*
	Find an XRAnchorOffset that is at floor level below the current head pose
	returns a Promise that resolves either to an AnchorOffset or null if the floor level is unknown
	*/
	_findFloorAnchor(display, uid=null){
		throw new Error('Exending classes should implement _findFloorAnchor')
	}

	_getAnchor(uid){
		return this._anchors.get(uid) || null
	}

	_removeAnchor(uid){
		// returns void
		throw new Error('Exending classes should implement _removeAnchor')
	}

	_hitTestNoAnchor(normalizedScreenX, normalizedScreenY, display){
		throw new Error('Exending classes should implement _hitTestNoAnchor')
	}

	_getLightAmbientIntensity(){
		throw new Error('Exending classes should implement _getLightAmbientIntensity')
	}

	// attribute EventHandler onchange;
}

Reality.COMPUTER_VISION_DATA = 'cv_data'
Reality.WINDOW_RESIZE_EVENT = 'window-resize'
Reality.NEW_WORLD_ANCHOR = 'world-anchor'
Reality.UPDATE_WORLD_ANCHOR = 'update-world-anchor'
Reality.REMOVE_WORLD_ANCHOR = 'remove-world-anchor'