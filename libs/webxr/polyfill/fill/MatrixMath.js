import Quaternion from './Quaternion.js'

/*
MatrixMath provides helper functions for populating the various matrices involved with 3D graphics.

Many of the math methods were taken from the Google webvr polyfill:
https://github.com/googlevr/webvr-polyfill/blob/master/src/util.js#L270
*/
export default class MatrixMath {

	// Returns a new Float32Array that is set to the transform identity
	static mat4_generateIdentity(){
		return new Float32Array([
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1,
		])
	}

	static mat4_get_position(out, m){
		out[0] = m[12]
		out[1] = m[13]
		out[2] = m[14]
		return out
	}

	static mat4_get_rotation(out, m){
		let quat = new Quaternion()
		quat.setFromRotationMatrix(m)
		out[0] = quat.x
		out[1] = quat.y
		out[2] = quat.z
		out[3] = quat.w
		return out
	}

	static mat4_eyeView(out, poseModelMatrix, offset=new Float32Array([0, 0, 0])) {
		MatrixMath.mat4_translate(out, poseModelMatrix, offset)
		MatrixMath.mat4_invert(out, out)
	}

	static mat4_perspectiveFromFieldOfView(out, fov, near, far) {
		var upTan =    Math.tan(fov.upDegrees *    MatrixMath.PI_OVER_180)
		var downTan =  Math.tan(fov.downDegrees *  MatrixMath.PI_OVER_180)
		var leftTan =  Math.tan(fov.leftDegrees *  MatrixMath.PI_OVER_180)
		var rightTan = Math.tan(fov.rightDegrees * MatrixMath.PI_OVER_180)

		var xScale = 2.0 / (leftTan + rightTan)
		var yScale = 2.0 / (upTan + downTan)

		out[0] = xScale
		out[1] = 0.0
		out[2] = 0.0
		out[3] = 0.0
		out[4] = 0.0
		out[5] = yScale
		out[6] = 0.0
		out[7] = 0.0
		out[8] = -((leftTan - rightTan) * xScale * 0.5)
		out[9] = ((upTan - downTan) * yScale * 0.5)
		out[10] = far / (near - far)
		out[11] = -1.0
		out[12] = 0.0
		out[13] = 0.0
		out[14] = (far * near) / (near - far)
		out[15] = 0.0
		return out
	}

	static mat4_fromRotationTranslation(out, q=[0,0,0,1], v=[0,0,0]) {
		// Quaternion math
		var x = q[0]
		var y = q[1]
		var z = q[2]
		var w = q[3]
		var x2 = x + x
		var y2 = y + y
		var z2 = z + z

		var xx = x * x2
		var xy = x * y2
		var xz = x * z2
		var yy = y * y2
		var yz = y * z2
		var zz = z * z2
		var wx = w * x2
		var wy = w * y2
		var wz = w * z2

		out[0] = 1 - (yy + zz)
		out[1] = xy + wz
		out[2] = xz - wy
		out[3] = 0
		out[4] = xy - wz
		out[5] = 1 - (xx + zz)
		out[6] = yz + wx
		out[7] = 0
		out[8] = xz + wy
		out[9] = yz - wx
		out[10] = 1 - (xx + yy)
		out[11] = 0
		out[12] = v[0]
		out[13] = v[1]
		out[14] = v[2]
		out[15] = 1

		return out
	}

	static mat4_translate(out, a, v) {
		var x = v[0]
		var y = v[1]
		var z = v[2]
		let a00
		let a01
		let a02
		let a03
		let a10, a11, a12, a13,
		      a20, a21, a22, a23

		if (a === out) {
			out[12] = a[0] * x + a[4] * y + a[8]  * z + a[12]
			out[13] = a[1] * x + a[5] * y + a[9]  * z + a[13]
			out[14] = a[2] * x + a[6] * y + a[10] * z + a[14]
			out[15] = a[3] * x + a[7] * y + a[11] * z + a[15]
		} else {
			a00 = a[0]; a01 = a[1]; a02 = a[2];  a03 = a[3]
			a10 = a[4]; a11 = a[5]; a12 = a[6];  a13 = a[7]
			a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11]

			out[0] = a00; out[1] = a01; out[2] =  a02; out[3] =  a03
			out[4] = a10; out[5] = a11; out[6] =  a12; out[7] =  a13
			out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23

			out[12] = a00 * x + a10 * y + a20 * z + a[12]
			out[13] = a01 * x + a11 * y + a21 * z + a[13]
			out[14] = a02 * x + a12 * y + a22 * z + a[14]
			out[15] = a03 * x + a13 * y + a23 * z + a[15]
		}

		return out
	}

	static mat4_invert(out, a) {
		var a00 = a[0],  a01 = a[1],  a02 = a[2],  a03 = a[3],
		      a10 = a[4],  a11 = a[5],  a12 = a[6],  a13 = a[7],
		      a20 = a[8],  a21 = a[9],  a22 = a[10], a23 = a[11],
		      a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15]

		var b00 = a00 * a11 - a01 * a10
		var b01 = a00 * a12 - a02 * a10
		var b02 = a00 * a13 - a03 * a10
		var b03 = a01 * a12 - a02 * a11
		var b04 = a01 * a13 - a03 * a11
		var b05 = a02 * a13 - a03 * a12
		var b06 = a20 * a31 - a21 * a30
		var b07 = a20 * a32 - a22 * a30
		var b08 = a20 * a33 - a23 * a30
		var b09 = a21 * a32 - a22 * a31
		var b10 = a21 * a33 - a23 * a31
		var b11 = a22 * a33 - a23 * a32

		// Calculate the determinant
		let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06

		if (!det) {
			return null
		}
		det = 1.0 / det

		out[0] =  (a11 * b11 - a12 * b10 + a13 * b09) * det
		out[1] =  (a02 * b10 - a01 * b11 - a03 * b09) * det
		out[2] =  (a31 * b05 - a32 * b04 + a33 * b03) * det
		out[3] =  (a22 * b04 - a21 * b05 - a23 * b03) * det
		out[4] =  (a12 * b08 - a10 * b11 - a13 * b07) * det
		out[5] =  (a00 * b11 - a02 * b08 + a03 * b07) * det
		out[6] =  (a32 * b02 - a30 * b05 - a33 * b01) * det
		out[7] =  (a20 * b05 - a22 * b02 + a23 * b01) * det
		out[8] =  (a10 * b10 - a11 * b08 + a13 * b06) * det
		out[9] =  (a01 * b08 - a00 * b10 - a03 * b06) * det
		out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det
		out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det
		out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det
		out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det
		out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det
		out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det

		return out
	}

	static mat4_multiply(out, ae, be){
		var a11 = ae[0], a12 = ae[4], a13 = ae[8],  a14 = ae[12]
		var a21 = ae[1], a22 = ae[5], a23 = ae[9],  a24 = ae[13]
		var a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14]
		var a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15]

		var b11 = be[0], b12 = be[4], b13 = be[8],  b14 = be[12]
		var b21 = be[1], b22 = be[5], b23 = be[9],  b24 = be[13]
		var b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14]
		var b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15]

		out[0] =  a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41
		out[4] =  a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42
		out[8] =  a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43
		out[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44

		out[1] =  a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41
		out[5] =  a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42
		out[9] =  a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43
		out[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44

		out[2] =  a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41
		out[6] =  a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42
		out[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43
		out[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44

		out[3] =  a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41
		out[7] =  a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42
		out[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43
		out[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44

		return out
	}
}

MatrixMath.PI_OVER_180 = Math.PI / 180.0
