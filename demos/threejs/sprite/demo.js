const _settings={
  nDetectsPerLoop: 0, // 0 -> adaptative

  loadNNOptions: {
    notHereFactor: 0.0,
    paramsPerLabel: {
      SPRITECAN: {
        thresholdDetect: 0.5
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

  NNurl: '../../../neuralNets/sprite0.json',
  
  cameraFov: 0,//JeelizMediaStreamAPIHelper.evaluate_verticalFoV(),         //vertical field of View of the 3D camera in degrees. set 75 for mobile, 55 for desktop
  scanSettings:{
    margins: 0.2,       // 0-> no margin, 1-> 100% margins
    nSweepXYsteps: 6*6, //number of X,Y steps,
    nSweepSsteps: 4,    //number of scale steps. total number of sweep steps = nSweepXYsteps * nSweepSsteps
    sweepScaleRange: [0.12, 0.5], //range of the detection window scale. 1-> whole window minDim (do not take account of margins)
    sweepStepMinPx: 16, //minimum size of a step in pixels
    sweepShuffle: true  //randomize scaning
  },

  followZRot: true,
};

// some globals:
let _DOMvideo = null;

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
    stabilizerOptions: {}
  });
}

// Executed when JEEAR is initialized and NN is loaded:
function start(){
  const radius = 0.31;
  const height = radius * 3.5;

  const debugCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 20),
    new THREE.MeshNormalMaterial({wireframe: false})
  );

  // console.log('INFO in demo.js: start()');
  JeelizARThreeHelper.add('SPRITECAN', debugCylinder);

  animate();
}

//main loop (rendering + detecting)
function animate(){
  JeelizARThreeHelper.animate();
  window.requestAnimationFrame(animate);
}

window.addEventListener('load', main);
