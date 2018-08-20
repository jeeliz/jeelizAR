import XRDisplay from './XRDisplay.js'
import XRSession from './XRSession.js'
import XRSessionCreateParameters from './XRSessionCreateParameters.js'
import Reality from './Reality.js'
import XRPointCloud from './XRPointCloud.js'
import XRLightEstimate from './XRLightEstimate.js'
import XRAnchor from './XRAnchor.js'
import XRPlaneAnchor from './XRPlaneAnchor.js'
import XRFaceAnchor from './XRFaceAnchor.js'
import XRImageAnchor from './XRImageAnchor.js'
import XRAnchorOffset from './XRAnchorOffset.js'
import XRStageBounds from './XRStageBounds.js'
import XRStageBoundsPoint from './XRStageBoundsPoint.js'
import XRPresentationFrame from './XRPresentationFrame.js'
import XRView from './XRView.js'
import XRViewport from './XRViewport.js'
import XRCoordinateSystem from './XRCoordinateSystem.js'
import XRViewPose from './XRViewPose.js'
import XRLayer from './XRLayer.js'
import XRWebGLLayer from './XRWebGLLayer.js'
import XRVideoFrame from './XRVideoFrame.js'

import EventHandlerBase from './fill/EventHandlerBase.js'
import FlatDisplay from './display/FlatDisplay.js'
import HeadMountedDisplay from './display/HeadMountedDisplay.js'

import CameraReality from './reality/CameraReality.js'

/*
XRPolyfill implements the window.XR functionality as a polyfill

Code below will check for window.XR and if it doesn't exist will install this polyfill,
so you can safely include this script in any page.
*/
class XRPolyfill extends EventHandlerBase {
	constructor(){
		super()
		window.XRDisplay = XRDisplay
		window.XRSession = XRSession
		window.XRSessionCreateParameters = XRSessionCreateParameters
		window.Reality = Reality
		window.XRPointCloud = XRPointCloud
		window.XRLightEstimate = XRLightEstimate
		window.XRAnchor = XRAnchor
		window.XRPlaneAnchor = XRPlaneAnchor
        window.XRFaceAnchor = XRFaceAnchor
        window.XRImageAnchor = XRImageAnchor
        window.XRAnchorOffset = XRAnchorOffset
		window.XRStageBounds = XRStageBounds
		window.XRStageBoundsPoint = XRStageBoundsPoint
		window.XRPresentationFrame = XRPresentationFrame
		window.XRView = XRView
		window.XRViewport = XRViewport
		window.XRCoordinateSystem = XRCoordinateSystem
		window.XRViewPose = XRViewPose
		window.XRLayer = XRLayer
		window.XRWebGLLayer = XRWebGLLayer
		window.XRVideoFrame = XRVideoFrame

		this._getVRDisplaysFinished = false;

		// Reality instances that may be shared by multiple XRSessions
		this._sharedRealities = [new CameraReality(this)]
		this._privateRealities = []

		this._displays = [new FlatDisplay(this, this._sharedRealities[0])]

		if(typeof navigator.getVRDisplays === 'function'){
			navigator.getVRDisplays().then(displays => {
				for(let display of displays){
					if(display === null) continue
					if(display.capabilities.canPresent){
						this._displays.push(new HeadMountedDisplay(this, this._sharedRealities[0], display))
					}
				}
				this._getVRDisplaysFinished = true;
			})
		} else {
			// if no WebVR, we don't need to wait
			this._getVRDisplaysFinished = true;
		}

		// These elements are at the beginning of the body and absolutely positioned to fill the entire window
		// Sessions and realities add their elements to these divs so that they are in the right render order
		this._sessionEls = document.createElement('div')
		this._sessionEls.setAttribute('class', 'webxr-sessions')
		this._realityEls = document.createElement('div')
		this._realityEls.setAttribute('class', 'webxr-realities')
		for(let el of [this._sessionEls, this._realityEls]){
			el.style.position = 'absolute'
			el.style.width = '100%'
			el.style.height = '100%'
		}

		let prependElements = () => {
			document.body.style.width = '100%';
			document.body.style.height = '100%';
			document.body.prepend(this._sessionEls);
			document.body.prepend(this._realityEls); // realities must render behind the sessions
		}

		if(document.readyState !== 'loading') {
			prependElements();
		} else {
			document.addEventListener('DOMContentLoaded', prependElements);
		}
	}

	getDisplays(){
		var self=this
		var waitTillDisplaysChecked = function(resolve) {
			if (!self._getVRDisplaysFinished) {
				setTimeout(waitTillDisplaysChecked.bind(self, resolve), 30);
			} else {
				resolve(self._displays);
			}
		}
		return new Promise((resolve, reject) => {
			waitTillDisplaysChecked(resolve);
		})
	}

	//attribute EventHandler ondisplayconnect;
	//attribute EventHandler ondisplaydisconnect;
}

/* Install XRPolyfill if window.XR does not exist */
if(typeof navigator.XR === 'undefined') navigator.XR = new XRPolyfill()
