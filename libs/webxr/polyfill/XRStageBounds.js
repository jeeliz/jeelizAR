/*
The XRStageBounds interface describes a space known as a "Stage".
The stage is a bounded, floor-relative play space that the user can be expected to safely be able to move within.
Other XR platforms sometimes refer to this concept as "room scale" or "standing XR".
*/
export default class XRStageBounds {
	get center(){
		//readonly attribute XRCoordinateSystem center;
		throw new Error('Not implemented')
	}

	get geometry(){
		//readonly attribute FrozenArray<XRStageBoundsPoint>? geometry;
		throw new Error('Not implemented')
	}
}