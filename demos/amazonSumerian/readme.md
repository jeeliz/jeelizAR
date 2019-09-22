 # JeelizAR Amazon Sumerian demo


You first need to have an Amazon AWS account to have access to the webapp Amazon Sumerian.
You can find more information on [aws.amazon.com/fr/sumerian/](https://aws.amazon.com/fr/sumerian/).

## Import the scene

`AmazonSumerianDemo.zip` is a scene exported as a bundle (Ctrl + E / Export as bundle). We will import it following these steps:
- Create a new Amazon Sumerian scene.
- Delete all the entities created by default, except the default camera (it is not removable).
- In the assets panel, use the wipe button of the *Default Pack* to remove all assets from your scene that are no longer in use.
- Click on the *Import Assets* button at the top and upload the `AmazonSumerianDemo.zip` file through the *Import from Disk* option on the right. It will take a few seconds.
- Set the imported camera, *Fixed Camera*, as main camera: selected it on the *ENTITIES* list, then select the checkbox *CAMERA/Main camera* in its properties.
- Remove the *Default Camera* (since it is not the main camera anymore it should be possible).

Now the scene is imported successfully.


## Publish and test the scene

Unfortunately the Amazon Sumerian *VIEW* mode does not play the scripts. You have to publish the scene to test it.
Click on *Publish* at the top right of the screen, then *Create a public link*, then *Publish*.
Copy and go at the given URL. It should be something like: `https://us-east-2.sumerian.aws/XXXX.scene`
It should work :)


## Modify the scripts
You have 3 scripts in the `canTracker` assets pack:
- `canMove.js`: this is the main script. It get the video, append it to the DOM, initialize *JeelizAR*, manage tracking and transition effects. It is also the entry point. It is bound to `canParent` entity,
- `JeelizStabilizer.js`: this script stabilize the movement for translation and rotation,
- `groundShader.js`: this script implement a custom shader for the ground disk.

The main script, `canMove.js` has 4 dependancies:
- `https://jeeliz.com/demos/augmentedReality/dist/jeelizAR.js`: main JeelizAR script,
- `https://jeeliz.com/demos/augmentedReality/helpers/JeelizMediaStreamAPIHelper.js`: Helper to get the video stream,
- `https://cdnjs.cloudflare.com/ajax/libs/tween.js/16.3.5/Tween.min.js`: the famous *Tween.js*, for transition effects,
- `https://jeeliz.com/demos/augmentedReality/neuralNets/awsSprite/sprite0.js`: neural network model in JSONP. We use JSONP instead of sending a XMLHttpRequest because we don't have to set specific HTTP headers for CORS.



## References
[Amazon Sumerian webapp](https://us-east-2.console.aws.amazon.com/sumerian)
[Amazon Sumerian API doc](https://content.sumerian.amazonaws.com/engine/latest/doc/)
[Scripting with Amazon Sumerian](https://docs.aws.amazon.com/fr_fr/sumerian/latest/userguide/sumerian-scripting.html)
[Download, Export or Backup Amazon Sumerian scenes](https://www.andreasjakl.com/download-export-or-backup-amazon-sumerian-scenes-part-6/)
