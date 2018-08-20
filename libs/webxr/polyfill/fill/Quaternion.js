/*
Quaternion wraps a vector of length 4 used as an orientation value.

Taken from https://github.com/googlevr/webvr-polyfill/blob/master/src/math-util.js which took it from Three.js
*/
export default class Quaternion{
	constructor(x=0, y=0, z=0, w=1){
		this.x = x
		this.y = y
		this.z = z
		this.w = w
	}

	set(x, y, z, w){
		this.x = x
		this.y = y
		this.z = z
		this.w = w
		return this
	}

	toArray(){
		return [this.x, this.y, this.z, this.w]
	}

	copy(quaternion){
		this.x = quaternion.x
		this.y = quaternion.y
		this.z = quaternion.z
		this.w = quaternion.w
		return this
	}

	setFromRotationMatrix(array16){
		// Taken from https://github.com/mrdoob/three.js/blob/dev/src/math/Quaternion.js
		// which took it from http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm
		// assumes the upper 3x3 of array16 (column major) is a pure rotation matrix (i.e, unscaled)

		let	m11 = array16[0], m12 = array16[4], m13 = array16[8],
			m21 = array16[1], m22 = array16[5], m23 = array16[9],
			m31 = array16[2], m32 = array16[6], m33 = array16[10]

		var trace = m11 + m22 + m33

		if(trace > 0){
			var s = 0.5 / Math.sqrt(trace + 1.0)
			this.w = 0.25 / s
			this.x = (m32 - m23) * s
			this.y = (m13 - m31) * s
			this.z = (m21 - m12) * s
		} else if (m11 > m22 && m11 > m33){
			var s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33)
			this.w = (m32 - m23) / s
			this.x = 0.25 * s
			this.y = (m12 + m21) / s
			this.z = (m13 + m31) / s
		} else if (m22 > m33){
			var s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33)
			this.w = (m13 - m31) / s
			this.x = (m12 + m21) / s
			this.y = 0.25 * s
			this.z = (m23 + m32) / s
		} else{
			var s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22)
			this.w = (m21 - m12) / s
			this.x = (m13 + m31) / s
			this.y = (m23 + m32) / s
			this.z = 0.25 * s
		}
		return this
	}

	setFromEuler(x, y, z, order='XYZ'){
		// http://www.mathworks.com/matlabcentral/fileexchange/
		// 	20696-function-to-convert-between-dcm-euler-angles-quaternions-and-euler-vectors/
		//	content/SpinCalc.m

		var cos = Math.cos
		var sin = Math.sin
		var c1 = cos(x / 2)
		var c2 = cos(y / 2)
		var c3 = cos(z / 2)
		var s1 = sin(x / 2)
		var s2 = sin(y / 2)
		var s3 = sin(z / 2)

		if (order === 'XYZ'){
			this.x = s1 * c2 * c3 + c1 * s2 * s3
			this.y = c1 * s2 * c3 - s1 * c2 * s3
			this.z = c1 * c2 * s3 + s1 * s2 * c3
			this.w = c1 * c2 * c3 - s1 * s2 * s3
		} else if (order === 'YXZ'){
			this.x = s1 * c2 * c3 + c1 * s2 * s3
			this.y = c1 * s2 * c3 - s1 * c2 * s3
			this.z = c1 * c2 * s3 - s1 * s2 * c3
			this.w = c1 * c2 * c3 + s1 * s2 * s3
		} else if (order === 'ZXY'){
			this.x = s1 * c2 * c3 - c1 * s2 * s3
			this.y = c1 * s2 * c3 + s1 * c2 * s3
			this.z = c1 * c2 * s3 + s1 * s2 * c3
			this.w = c1 * c2 * c3 - s1 * s2 * s3
		} else if (order === 'ZYX'){
			this.x = s1 * c2 * c3 - c1 * s2 * s3
			this.y = c1 * s2 * c3 + s1 * c2 * s3
			this.z = c1 * c2 * s3 - s1 * s2 * c3
			this.w = c1 * c2 * c3 + s1 * s2 * s3
		} else if (order === 'YZX'){
			this.x = s1 * c2 * c3 + c1 * s2 * s3
			this.y = c1 * s2 * c3 + s1 * c2 * s3
			this.z = c1 * c2 * s3 - s1 * s2 * c3
			this.w = c1 * c2 * c3 - s1 * s2 * s3
		} else if (order === 'XZY'){
			this.x = s1 * c2 * c3 - c1 * s2 * s3
			this.y = c1 * s2 * c3 - s1 * c2 * s3
			this.z = c1 * c2 * s3 + s1 * s2 * c3
			this.w = c1 * c2 * c3 + s1 * s2 * s3
		}
	}

	setFromAxisAngle(axis, angle){
		// http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToQuaternion/index.htm
		// assumes axis is normalized
		var halfAngle = angle / 2
		var s = Math.sin(halfAngle)
		this.x = axis.x * s
		this.y = axis.y * s
		this.z = axis.z * s
		this.w = Math.cos(halfAngle)
		return this
	}

	multiply(q){
		return this.multiplyQuaternions(this, q)
	}

	multiplyQuaternions(a, b){
		// from http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm
		var qax = a.x, qay = a.y, qaz = a.z, qaw = a.w
		var qbx = b.x, qby = b.y, qbz = b.z, qbw = b.w
		this.x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby
		this.y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz
		this.z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx
		this.w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz
		return this
	}

	inverse(){
		this.x *= -1
		this.y *= -1
		this.z *= -1
		this.normalize()
		return this
	}

	normalize(){
		let l = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w)
		if (l === 0){
			this.x = 0
			this.y = 0
			this.z = 0
			this.w = 1
		} else{
			l = 1 / l
			this.x = this.x * l
			this.y = this.y * l
			this.z = this.z * l
			this.w = this.w * l
		}
		return this
	}

	slerp(qb, t){
		// http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/
		if(t === 0) return this
		if(t === 1) return this.copy(qb)

		var x = this.x, y = this.y, z = this.z, w = this.w
		let cosHalfTheta = w * qb.w + x * qb.x + y * qb.y + z * qb.z
		if (cosHalfTheta < 0){
			this.w = - qb.w
			this.x = - qb.x
			this.y = - qb.y
			this.z = - qb.z
			cosHalfTheta = - cosHalfTheta
		} else{
			this.copy(qb)
		}
		if (cosHalfTheta >= 1.0){
			this.w = w
			this.x = x
			this.y = y
			this.z = z
			return this
		}

		var halfTheta = Math.acos(cosHalfTheta)
		var sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta)
		if (Math.abs(sinHalfTheta) < 0.001){
			this.w = 0.5 * (w + this.w)
			this.x = 0.5 * (x + this.x)
			this.y = 0.5 * (y + this.y)
			this.z = 0.5 * (z + this.z)

			return this
		}

		var ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta
		var ratioB = Math.sin(t * halfTheta) / sinHalfTheta
		this.w = (w * ratioA + this.w * ratioB)
		this.x = (x * ratioA + this.x * ratioB)
		this.y = (y * ratioA + this.y * ratioB)
		this.z = (z * ratioA + this.z * ratioB)
		return this
	}
}