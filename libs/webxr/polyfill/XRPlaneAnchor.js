import XRAnchor from './XRAnchor.js'

/*
XRPlaneAnchor represents a flat surfaces like floors, table tops, or walls.
*/
export default class XRPlaneAnchor extends XRAnchor {
	constructor(coordinateSystem, uid=null, center, extent, alignment, geometry) {
		super(coordinateSystem, uid)
		this.center = center
		this.extent = extent
		this.alignment = alignment
		this.geometry = geometry
	}

	get width(){
		//readonly attribute double width;
		throw 'Not implemented'
	}

	get length(){
		//readonly attribute double length;
		throw 'Not implemented'
	}
}