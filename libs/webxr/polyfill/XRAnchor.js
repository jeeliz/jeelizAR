/*
XRAnchors provide per-frame coordinates which the Reality attempts to pin "in place".
In a virtual Reality these coordinates do not change. 
In a Reality based on environment mapping sensors, the anchors may change pose on a per-frame bases as the system refines its map.
*/
export default class XRAnchor {
	constructor(xrCoordinateSystem, uid=null){
		this._uid = uid || XRAnchor._generateUID()
		this._coordinateSystem = xrCoordinateSystem
	}

	get uid(){ return this._uid }

	get coordinateSystem(){	return this._coordinateSystem }
	
	static _generateUID(){
		return 'anchor-' + new Date().getTime() + '-' + Math.floor((Math.random() * Number.MAX_SAFE_INTEGER))
	}
}