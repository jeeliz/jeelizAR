import XRAnchor from './XRAnchor.js'
import ARKitWrapper from './platform/ARKitWrapper.js'
import MatrixMath from './fill/MatrixMath.js'

/*
XRPresentationFrame provides all of the values needed to render a single frame of an XR scene to the XRDisplay.
*/
export default class XRPresentationFrame {
	constructor(session, timestamp){
		this._session = session
		this._timestamp = this._session.reality._getTimeStamp(timestamp);
	}

	get session(){ return this._session }

	get views(){
		//readonly attribute FrozenArray<XRView> views;
		return this._session._display._views
	}

	get hasPointCloud(){
		//readonly attribute boolean hasPointCloud;
		return false
	}

	get pointCloud(){
		//readonly attribute XRPointCloud? pointCloud;
		return null
	}

	get hasLightEstimate(){
		//readonly attribute boolean hasLightEstimate;
		return this._session.reality._getHasLightEstimate();
	}

	get lightEstimate(){
		//readonly attribute XRLightEstimate? lightEstimate;
		return this._session.reality._getLightAmbientIntensity();
	}

	get timestamp () {
		return this._timestamp;
	}
	/*
	Returns an array of known XRAnchor instances. May be empty.
	*/
	get anchors(){
		//readonly attribute sequence<XRAnchor> anchors;
		let results = []
		for(let value of this._session.reality._anchors.values()){
			results.push(value)
		}
		return results
	}

	/*
	Create an anchor at a specific position defined by XRAnchor.coordinates
	*/
	addAnchor(coordinateSystem, position=[0,0,0], orientation=[0,0,0,1]){
		//DOMString? addAnchor(XRCoordinateSystem, position, orientation);
		let poseMatrix = MatrixMath.mat4_fromRotationTranslation(new Float32Array(16), orientation, position)
		MatrixMath.mat4_multiply(poseMatrix, coordinateSystem.getTransformTo(this._session._display._trackerCoordinateSystem), poseMatrix)
		let anchorCoordinateSystem = new XRCoordinateSystem(this._session._display, XRCoordinateSystem.TRACKER)
		anchorCoordinateSystem._relativeMatrix = poseMatrix
		return this._session.reality._addAnchor(new XRAnchor(anchorCoordinateSystem), this._session.display)
	}

	// normalized screen x and y are in range 0..1, with 0,0 at top left and 1,1 at bottom right
	findAnchor(normalizedScreenX, normalizedScreenY, options=null){
		// Promise<XRAnchorOffset?> findAnchor(float32, float32); // cast a ray to find or create an anchor at the first intersection in the Reality
		return this._session.reality._findAnchor(normalizedScreenX, normalizedScreenY, this._session.display, options)
	}

	hitTestNoAnchor(normalizedScreenX, normalizedScreenY){
		// Array<VRHit> hitTestNoAnchor(float32, float32); // cast a ray to find all plane intersections in the Reality
		return this._session.reality._hitTestNoAnchor(normalizedScreenX, normalizedScreenY, this._session.display)
	}

	/*
	Find an XRAnchorOffset that is at floor level below the current head pose
	uid will be the resulting anchor uid (if any), or if null one will be assigned
	*/
	findFloorAnchor(uid=null){
		// Promise<XRAnchorOffset?> findFloorAnchor();
		return this._session.reality._findFloorAnchor(this._session.display, uid)
	}

	removeAnchor(uid){
		// void removeAnchor(DOMString uid);
		return this._session.reality._removeAnchor(uid)
	}

	/*
	Returns an existing XRAnchor or null if uid is unknown
	*/
	getAnchor(uid){
		// XRAnchor? getAnchor(DOMString uid);
		return this._session.reality._getAnchor(uid)
	}

	getCoordinateSystem(...types){
		// XRCoordinateSystem? getCoordinateSystem(...XRFrameOfReferenceType types); // Tries the types in order, returning the first match or null if none is found
		return this._session._getCoordinateSystem(...types)
	}

	getDisplayPose(coordinateSystem){
		// XRViewPose? getDisplayPose(XRCoordinateSystem coordinateSystem);
		switch(coordinateSystem._type){
			case XRCoordinateSystem.HEAD_MODEL:
				return this._session._display._headPose
			case XRCoordinateSystem.EYE_LEVEL:
				return this._session._display._eyeLevelPose
			default:
				return null
		}
	}
}

// hit test types
XRPresentationFrame.HIT_TEST_TYPE_FEATURE_POINT = ARKitWrapper.HIT_TEST_TYPE_FEATURE_POINT
XRPresentationFrame.HIT_TEST_TYPE_ESTIMATED_HORIZONTAL_PLANE = ARKitWrapper.HIT_TEST_TYPE_ESTIMATED_HORIZONTAL_PLANE
XRPresentationFrame.HIT_TEST_TYPE_ESTIMATED_VERTICAL_PLANE = ARKitWrapper.HIT_TEST_TYPE_ESTIMATED_VERTICAL_PLANE
XRPresentationFrame.HIT_TEST_TYPE_EXISTING_PLANE = ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE
XRPresentationFrame.HIT_TEST_TYPE_EXISTING_PLANE_USING_EXTENT = ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE_USING_EXTENT
XRPresentationFrame.HIT_TEST_TYPE_EXISTING_PLANE_USING_GEOMETRY = ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE_USING_GEOMETRY

XRPresentationFrame.HIT_TEST_TYPE_ALL = ARKitWrapper.HIT_TEST_TYPE_FEATURE_POINT |
	ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE |
	ARKitWrapper.HIT_TEST_TYPE_ESTIMATED_HORIZONTAL_PLANE |
	ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE_USING_EXTENT

XRPresentationFrame.HIT_TEST_TYPE_EXISTING_PLANES = ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE |
	ARKitWrapper.HIT_TEST_TYPE_EXISTING_PLANE_USING_EXTENT