
/*
XRPointCloud holds an array of float values where each four values represents [x, y, z, confidence in range 0-1] that describe a point in space detected by the device's sensors.
*/
export default class XRPointCloud {
	get points(){
		//readonly attribute Float32Array points
		throw new Error('Not implemented')
	}
}