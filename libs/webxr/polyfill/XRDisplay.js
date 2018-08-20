import MatrixMath from './fill/MatrixMath.js'
import EventHandlerBase from './fill/EventHandlerBase.js'

import VirtualReality from './reality/VirtualReality.js'

import XRFieldOfView from './XRFieldOfView.js'
import Reality from './Reality.js'


/*
Each XRDisplay represents a method of using a specific type of hardware to render AR or VR realities and layers.

This doesn't yet support a geospatial coordinate system
*/
export default class XRDisplay extends EventHandlerBase {
	constructor(xr, displayName, isExternal, reality){
		super()
		this._xr = xr
		this._displayName = displayName
		this._isExternal = isExternal
		this._reality = reality // The Reality instance that is currently displayed

		this._headModelCoordinateSystem = new XRCoordinateSystem(this, XRCoordinateSystem.HEAD_MODEL)
		this._eyeLevelCoordinateSystem = new XRCoordinateSystem(this, XRCoordinateSystem.EYE_LEVEL)
		this._trackerCoordinateSystem = new XRCoordinateSystem(this, XRCoordinateSystem.TRACKER)

		this._headPose = new XRViewPose([0, XRViewPose.SITTING_EYE_HEIGHT, 0])
		this._eyeLevelPose = new XRViewPose([0, XRViewPose.SITTING_EYE_HEIGHT, 0])
		this._trackerPoseModelMatrix = MatrixMath.mat4_generateIdentity()

		this._fovy = 70;
		var fov = this._fovy/2;
		this._fov = new XRFieldOfView(fov, fov, fov, fov)
		this._depthNear = 0.1
		this._depthFar = 1000

		this._views = []
	}

	get displayName(){ return this._displayName }

	get isExternal(){ return this._isExternal }

	supportsSession(parameters){
		// parameters: XRSessionCreateParametersInit 
		// returns boolean
		return this._supportedCreationParameters(parameters)
	}

	requestSession(parameters){
		return new Promise((resolve, reject) => {
			if(this._supportedCreationParameters(parameters) === false){
				reject()
				return
			}
			if(parameters.type === XRSession.REALITY){
				this._reality = new VirtualReality()
				this._xr._privateRealities.push(this._reality)
			}
			resolve(this._createSession(parameters))
		})
	}

	// no-op unless display supports it
	_requestVideoFrame() {}
	
	_requestAnimationFrame(callback){
		return window.requestAnimationFrame(callback)
	}

	_cancelAnimationFrame(handle){
		return window.cancelAnimationFrame(handle)		
	}

	_createSession(parameters){
		return new XRSession(this._xr, this, parameters)
	}

	_supportedCreationParameters(parameters){
		// returns true if the parameters are supported by this display
		throw 'Should be implemented by extending class'
	}

	/*
	Called by a session before it hands a new XRPresentationFrame to the app
	*/
	_handleNewFrame(frame){}

	/*
	Called by a session after it has handed the XRPresentationFrame to the app
	Use this for any display submission calls that need to happen after the render has occurred.
	*/
	_handleAfterFrame(frame){}


	/*
	Called by XRSession after the session.baseLayer is assigned a value
	*/
	_handleNewBaseLayer(baseLayer){}

	//attribute EventHandler ondeactivate;
}

XRDisplay.NEW_WORLD_ANCHOR = 'world-anchor'
XRDisplay.UPDATE_WORLD_ANCHOR = 'update-world-anchor'
XRDisplay.REMOVE_WORLD_ANCHOR = 'remove-world-anchor'
