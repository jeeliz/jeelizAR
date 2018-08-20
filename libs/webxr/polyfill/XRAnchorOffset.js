import MatrixMath from './fill/MatrixMath.js'
import Quaternion from './fill/Quaternion.js'

import XRAnchor from './XRAnchor.js'

/*
XRAnchorOffset represents a pose in relation to an XRAnchor
*/
export default class XRAnchorOffset {
	constructor(anchorUID, poseMatrix=null){
		this._anchorUID = anchorUID
		this._tempArray = new Float32Array(16);
		this._poseMatrix = poseMatrix || MatrixMath.mat4_generateIdentity()
	}

	setIdentityOffset() {
		var p = this._poseMatrix 
		p[0] = p[5] = p[10] = p[15] = 1
		p[1] = p[2] = p[3] = 0
		p[4] = p[6] = p[7] = 0
		p[8] = p[9] = p[11] = 0
		p[12] = p[13] = p[14] = 0		
	}
	get anchorUID(){ return this._anchorUID }

	/*
	A Float32Array(16) representing a column major affine transform matrix
	*/
	get poseMatrix(){ return this._poseMatrix }
	
	set poseMatrix(array16){
		for(let i=0; i < 16; i++){
			this._poseMatrix[i] = array16[i]
		}
	}

	/*
	returns a Float32Array(4) representing an x, y, z position from this.poseMatrix
	*/
	get position(){
		return new Float32Array([this._poseMatrix[12], this._poseMatrix[13], this._poseMatrix[14]])
	}

	/*
	returns a Float32Array(4) representing x, y, z, w of a quaternion from this.poseMatrix
	*/
	get orientation(){
		let quat = new Quaternion()
		quat.setFromRotationMatrix(this._poseMatrix)
		return quat.toArray()
	}

	/*
	Return a transform matrix that is offset by this XRAnchorOffset.poseMatrix relative to coordinateSystem
	*/
	getOffsetTransform(coordinateSystem){
		return MatrixMath.mat4_multiply(this._tempArray, this._poseMatrix, coordinateSystem._poseModelMatrix)
	}
}
