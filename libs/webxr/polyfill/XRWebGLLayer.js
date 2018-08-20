import XRLayer from './XRLayer.js'

/*
XRWebGLLayer defines the WebGL or WebGL 2 context that is rendering the visuals for this layer.
*/
export default class XRWebGLLayer extends XRLayer {
	constructor(session, context){
		super()
		this._session = session
		this._context = context
		this._width = this._context.canvas.width;
		this._height = this._context.canvas.height;
		this._framebuffer = null // TODO
	}

	get context(){ return this._context }

	get antialias(){
		// readonly attribute boolean antialias;
		throw 'Not implemented'
	}

	get depth(){
		// readonly attribute boolean depth;
		throw 'Not implemented'
	}

	get stencil(){
		// readonly attribute boolean stencil;
		throw 'Not implemented'
	}

	get alpha(){
		// readonly attribute boolean alpha;
		throw 'Not implemented'
	}

	get multiview(){
		// readonly attribute boolean multiview;
		throw 'Not implemented'
	}
	
	get framebuffer(){
		return this._framebuffer
	}

	set framebufferWidth(w){
		this._width = w;
		this._context.canvas.width = w;		
	}

	get framebufferWidth(){
		// not using this for now, on iOS it's not good.  
		// var pr = window.devicePixelRatio || 1;
		//return this._context.canvas.clientWidth;
		return this._width;
	}

	set framebufferHeight(h){
		this._height = h;
		this._context.canvas.height = h;		
	}

	get framebufferHeight(){
		// not using this for now, on iOS it's not good.  
		// var pr = window.devicePixelRatio || 1;
		//return this._context.canvas.clientHeight;
		return this._height;
	}

	requestViewportScaling(viewportScaleFactor){
		// void requestViewportScaling(double viewportScaleFactor);
		throw 'Not implemented'
	}
}