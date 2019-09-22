/*
 spec properties:
  - <HTMLCanvasElement> ARCanvas
  - <HTMLCanvasElement> threeCanvas
  - <HTMLVideoElement> video
  - <function> callbackReady
  - <string> NNurl
  - <dict> loadNNOptions- 
  - <dict> detectOptions
  - <number> nDetectsPerLoop
  - <float> cameraFov. 0 for auto estimation
  - <boolean> followZRot
  - <dict> scanSettings
  - <object> stabilizerOptions
  - <boolean> isFullScreen
 */
"use strict";

const JeelizARThreeHelper = (function(){
  const _settings = {
    cameraMinVideoDimFov: 47, // FoV along the minimum video dimension (height or width), in degrees
    cameraZNear: 0.1,
    cameraZFar: 500
  };

  let _video = null, _nDetectsPerLoop = null, _detectOptions = null;
  let _threeCamera = null, _threeScene = null, _threeEuler = null, _threeQuaternion = null, _threePosition = null, _threeContainers = {}, _threeRenderer = null;
  let _stabilizerOptions = null, _stabilizers = {}, _isStabilized = false;
  let _cameraAutoFoV = false, _scaleW = 1, _isFullScreen = false;

  const _callbacks = {};

  const that = {
    init: function(spec){
      // initialize JEEAR:
      JEEARAPI.init({
        video: spec.video,
        canvas: spec.ARCanvas,
        followZRot: spec.followZRot,
        scanSettings: spec.scanSettings
      });

      // Extract parameters:
      _video = spec.video;
      _isStabilized = (spec.stabilizerOptions !== undefined && JeelizThreeStabilizer) ? true : false;
      _stabilizerOptions = (_isStabilized) ? spec.stabilizerOptions : null;
      _nDetectsPerLoop = spec.nDetectsPerLoop;
      _detectOptions = spec.detectOptions;
      _cameraAutoFoV = (spec.cameraFov) ? false : true;
      _isFullScreen = (spec.isFullScreen) ? true : false;

      // Initialize THREE.js instances:
      _threeRenderer = new THREE.WebGLRenderer({
        canvas: spec.threeCanvas,
        alpha: true
      });

      _threeScene = new THREE.Scene();
      _threeCamera = (_cameraAutoFoV ) ? that.create_autoFoVCamera() : new THREE.PerspectiveCamera( spec.cameraFov, spec.threeCanvas.width / spec.threeCanvas.height, _settings.cameraZNear, _settings.cameraZFar );
      _threeEuler = new THREE.Euler(0, 0, 0, 'ZXY');
      _threePosition = new THREE.Vector3();
      _threeQuaternion = new THREE.Quaternion();

      // Set neural network model:
      JEEARAPI.set_NN(spec.NNurl, function(err){
        if (!err){
          that.resize();
        }
        spec.callbackReady(err);
      }, spec.loadNNOptions);
    },

    resize: function(){
      const w = _video.videoWidth;
      const h = _video.videoHeight;
      const canvas = _threeRenderer.domElement;
      if (_isFullScreen){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      } else {
        canvas.width  = w;
        canvas.height = h;
      }
      if (_cameraAutoFoV){
        that.update_autoFoVCamera();
      } else {
        _threeRenderer.setSize(w,h);
        _threeCamera.aspect = w / h;
        _threeCamera.updateProjectionMatrix();
      }
    },

    animate: function(){
      const detectState = JEEARAPI.detect(_nDetectsPerLoop, null, _detectOptions);
      
      for(let label in _threeContainers){
        const threeContainer = _threeContainers[label];

        if (!detectState.label || detectState.label!==label){
          if (threeContainer.visible){
            that.trigger_callback(label, 'onloose');
          }
          threeContainer.visible = false;
          continue;
        }
        
        if (!threeContainer.visible && _isStabilized){
          _stabilizers[label].reset();
        }

        if (!threeContainer.visible){
          that.trigger_callback(label, 'ondetect');
        }
        threeContainer.visible = true;
        //console.log('INFO in JeeARDemo.on_detect() : ', detectState.label, 'WAS CONFIRMED YEAH !');
        //compute position:
        const halfTanFOV = Math.tan(_threeCamera.aspect * _threeCamera.fov * Math.PI/360); 

        const s = detectState.positionScale[2] * _scaleW;

        //move the cube in order to fit the head
        const W = s;                        //relative width of the detection window (1-> whole width of the detection window)
        const D = 1 / (2 * W * halfTanFOV); //distance between the front face of the cube and the camera
        
        //coords in 2D of the center of the detection window in the viewport :
        const xv = (2 * detectState.positionScale[0] - 1) * _scaleW;
        const yv = 2 * detectState.positionScale[1] - 1;
        
        //coords in 3D of the center of the cube (in the view coordinates system)
        const z = -D - 0.5;   // minus because view coordinate system Z goes backward. -0.5 because z is the coord of the center of the cube (not the front face)
        const x = xv * D * halfTanFOV;
        const y = yv * D * halfTanFOV / _threeCamera.aspect;
        _threePosition.set(x, y, z);

        // compute rotation:
        const dPitch = detectState.pitch - Math.PI / 2;
        _threeEuler.set( -dPitch, detectState.yaw + Math.PI, -detectState.roll);
        _threeQuaternion.setFromEuler(_threeEuler);

        // apply position and rotation:
        if (_isStabilized){
          _stabilizers[label].update(_threePosition, _threeQuaternion);
        } else { // no stabilization, directly assign position and orientation:
          threeContainer.position.copy(_threePosition);
          threeContainer.quaternion.copy(_threeQuaternion);
        }
      } //end for

      _threeRenderer.render(_threeScene, _threeCamera);
    },

    add: function(label, threeStuff){
      // build the threeContainer, which will track the detected object:
      const isNew = (_threeContainers[label]) ? false : true;
      const threeContainer = (isNew) ? new THREE.Object3D() : _threeContainers[label];
      _threeContainers[label] = threeContainer;
      threeContainer.add(threeStuff);

      if (isNew) {
        _threeScene.add(threeContainer);
        
        // initialize stabilizer if required:
        if (_isStabilized){
          _stabilizers[label] = JeelizThreeStabilizer.instance(Object.assign({
            obj3D: threeContainer
          }, _stabilizerOptions));
        }
      }
    },

    set_callback: function(label, callbackType, callbackFunc){
      if (!_callbacks[label]){
        _callbacks[label] = {
          ondetect: null,
          onloose: null
        }
      }
      _callbacks[label][callbackType] = callbackFunc;
    },

    trigger_callback: function(label, callbackType, args){
      if (!_callbacks[label] || _callbacks[label][callbackType] === null){
        return;
      }
      _callbacks[label][callbackType](args);
    },

    create_autoFoVCamera: function(zNear, zFar){
      _threeCamera = new THREE.PerspectiveCamera(1, 1, (zNear) ? zNear : _settings.cameraZNear, (zFar) ? zFar : _settings.cameraZFar);
      that.update_autoFoVCamera();
      return _threeCamera;
    },

    update_autoFoVCamera: function(){
      // compute aspectRatio:
      const canvasElement = _threeRenderer.domElement;
      const cvw = canvasElement.width;
      const cvh = canvasElement.height;
      const canvasAspectRatio = cvw / cvh;

      // compute vertical field of view:
      const vw = _video.videoWidth;
      const vh = _video.videoHeight;
      const videoAspectRatio = vw / vh;
      const fovFactor = (vh > vw) ? (1.0 / videoAspectRatio) : 1.0;
      const fov = _settings.cameraMinVideoDimFov * fovFactor;
      
      // compute X and Y offsets in pixels:
      let scale = 1.0;
      if (canvasAspectRatio > videoAspectRatio) {
        // the canvas is more in landscape format than the video, so we crop top and bottom margins:
        scale = cvw / vw;
      } else {
        // the canvas is more in portrait format than the video, so we crop right and left margins:
        scale = cvh / vh;
      }
      const cvws = vw * scale, cvhs = vh * scale;
      const offsetX = (cvws - cvw) / 2.0;
      const offsetY = (cvhs - cvh) / 2.0;
      _scaleW = cvw / cvws;
      
      // apply parameters:
      _threeCamera.aspect = canvasAspectRatio;
      _threeCamera.fov = fov;
      console.log('INFO in JeelizThreeHelper.update_camera() : camera vertical estimated FoV is', fov);
      _threeCamera.setViewOffset(cvws, cvhs, offsetX, offsetY, cvw, cvh);
      _threeCamera.updateProjectionMatrix();

      // update drawing area:
      _threeRenderer.setSize(cvw, cvh);
      _threeRenderer.setViewport(0, 0, cvw, cvh);
    }

  }; //end that
  return that;
})();