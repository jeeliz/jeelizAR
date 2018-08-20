
export default class Euler {
	constructor(x, y, z, order=Euler.DefaultOrder){
		this.x = x
		this.y = y
		this.z = z
		this.order = order
	}

	set(x, y, z, order=Euler.DefaultOrder){
		this.x = x
		this.y = y
		this.z = z
		this.order = order
	}

	toArray(){
		return [this.x, this.y, this.z]
	}
}

Euler.RotationOrders = ['XYZ', 'YZX', 'ZXY', 'XZY', 'YXZ', 'ZYX']
Euler.DefaultOrder = 'XYZ'
