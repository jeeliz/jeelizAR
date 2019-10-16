const _settings = {
  nDetectsPerLoop: 0, // 0 -> adaptative

  loadNNOptions: {
    notHereFactor: 0.0,
    paramsPerLabel: {
      CUP: {
        thresholdDetect: 0.92
      }
    }
  },

  detectOptions: {
    isKeepTracking: true,
    isSkipConfirmation: false,
    thresholdDetectFactor: 1,
    cutShader: 'median',
    thresholdDetectFactorUnstitch: 0.2,
    trackingFactors: [0.5,0.4,1.5],
  },

  NNurl: '../../../neuralNets/ARCoffeeStandalone02.json',

  cameraFov: 0, // In degrees, camera vertical FoV. 0 -> auto mode
  scanSettings:{
    margins: 0.2,       // 0-> no margin, 1-> 100% margins
    nSweepXYsteps: 6*6, //number of X,Y steps,
    nSweepSsteps: 4,    //number of scale steps. total number of sweep steps = nSweepXYsteps * nSweepSsteps
    sweepScaleRange: [0.12, 0.5], //range of the detection window scale. 1-> whole window minDim (do not take account of margins)
    sweepStepMinPx: 16, //minimum size of a step in pixels
    sweepShuffle: true  //randomize scaning
  },

  followZRot: true,

  displayDebugCylinder: false
};

// some globals:
let _DOMvideo = null;
let _isFirstDetection = true;

// entry point:
function main(){
  _DOMvideo = document.getElementById('webcamVideo');
  JeelizMediaStreamAPIHelper.get(_DOMvideo, init, function(err){
    throw new Error('Cannot get video feed ' + err);
  }, {
    video: {
      // width:  {min: 640, max: 1280, ideal: 720},
      // height: {min: 640, max: 1280, ideal: 1024},
      facingMode: {ideal: 'environment'}
    },
    audio: false
 });
}

// executed when video is OK:
function init(){
  const ARCanvas = document.getElementById('ARCanvas');

  JeelizARThreeHelper.init({
    video: _DOMvideo,
    ARCanvas: ARCanvas,
    threeCanvas: document.getElementById('threeCanvas'),
    NNurl: _settings.NNurl,
    callbackReady: start,
    loadNNOptions: _settings.loadNNOptions,
    nDetectsPerLoop: _settings.nDetectsPerLoop,
    detectOptions: _settings.detectOptions,
    cameraFov: _settings.cameraFov,
    followZRot: _settings.followZRot,
    scanSettings: _settings.scanSettings,
    isFullScreen: true,
    stabilizerOptions: {}
  });
}

// Executed when JEEAR is initialized and NN is loaded:
function start(){
  if (_settings.displayDebugCylinder){
    const radius = 0.5;
    const height = radius * 1.5;

    const debugCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 20),
      new THREE.MeshNormalMaterial({wireframe: false, opacity: 0.5})
    );

    JeelizARThreeHelper.add('CUP', debugCylinder);
  }

  const threeCoffee = CoffeeAnimation.init({
    assetsPath: '../../webxrCoffee/', //where to find coffeeSprite.png
  });
  threeCoffee.scale.multiplyScalar(4);
  threeCoffee.position.set(0.0, 0.2, -0.2);
  JeelizARThreeHelper.add('CUP', threeCoffee);
  JeelizARThreeHelper.set_callback('CUP', 'ondetect', function(){
    if (_isFirstDetection){
      document.getElementById('userManual').style.opacity = '0';
      _isFirstDetection = false;
    }
    CoffeeAnimation.start();
  });
  JeelizARThreeHelper.set_callback('CUP', 'onloose', CoffeeAnimation.reset);
  animate();
}

//main loop (rendering + detecting)
function animate(){
  CoffeeAnimation.update();
  JeelizARThreeHelper.animate();
  window.requestAnimationFrame(animate);
}

function resize(){
  JeelizARThreeHelper.resize();
}

window.addEventListener('load', main);
window.addEventListener('resize', resize);

