import Reality from '../Reality.js'

/*
VirtualReality is a Reality that is empty and waiting for fanstastic CG scenes.
*/
export default class VirtualReality extends Reality {
	constructor(xr){
		super(xr, 'Virtual', false, false)
	}

	/*
	Called when at least one active XRSession is using this Reality
	*/
	_start(parameters){
	}

	/*
	Called when no more active XRSessions are using this Reality
	*/
	_stop(){
	}

	/*
	Called by a session before it hands a new XRPresentationFrame to the app
	*/
	_handleNewFrame(){}

	/*
	Create an anchor hung in space
	*/
	_addAnchor(anchor, display){
		this._anchors.set(anchor.uid, anchor)
		return anchor.uid
	}

	/*
	Create an anchor attached to a surface, as found by a ray
	normalized screen x and y are in range 0..1, with 0,0 at top left and 1,1 at bottom right
	*/
	_findAnchor(normalizedScreenX, normalizedScreenY, display, options=null){
		return new Promise((resolve, reject) => {
			resolve(null)
		})
	}

	_removeAnchor(uid){
		this._anchors.delete(uid)
	}

	_hitTestNoAnchor(normalizedScreenX, normalizedScreenY, display){
		return null
	}

	_getHasLightEstimate(){
		return false;
	}

	/*
	Find an XRAnchorOffset that is at floor level below the current head pose
	returns a Promise that resolves either to an AnchorOffset or null if the floor level is unknown
	*/
	_findFloorAnchor(display, uid=null){
		// Copy the head model matrix for the current pose so we have it in the promise below
		const headModelMatrix = new Float32Array(display._headPose.poseModelMatrix)
		return new Promise((resolve, reject) => {
			// For now, just create an anchor at origin level.  Probably want to use stage more intelligently
			headModelMatrix[13] = 0 
			const coordinateSystem = new XRCoordinateSystem(display, XRCoordinateSystem.TRACKER)
			coordinateSystem._relativeMatrix = headModelMatrix
			const anchor = new XRAnchor(coordinateSystem, uid)
			this._addAnchor(anchor, display)
			resolve(new XRAnchorOffset(anchor.uid))
		})
	}

	_getTimeStamp(timestamp) {
		return timestamp
	}


}