/*
XRFieldOFView represents the four boundaries of a camera's field of view: up, down, left, and right.
*/
export default class XRFieldOfView {
	constructor(upDegrees, downDegrees, leftDegrees, rightDegrees){
		this._upDegrees = upDegrees
		this._downDegrees = downDegrees
		this._leftDegrees = leftDegrees
		this._rightDegrees = rightDegrees
	}

	get upDegrees(){ return this._upDegrees }
	get downDegrees(){ return this._downDegrees }
	get leftDegrees(){ return this._leftDegrees }
	get rightDegrees(){ return this._rightDegrees }
}