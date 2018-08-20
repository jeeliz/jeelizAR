/*
EventHandlerBase is the base class that implements the EventHandler interface methods for dispatching and receiving events.
*/
export default class EventHandlerBase {
	constructor(){
		this._listeners = new Map() // string type -> [listener, ...]
	}

	addEventListener(type, listener){
		let listeners = this._listeners.get(type)
		if(Array.isArray(listeners) === false){
			listeners = []
			this._listeners.set(type, listeners)
		}
		listeners.push(listener)
	}

	removeEventListener(type, listener){
		let listeners = this._listeners.get(type)
		if(Array.isArray(listeners) === false){
			return
		}
		for(let i = 0; i < listeners.length; i++){
			if(listeners[i] === listener){
				listeners.splice(i, 1)
				return
			}
		}
	}

	dispatchEvent(event){
		let listeners = this._listeners.get(event.type)
		if(Array.isArray(listeners) === false) return

		// need a copy, since removeEventListener is often called inside listeners to create one-shots and it modifies the array, causing 
		// listeners not to be called! 
		var array = listeners.slice( 0 );
		for(let listener of array){
			listener(event)
		}
	}
}
