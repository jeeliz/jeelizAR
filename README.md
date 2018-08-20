# JavaScript/WebGL lightweight object recognition library designed for WebXR



<p align="center">
<a href='https://www.youtube.com/watch?v=9klHhWxZHoc'><img src='https://img.youtube.com/vi/9klHhWxZHoc/0.jpg'></a>
<br/>
<i>Demonstration of this library: WebXR Coffee.<br/>The tea cup is detected and a 3D animation is played in augmented reality.</i>
</p>




## Table of contents

* [Features](#features)
* [Architecture](#architecture)
* [Demonstrations](#demonstrations)
* [Specifications](#specifications)
  * [Get started](#get-started)
  * [Initialization arguments](#initialization-arguments)
  * [The Detection function](#the-detection-function)
  * [Other methods](#other-methods)
  * [WebXR integration](#webxr-integration)
  * [Error codes](#error-codes)
  * [Hosting](#hosting)
* [Neural network models](#neural-network-models)
* [About the tech](#about-the-tech)
  * [Under the hood](#under-the-hood)
  * [Compatibility](#compatibility)
* [License](#license)
* [See also](#see-also)
* [References](#references)


## Features

Here are the main features of the library :

* object detection
* webcam video feed capture using a helper
* on the fly naural network change
* demonstrations with [WebXR](https://blog.mozilla.org/blog/2017/10/20/bringing-mixed-reality-web/) integration


## Architecture

* `/demos/`: source code of the demonstrations,
* `/dist/`: heart of the library: 
  * `jeelizAR.js`: main minified script,
* `/helpers/`: scripts which can help you to use this library in some specific use cases (like WebXR),
* `/libs/`: 3rd party libraries and 3D engines used in the demos,
* `/neuralNets/`: neural network models.


## Demonstrations
These are some demonstrations of this library :
* Simple object recognition using the webcam (for debugging): [live demo](https://jeeliz.com/demos/augmentedReality/demos/debugDetection/) [source code](/demos/debugDetection/)
* WebXR object labelling: [live demo](https://jeeliz.com/demos/augmentedReality/demos/webxr/) [source code](/demos/webxr/)
* WebXR coffee: [live demo](https://jeeliz.com/demos/augmentedReality/demos/webxrCoffee/) [source code](/demos/webxrCoffee/)

To run the WebXR demonstration, you need a browser where WebXR is implemented. We hope it will be implemented soon in all web browsers! 
* If you have and IOS device (Ipad, Iphone), you can install [WebXR viewer](https://itunes.apple.com/us/app/webxr-viewer/id1295998056?mt=8) from the Apple store. It is developped by the Mozilla Fundation. It is a modified Firefox with WebXR implemented using ArKit. You can then open the demonstrations from the URL bar of the application.
* For Android devices, it should work with [WebARonARCore](https://github.com/google-ar/WebARonARCore), but we have not tested yet.


You can subscribe to the [Jeeliz Youtube channel](https://www.youtube.com/channel/UC3XmXH1T3d1XFyOhrRiiUeA) or to the [@StartupJeeliz Twitter account](https://twitter.com/StartupJeeliz) to be kept informed of our cutting edge developments.

If you have made an application or a fun demonstration using this library, we would love to see it and insert a link here! Contact us on [Twitter @StartupJeeliz](https://twitter.com/StartupJeeliz) or [LinkedIn](https://www.linkedin.com/company/jeeliz).


## Specifications

### Get started
The most basic integration example of this library is the first demo, the [debug detection demo](/demos/debugDetection/).
In `index.html`, we include in the `<head>` section the main library script, `/dist/jeelizAR.js`, the `MediaStramAPI` (formerly called `getUserMedia API`) helper, `/helpers/JeelizMediaStreamAPIHelper.js` and the demo script, `demo.js`:

```html
<script src="../../dist/jeelizAR.js"></script>
<script src="../../helpers/JeelizMediaStreamAPIHelper.js"></script>
<script src="demo.js"></script>
```

In the `<body>` section of `index.html`, we put a `<canvas>` element which will be used to initialize the WebGL context used by the library for deep learning computation, and to possibly display a debug rendering:

```html
<canvas id='debugJeeARCanvas'></canvas>
```


Then, in `demo.js`, we get the Webcam video feed after the loading of the page using the `MediaStream API` helper:

```javascript
JeelizMediaStreamAPIHelper.get(DOMVIDEO, init, function(){
  alert('Cannot get video bro :(');
}, {
  video: true //mediaConstraints
  audio: false
})
```

You can replace this part by a static video, and you can also provide [Media Contraints](https://developer.mozilla.org/en-US/docs/Web/API/Media_Streams_API/Constraints) to specify the video resolution.
When the video feed is captured, the callback function `init` is launched. It initializes this library:

```javascript
function init(){

  JEEARAPI.init({
    canvasId: 'debugJeeARCanvas',
    video: DOMVIDEO,
    callbackReady: function(errLabel){
      if (errLabel){
        alert('An error happens bro: ',errLabel);
      } else {
        load_neuralNet();
      }
    }
  });

}
```

The function `load_neuralNet` loads the neural network model:

```javascript
function load_neuralNet(){
  JEEARAPI.set_NN('../../neuralNets/basic4.json', function(errLabel){
    if (errLabel){
      console.log('ERROR : cannot load the neural net', errLabel);
    } else {
      iterate();
    }
  });
}
```

The function `iterate` starts the iteration loop:

```javascript
function iterate(){
  var detectState = JEEARAPI.detect(3);
  if (detectState.label){
    console.log(detectState.label, 'IS DETECTED YEAH !!!');
  }
  window.requestAnimationFrame(iterate);
}
```

### Initialization arguments
The `JEEARAPI.init` takes a dictionary as argument with these properties:
* `video`: HTML5 video element (can come from the MediaStream API helper). If `false`, update the source texture from a `videoFrameBuffer object` provided when calling `JEEARAPI.detect(...)` (like in WebXR demos),
* `callbackReady`: callback function launched when ready or if there was an error. Called with the error label or `false`,
* `canvasId` : id of the canvas from which the WebGL context used for deep learning processing will be created. It can also be directly a `<canvas>` element,
* `isDebugRender`: Boolean. If true, a debug rendering will be displayed on the `<canvas>` element. Useful for debugging, but it should be set to `false` for production because it wastes GPU computing resources.


### The Detection function
The function which triggers the detection is `JEEARAPI.detect(<int>nDetectionsPerLoop, <videoFrame>frame, <dictionary>options)`.
* `<int> nDetectionPerLoop` is the number of consecutive detections proceeded. The higher it is, the faster the detection will be. But it may slow down the whole application if it is too high because the function call will consume too much GPU resources. A value between `3` and `6` is advised.
* `<videoFrame> frame` is used only with WebXR demos (see [WebXR integration section](#webxr-integration)),
* `<dictionary> options` is an optional dictionary which can have these properties:
  * `<float> thresholdDetectFactor`: a factor applied on the detection thresholds for the detected object. The default value is `1`. For example if it equals `0.5`, the detection will be 2 times easier.
  * `<string> cutShader`: can tweak the default shader used to crop the video area. The possible values are:
    * `null`: default value, does not apply a filter and keep RGBA channels,
    * `IOS`: value optimized of IOS devices for WebXR usage only. Copy the red channel into the other color channels and apply a 5 pixels median filter.

The detection function returns an object, `detectState`. For optimization purpose it is assigned by reference, not by value. It is a dictionary with these properties:
* `<float> distance`: learning distance, ie distance between the camera and the object during the training of the dataset. Gives a clue about the real scale of the object,
* `<bool/string> label`: `false` if no object is detected, otherwise the label of the detected object. It is always in uppercase letters and it depends on the neural network,
* `<array4> positionScale`: array of floats storing 4 values: `[x,y,sx,sy]` where `x` and `y` are the normalized relative positions of the center of the detected object. `sx`, `sy` are the relative normalized scale factors of the detection window:
  * `x` is the position on the horizontal axis. It goes from `0` (left) to `1` (right),
  * `y` is the position on the vertical axis. It goes from `0` (bottom) to `1` (top),
  * `sx` is the scale on the horizontal axis. It goes from `0` (the size is null) to `1` (full size on horizontal axis),
  * `sy` is the scale on the vertical axis. It goes from `0` (null size) to `1` (full size on vertical axis),
* `<float> yaw`: the angle in radian of the rotation of the object around the vertical (Y) axis.


### Other methods
* `JEEFITAPI.set_NN(<string> neuralNetworkPath, <function> callback)`: switches the neural network, and call a function when it is finished, either with `false` as argument or with an error label,
* `JEEFITAPI.reset_state()`: returns to sweep mode,
* `JEEARAPI.get_aspectRatio()`: returns the aspect ratio `<width>/<height>` of the input source.

### WebXR integration
The WebXR demos principal code is directly in the `index.html` files. The 3D part is handled by *THREE.JS*.
The starting point of the demos is the examples provided by [WebXR viewer by the Mozilla Fundation]([github repository of demos](https://github.com/mozilla/webxr-polyfill/tree/master/examples)).

We use *Jeeliz AR* through a specific helper, `helpers/JeelizWebXRHelper.js` and we strongly advise to use this helper for your WebXR demos.
With the IOS implementation, it handles the video stream conversion (the video stream is given as *YCbCr* buffers. We take only the *Y* buffer and we apply a median filter on it.).



### Error codes
* Initialization errors (returned by `JEEARAPI.init` `callbackReady` callback):
  * `"GL_INCOMPATIBLE"`: WebGL is not available, or this WebGL configuration is not enough (there is no WebGL2, or there is WebGL1 without OES_TEXTURE_FLOAT or OES_TEXTURE_HALF_FLOAT extension),
  * `"ALREADY_INITIALIZED"`: the API has been already initialized,
  * `"GLCONTEXT_LOST"`: The WebGL context was lost. If the context is lost after the initialization, the `callbackReady` function will be launched a second time with this value as error code,
  * `"INVALID_CANVASID"`: cannot found the `<canvas>` element in the DOM. This error can be triggered only if `canvasId` is provided to the `init()` method.
* Neural network loading errors (returned by `JEEARAPI.set_NN` callback function):
  * `"INVALID_NN"`: The neural network model is invalid or corrupted,
  * `"NOTFOUND_NN"`: The neural network model is not found, or a HTTP error occured during the request.  

### Hosting
The demonstrations should be hosted on a static HTTPS server with a valid certificate. Otherwise WebXR or MediaStream API may not be available.

Be careful to enable gzip compression for at least JSON files. The neuron network model can be quite heavy, but fortunately it is well compressed with GZIP.



## Neural network models
We provide several neural network models in the [/neuralNets/](/neuralNets/) path. We will regularly add new neural networks in this Git repository. We can also provide specific neural network training services. Please [contact us here](https://jeeliz.com/contact-us/) for pricing and details. You can find here:

| model file    		 | detected labels 			 | input size 	| detection cost | reliability |
| :---         			 | :---        				 | :---         |     :---:      |     :---:   |
| `basic4.json`   		 | CUP,CHAIR,BICYCLE,LAPTOP  |  128*128px   | **			 |     **      |
| `basic4Light.json`     | CUP,CHAIR,BICYCLE,LAPTOP  |  64*64px     | *				 |      *      |

The input size is the resolution of the input image of the network. The detection window is not static: it slides along the video both for position and scale. If you use this library with WebXR and IOS, the video resolution will be `480*270` pixels, so a `64*64` pixels input will be enough. If for example you used a `128*128` pixels input neural network model, the input image would often need to be enlarged before being given as input.


## About the tech
### Under the hood
This library uses Jeeliz WebGL Deep Learning technology to detect objects. The neural network is trained using a 3D engine and a dataset of 3D models. All is processed client-side.

### Compatibility
* If `WebGL2` is available, it uses `WebGL2` and no specific extension is required,
* If `WebGL2` is not available but `WebGL1`, we require either `OES_TEXTURE_FLOAT` extension or `OES_TEXTURE_HALF_FLOAT` extension,
* If `WebGL2` is not available, and if `WebGL1` is not available or neither `OES_TEXTURE_FLOAT` or `OES_HALF_TEXTURE_FLOAT` are implemented, the user is not compatible.

If a compatibility error is triggered, please post an issue on this repository. If this is a problem with the webcam access, please first retry after closing all applications which could use your device (Skype, Messenger, other browser tabs and windows, ...). Please include:
* a screenshot of [webglreport.com - WebGL1](http://webglreport.com/?v=1) (about your `WebGL1` implementation),
* a screenshot of [webglreport.com - WebGL2](http://webglreport.com/?v=2) (about your `WebGL2` implementation),
* the log from the web console,
* the steps to reproduce the bug, and screenshots.


## License
[Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0.html). This application is free for both commercial and non-commercial use.

We appreciate attribution by including the [Jeeliz logo](https://jeeliz.com/wp-content/uploads/2018/01/LOGO_JEELIZ_BLUE.png) and a link to the [Jeeliz website](https://jeeliz.com) in your application or desktop website. Of course we do not expect a large link to Jeeliz over your face filter, but if you can put the link in the credits/about/help/footer section it would be great.


## See also
Jeeliz main face detection and tracking library is c[Jeeliz FaceFilter API](https://github.com/jeeliz/jeelizFaceFilter). It handles multi-face tracking, and for each tracked face it provides the rotation angles and the mouth opening factor. It is perfect to build your own Snapchat/MSQRD like face filters running in the browser. It comes with dozen of integration demo, including a face swap.

Our deep learning based library *Weboji* detects 11 facial expressions in real time from the webcam video feed. Then they are reproduced on an avatar, either in 3D with a THREE.JS renderer or in 2D with a SVG renderer (so you can use it even if you are not a 3D developer). You can access to the github repository [here](https://github.com/jeeliz/jeelizWeboji).

If you just want to detect if the user is looking at the screen or not, [Jeeliz Glance Tracker](https://github.com/jeeliz/jeelizGlanceTracker) is what you are looking for. It can be useful to play and pause a video whether the user is watching or not. This library needs fewer resources and the neural network file is much lighter.

If you want to use this library for glasses virtual try-on (sunglasses, spectacles, ski masks), you can take a look at [Jeeliz VTO widget](https://github.com/jeeliz/jeelizGlassesVTOWidget). It includes a high quality and lightweight 3D engine which implements the following features: deferred shading, PBR, raytraced shadows, normal mapping, ... It also reconstructs the lighting environment around the user (ambient and directional lighting). But the glasses comes from a database hosted in our servers. If you want to add some models, please contact us.


## References
* [ObjectNet3D, dataset used for training](http://cvgl.stanford.edu/projects/objectnet3d/)
* [Jeeliz official website](https://jeeliz.com)
* [WebXR specifications draft](https://immersive-web.github.io/webxr/)
* WebXR for iOS by the Mozilla Fundation: [github repository of the viewer](https://github.com/mozilla-mobile/webxr-ios), [WebXR viewer on Apple Appstore](https://itunes.apple.com/us/app/webxr-viewer/id1295998056), [github repository of demos](https://github.com/mozilla/webxr-polyfill)
* [MDN Media Streams API MediaConstraints doc](https://developer.mozilla.org/en-US/docs/Web/API/Media_Streams_API/Constraints)
* [Webgl Academy: interactive tutorials about WebGL and THREE.JS](http://www.webglacademy.com)