import XRDisplay from '../XRDisplay.js'
import XRView from '../XRView.js'
import XRSession from '../XRSession.js'
import XRViewPose from '../XRViewPose.js'

import MatrixMath from '../fill/MatrixMath.js'
import Quaternion from '../fill/Quaternion.js'
import Vector3 from '../fill/Vector3.js'

import DeviceOrientationTracker from '../fill/DeviceOrientationTracker.js'
import ARKitWrapper from '../platform/ARKitWrapper.js'

/*
HeadMountedDisplay wraps a WebVR 1.1 display, like a Vive, Rift, or Daydream.
*/
export default class HeadMountedDisplay extends XRDisplay {
	constructor(xr, reality, vrDisplay){
		super(xr, vrDisplay.displayName, vrDisplay.capabilities.hasExternalDisplay, reality)
		this._vrDisplay = vrDisplay
		this._vrFrameData = new VRFrameData()

		// The view projection matrices will be reset using VRFrameData during this._handleNewFrame
		this._leftView = new XRView(this._fov, this._depthNear, this._depthFar, XRView.LEFT)
		this._rightView = new XRView(this._fov, this._depthNear, this._depthFar, XRView.RIGHT)
		this._views = [this._leftView, this._rightView]

		// These will be used to set the head and eye level poses during this._handleNewFrame
		this._deviceOrientation = new Quaternion()
		this._devicePosition = new Vector3()
		this._deviceWorldMatrix = new Float32Array(16)
	}

	/*
	Called via the XRSession.requestAnimationFrame
	*/
	_requestAnimationFrame(callback){
		if(this._vrDisplay.isPresenting){
			this._vrDisplay.requestAnimationFrame(callback)
		} else {
			window.requestAnimationFrame(callback)
		}
	}

	/*
	Called by a session to indicate that its baseLayer attribute has been set.
	This is where the VRDisplay is used to create a session 
	*/
	_handleNewBaseLayer(baseLayer){
		this._vrDisplay.requestPresent([{
			source: baseLayer._context.canvas
		}]).then(() => {
			const leftEye = this._vrDisplay.getEyeParameters('left')
			const rightEye = this._vrDisplay.getEyeParameters('right')
			baseLayer.framebufferWidth = Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2
			baseLayer.framebufferHeight = Math.max(leftEye.renderHeight, rightEye.renderHeight)
			baseLayer._context.canvas.style.position = 'absolute'
			baseLayer._context.canvas.style.bottom = '1px'
			baseLayer._context.canvas.style.right = '1px'
			baseLayer._context.canvas.style.width = "100%";
			baseLayer._context.canvas.style.height = "100%";
				document.body.appendChild(baseLayer._context.canvas)
		}).catch(e => {
			console.error('Unable to init WebVR 1.1 display', e)
		})
	}

	_stop(){
		// TODO figure out how to stop ARKit and ARCore so that CameraReality can still work
		if(this.running === false) return
		this.running = false
		this._reality._stop()
	}

	/*
	Called by a session before it hands a new XRPresentationFrame to the app
	*/
	_handleNewFrame(frame){
		if(this._vrDisplay.isPresenting){
			this._updateFromVRFrameData()
		}
	}

	_handleAfterFrame(frame){
		if(this._vrDisplay.isPresenting){
			this._vrDisplay.submitFrame()
		}
	}

	_supportedCreationParameters(parameters){
		return parameters.type === XRSession.REALITY && parameters.exclusive === true
	}

	_updateFromVRFrameData(){
		this._vrDisplay.getFrameData(this._vrFrameData)
		this._leftView.setViewMatrix(this._vrFrameData.leftViewMatrix)
		this._rightView.setViewMatrix(this._vrFrameData.rightViewMatrix)
		this._leftView.setProjectionMatrix(this._vrFrameData.leftProjectionMatrix)
		this._rightView.setProjectionMatrix(this._vrFrameData.rightProjectionMatrix)
		if(this._vrFrameData.pose){
			if(this._vrFrameData.pose.orientation){
				this._deviceOrientation.set(...this._vrFrameData.pose.orientation)
			}
			if(this._vrFrameData.pose.position){
				this._devicePosition.set(...this._vrFrameData.pose.position)
			}
			MatrixMath.mat4_fromRotationTranslation(this._deviceWorldMatrix, this._deviceOrientation.toArray(), this._devicePosition.toArray())
			if(this._vrDisplay.stageParameters && this._vrDisplay.stageParameters.sittingToStandingTransform){
				MatrixMath.mat4_multiply(this._deviceWorldMatrix, this._vrDisplay.stageParameters.sittingToStandingTransform, this._deviceWorldMatrix)
			}
			this._headPose._setPoseModelMatrix(this._deviceWorldMatrix)
			this._eyeLevelPose.position = this._devicePosition.toArray()
		}
	}
}