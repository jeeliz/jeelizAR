// Copyright (c) 2018 8th Wall, Inc.

window.onload = () => {
  const purple = 0xAD50FF

  // xr3js owns the 3JS scene, camera and renderer. It is responsible for driving the scene camera,
  // matching the camera field of view to the AR field of view, and for calling 'render' inside the
  // camera run loop.
  const xr3js = XR.ThreejsRenderer()
  window.debugXr3js=xr3js; //to access to the var in the web console

  // XR controller provides 6DoF camera tracking and interfaces for configuring tracking.
  const xrController = XR.xrController()
  window.debugController=xrController;

  // Populates some object into an XR scene and sets the initial camera position. The scene and
  // camera come from xr3js, and are only available in the camera loop lifecycle onStart() or later.
  const initXrScene = ({scene, camera}) => {
    // Add a grid of purple spheres to the scene. Objects in the scene at height/ y=0 will appear to
    // stick to physical surfaces.
    /*for (let i = -5; i <=5 ; i += .5) {
      for (let j = -5; j <= 5; j += .5) {
        if (Math.round(i) != i && Math.round(j) != j) { continue }
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(.03, 8, 8), new THREE.MeshBasicMaterial({color: purple}))
        sphere.position.set(i, 0, j)
        scene.add(sphere)
      }
    } //*/

    window.debugScene=scene;

    // Set the initial camera position relative to the scene we just laid out. This must be at a
    // height greater than y=0.
    camera.position.set(0, 3, 0)
  }

  // Add the xrController module, which enables 6DoF camera motion estimation.
  XR.addCameraPipelineModule(xrController.cameraPipelineModule())

  // Add a GLRenderer which draws the camera feed to the canvas.
  XR.addCameraPipelineModule(XR.GLRenderer())

  // Add xr3js which creates a threejs scene, camera, and renderer, and drives the scene camera
  // based on 6DoF camera motion.
  XR.addCameraPipelineModule(xr3js)

  //XR.addCameraPipelineModule(CameraModuleDebug.init());
  //XR.addCameraPipelineModule(CameraModuleJeelizAR.init());

  //callback function called when an object is detected:
  let _threeCamera, _threeScene, _threeCoffeeObject3D;
  const on_detect=function(detectState){
    if (!detectState || detectState.label!=='CUP'){
      return;
    }

    const pose=JeelizAR8thWallHelper.compute_pose(detectState, _threeCamera);

    console.log('INFO in index.js - on_detect(): a CUP is detected with pose=', pose);

    //hit test between pose.x, pose.y and floor:
    const threeHitPoint = JeelizAR8thWallHelper.compute_hitPoint(pose, _threeCamera);

    //update scale in pose:
    JeelizAR8thWallHelper.update_pose(threeHitPoint, _threeCamera, pose);

    //check that the size is realist:
   if (!JeelizAR8thWallHelper.check_size(pose, [3.0, 20.0])){
      console.log('WARNING in index.js - on_detect(): WRONG size. pose.scale=', pose.scale);
      return;
    } //*/
    //alert(pose.scale);

    //position, scale and rotate the coffee animation:
    _threeCoffeeObject3D.position.copy(threeHitPoint);
    _threeCoffeeObject3D.rotation.y=pose.yaw;
    _threeCoffeeObject3D.position.setY(0.15*pose.scale); //0.7*pose.scale
    _threeCoffeeObject3D.scale.set(pose.scale,pose.scale,pose.scale).multiplyScalar(1);
   
   
    //stop the detection to play the animation
    JeelizAR8thWallHelper.pause();

    CoffeeAnimation.start(function(){
      //callback called when animation has finished
      //alert('INFO in index.js: coffee animation finished');

      //restart the object detection:
      JeelizAR8thWallHelper.play();
    });
  }


  // Add custom logic to the camera loop. This is done with camera pipeline modules that provide
  // logic for key lifecycle moments for processing each camera frame. In this case, we'll be
  // adding onStart logic for scene initialization, and onUpdateWithResults logic for scene updates.
  XR.addCameraPipelineModule({
    // Camera pipeline modules need a name. It can be whatever you want but must be unique within
    // your app.
    name: 'ARCoffee',

    // onStart is called once when the camera feed begins. In this case, we need to wait for the
    // xr3js scene to be ready before we can access it to add content.
    onStart: ({canvasWidth, canvasHeight}) => {
      // Get the 3js sceen from xr3js.
      const {scene, camera} = xr3js.xrScene()
      _threeCamera=camera;
      _threeScene=scene;

      // Add some objects to the scene and set the starting camera position.
      initXrScene({scene, camera})

      JeelizAR8thWallHelper.init({
         callbackReady: function(errCode){
           if (errCode){
             console.log('Somethings goes wrong bro: ', errCode);
             return;
           }
           //add the coffee pot to the scene and init it:
           _threeCoffeeObject3D = CoffeeAnimation.init();
           _threeCoffeeObject3D.scale.multiplyScalar(0.5);
           _threeScene.add(_threeCoffeeObject3D);
           console.log('It is OK bro.');
         },
         callbackDetect: on_detect,
         neuralNet: '../../neuralNets/basic4.json',
         nDetectionPerLoop: 3,
         animateDelay: 2, //in ms
         scaleFactor: 200 //40
      });

      // Sync the xr controller's 6DoF position and camera paremeters with our scene.
      xrController.updateCameraProjectionMatrix({
        // NOTE: soon we won't require to specify cam, although clip planes will be optional.
        cam: {
          pixelRectWidth: canvasWidth,
          pixelRectHeight: canvasHeight,
          nearClipPlane: 0.01,
          farClipPlane: 1000
        },
        origin: camera.position,
        facing: camera.quaternion,
      })
    },

    // onUpdateWithResults is called once per camera loop prior to render. Any 3js geometry scene
    // would typically happen here.
    onUpdateWithResults: () => {
      CoffeeAnimation.update();
    },
  })

  // Call xrController.pause() / xrController.resume() when the button is pressed.
  document.getElementById('pause').addEventListener(
    'click',
    () => {
      if (!XR.isPaused()) {
        XR.pause()
        pauseButton.innerHTML = "RESUME"
        pauseButton.className = 'paused'
      } else {
        XR.resume()
        pauseButton.innerHTML = "PAUSE",
        pauseButton.className = ''
      }
    },
    true)

  // Call xrController.recenter() when the canvas is tapped with two fingers. This resets the
  // ar camera to the position specified by xrController.updateCameraProjectionMatrix() above.
  document.getElementById('xrweb').addEventListener(
    'touchstart',
    (e) => { if (e.touches.length == 2) { xrController.recenter() }},
    true)

  // Open the camera and start running the camera run loop.
  XR.run({canvas: document.getElementById('xrweb')})
} //end window.onload
