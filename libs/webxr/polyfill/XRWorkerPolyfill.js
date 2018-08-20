import XRAnchor from './XRAnchor.js'
import XRAnchorOffset from './XRAnchorOffset.js'
import XRCoordinateSystem from './XRCoordinateSystem.js'
import XRViewPose from './XRViewPose.js'
import XRVideoFrame from './XRVideoFrame.js'
import EventHandlerBase from './fill/EventHandlerBase.js'

/*
XRPolyfill implements the window.XR functionality as a polyfill

Code below will check for window.XR and if it doesn't exist will install this polyfill,
so you can safely include this script in any page.
*/
export default class XRWorkerPolyfill extends EventHandlerBase {
	constructor(){
		super()
		self.XRAnchor = XRAnchor
		self.XRAnchorOffset = XRAnchorOffset
		self.XRCoordinateSystem = XRCoordinateSystem
		self.XRViewPose = XRViewPose
		self.XRVideoFrame = XRVideoFrame
	}
}

/* Install XRWorkerPolyfill if self.XR does not exist */
self.XR = new XRWorkerPolyfill()