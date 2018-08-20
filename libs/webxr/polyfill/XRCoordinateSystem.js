import MatrixMath from './fill/MatrixMath.js'

/*
XRCoordinateSystem represents the origin of a 3D coordinate system positioned at a known frame of reference.
The XRCoordinateSystem is a string from XRCoordinateSystem.TYPES:

These types are used by the app code when requesting a coordinate system from the session:
- XRCoordinateSystem.HEAD_MODEL: origin is aligned with the pose of the head, as sensed by HMD or handset trackers
- XRCoordinateSystem.EYE_LEVEL: origin is at a fixed distance above the ground

This is an internal type, specific to just this polyfill and not visible to the app code
- XRCoordinateSystem.TRACKER: The origin of this coordinate system is at floor level at or below the origin of the HMD or handset provided tracking system

*/
export default class XRCoordinateSystem {
	constructor(display, type){
		this._display = display
		this._type = type

		this.__relativeMatrix = MatrixMath.mat4_generateIdentity()
		this._workingMatrix = MatrixMath.mat4_generateIdentity()
	}

	getTransformTo(otherCoordinateSystem){
		// apply inverse of the poseModelMatrix to the identity matrix
		let inverse = MatrixMath.mat4_invert(new Float32Array(16), otherCoordinateSystem._poseModelMatrix)
		let out = MatrixMath.mat4_generateIdentity()
		MatrixMath.mat4_multiply(out, inverse, out)

		// apply the other system's poseModelMatrix
		MatrixMath.mat4_multiply(out, this._poseModelMatrix, out)
		return out
	}

	get _relativeMatrix(){ return this.__relativeMatrix }

	set _relativeMatrix(value){
		for(let i=0; i < 16; i++){
			this.__relativeMatrix[i] = value[i]
		}
	}

	get _poseModelMatrix(){
		switch(this._type){
			case XRCoordinateSystem.HEAD_MODEL:
				return this._display._headPose.poseModelMatrix
			case XRCoordinateSystem.EYE_LEVEL:
				return this._display._eyeLevelPose.poseModelMatrix
			case XRCoordinateSystem.TRACKER:
				MatrixMath.mat4_multiply(this._workingMatrix, this.__relativeMatrix, this._display._trackerPoseModelMatrix)
				return this._workingMatrix
			default:
				throw new Error('Unknown coordinate system type: ' + this._type)
		}
	}
}

XRCoordinateSystem.HEAD_MODEL = 'headModel'
XRCoordinateSystem.EYE_LEVEL = 'eyeLevel'
XRCoordinateSystem.TRACKER = 'tracker'

XRCoordinateSystem.TYPES = [
	XRCoordinateSystem.HEAD_MODEL,
	XRCoordinateSystem.EYE_LEVEL,
	XRCoordinateSystem.TRACKER,
]