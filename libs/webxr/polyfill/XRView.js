import XRViewport from './XRViewport.js'
import MatrixMath from './fill/MatrixMath.js'

/*
An XRView describes a single view into an XR scene.
It provides several values directly, and acts as a key to query view-specific values from other interfaces.
*/
export default class XRView {
	constructor(fov, depthNear, depthFar, eye=null){
		this._fov = fov
		this._depthNear = depthNear
		this._depthFar = depthFar
		this._eye = eye
		this._viewport = new XRViewport(0, 0, 1, 1)
		this._projectionMatrix = new Float32Array(16)
		this._viewMatrix = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1])
		MatrixMath.mat4_perspectiveFromFieldOfView(this._projectionMatrix, this._fov, this._depthNear, this._depthFar)
	}

	set fov ( value ) {
		this._fov = value
		MatrixMath.mat4_perspectiveFromFieldOfView(this._projectionMatrix, this._fov, this._depthNear, this._depthFar)
	}

	get eye(){ return this._eye }

	get projectionMatrix(){ return this._projectionMatrix }

	setProjectionMatrix(array16){
		for(let i=0; i < 16; i++){
			this._projectionMatrix[i] = array16[i]
		}
	}

	get viewMatrix(){ return this._viewMatrix }

	setViewMatrix(array16){
		for(let i=0; i < 16; i++){
			this._viewMatrix[i] = array16[i]
		}
	}

	getViewport(layer){
		if(this._eye === XRView.LEFT){
			this._viewport.x = 0
			this._viewport.y = 0
			this._viewport.width = layer.framebufferWidth / 2
			this._viewport.height = layer.framebufferHeight
		} else if(this._eye === XRView.RIGHT){
			this._viewport.x = layer.framebufferWidth / 2
			this._viewport.y = 0
			this._viewport.width = layer.framebufferWidth / 2
			this._viewport.height = layer.framebufferHeight
		} else {
			this._viewport.x = 0
			this._viewport.y = 0
			this._viewport.width = layer.framebufferWidth
			this._viewport.height = layer.framebufferHeight
		}
		return this._viewport
	}
}

XRView.LEFT = 'left'
XRView.RIGHT = 'right'
XRView.EYES = [XRView.LEFT, XRView.RIGHT]