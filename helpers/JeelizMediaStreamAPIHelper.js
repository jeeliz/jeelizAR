 /**
 * Jeeliz AR - https://github.com/jeeliz/jeelizAR
 *
 * Copyright 2018 Jeeliz ( https://jeeliz.com )
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

"use strict;"
var JeelizMediaStreamAPIHelper={
  get_videoElement: function() {
    if (!JeelizMediaStreamAPIHelper.compat()) return false;
    const vid=document.createElement("video");
    return vid;
  },

  enable_HTMLprop: function(video, propName) {
    video[propName]=true;
    video.setAttribute(propName, 'true');
  },


  // ==== BEGIN CONFIG TESTS ====
  check_isMobile: function(){
    var check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator['userAgent']||navigator['vendor']||window['opera']);
    return check;
  },

  check_isIOS: function(){ //from https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
    const isIOS = /iPad|iPhone|iPod/.test(navigator['userAgent']) && !window['MSStream'];
    return isIOS;
  },

  get_IOSVersion: function(){ //from https://stackoverflow.com/questions/8348139/detect-ios-version-less-than-5-with-javascript
    // added on 2019-04-11 for a tweak for IOS>=12.2
    const v = (navigator['appVersion']).match(/OS (\d+)_(\d+)_?(\d+)?/);
    return [parseInt(v[1], 10), parseInt(v[2], 10), parseInt(v[3] || 0, 10)];
  },

  is_portrait: function(){ //https://stackoverflow.com/questions/4917664/detect-viewport-orientation-if-orientation-is-portrait-display-alert-message-ad
    try{
      if (window['matchMedia']("(orientation: portrait)")['matches']){
        return true;
      } else {
        return false;
      }
    } catch(e){
      return (window['innerHeight'] > window['innerWidth']);
    }
  },

  check_isApple: function(){
    return JeelizMediaStreamAPIHelper.check_isSafari() || JeelizMediaStreamAPIHelper.check_isIOS();
  },

  check_isSafari: function(){ //https://stackoverflow.com/questions/7944460/detect-safari-browser
    var ua = navigator['userAgent'].toLowerCase(); 
    if (ua.indexOf('safari') !== -1) { 
      if (ua.indexOf('chrome') !== -1) {
      return false;
    } else {
      return true;
    }
  }
  return false;
},

compat: function() {
  return (navigator['mediaDevices'] && navigator['mediaDevices']['getUserMedia'])?true:false;
},

  // ==== END CONFIG TESTS ====

  // ==== BEGIN VIDEOSTREAM HANDLING ====

  pause: function(vid) {
    vid['pause']();
  },

  restart: function(vid) {
    vid['play']();
  },
  
  release: function(vid){
    vid['pause']();
    if (vid['videoStream']) {
      vid['videoStream']['stop']();
    }
    vid['videoStream']=null;
    vid=null;
  },

  // ==== END VIDEOSTREAM HANDLING ====

  // ==== BEGIN CONSTRAINTS HANDLING ====

  clone_constraints: function(constraints){
    if (!constraints) return constraints;
    var videoConstraints=false;
    if (constraints['video']){

      const clone_sizeConstraint=function(sizeConstraint){
        const cst={};
        if (typeof(sizeConstraint['min'])!=='undefined'){
          cst['min']=sizeConstraint['min'];
        }
        if (typeof(sizeConstraint['max'])!=='undefined'){
          cst['max']=sizeConstraint['max'];
        }
        if (typeof(sizeConstraint['ideal'])!=='undefined'){
          cst['ideal']=sizeConstraint['ideal'];
        }
        return cst;
      }

      videoConstraints={};
      if (typeof(constraints['video']['width'])!=='undefined'){
        videoConstraints['width']=clone_sizeConstraint(constraints['video']['width']);
      }
      if (typeof(constraints['video']['height'])!=='undefined'){
        videoConstraints['height']=clone_sizeConstraint(constraints['video']['height']);
      }
      if (typeof(constraints['video']['facingMode'])!=='undefined'){
        videoConstraints['facingMode']=constraints['video']['facingMode'];
      }
    }

    const constraintsCloned={
      'audio': constraints['audio'],
      'video' : videoConstraints
    };

    if (typeof(constraints['deviceId'])!=='undefined'){
      constraintsCloned['deviceId']=constraints['deviceId'];
    }
    return constraintsCloned;
  }, //end clone_constraints()

  switch_widthHeight: function(constraints){
    const mvw=constraints['video']['width'];
    constraints['video']['width']=constraints['video']['height'];
    constraints['video']['height']=mvw;
    return constraints;
  },

  create_fallbackConstraints: function(constraints){
    //return an array of constraints to test
    const fallbackConstraints=[];

    if (!constraints || !constraints['video']) {
      return fallbackConstraints;
    }

    const add_constraintsTryon=function(constraintConstructor){
      var newConstraints=JeelizMediaStreamAPIHelper.clone_constraints(constraints);
      fallbackConstraints.push(constraintConstructor(newConstraints));
    }

    const get_closerResolutions=function(s){
      const standardResolutions=[480, 576, 640, 648, 720, 768, 800, 960, 1080, 1152, 1280, 1366, 1920];
      return standardResolutions.sort(function(sa, sb){
        return (Math.abs(sa-s)-Math.abs(sb-s));
      });
    }


    //try with constraints which are near the requested ones:
    if (constraints['video']['width'] && constraints['video']['height']){
      if (constraints['video']['width']['ideal'] && constraints['video']['height']['ideal']){
        const idealWidths= get_closerResolutions(constraints['video']['width']['ideal']).slice(0,3);
        const idealHeights=get_closerResolutions(constraints['video']['height']['ideal']).slice(0,3);
        for (var iw=0, w; iw<idealWidths.length; ++iw){
          w=idealWidths[iw];
          for (var ih=0, h; ih<idealHeights.length; ++ih){
            h=idealHeights[ih];
            if (w===constraints['video']['width']['ideal'] && h===constraints['video']['height']['ideal']){
              continue; //already tried first !
            }
            const aspectRatio=Math.max(w,h)/Math.min(w,h), tol=0.1;
            if (aspectRatio<4/3-tol || aspectRatio>16/9+tol){
              continue;
            }
            add_constraintsTryon(function(newConstraints){
              newConstraints['video']['width']['ideal']=w;
              newConstraints['video']['height']['ideal']=h;
              return newConstraints;
            });

          } //end loop on ih
        } //end loop on iw
      } //end if ideal width and height defined

      add_constraintsTryon(function(newConstraints){
        return JeelizMediaStreamAPIHelper.switch_widthHeight(newConstraints);
      });
    }

    //delete width and height informations:
    if (constraints['video']['width'] && constraints['video']['height']){
      if (constraints['video']['width']['ideal'] && constraints['video']['height']['ideal']){
        add_constraintsTryon(function(newConstraints){
          delete(newConstraints['video']['width']['ideal']);
          delete(newConstraints['video']['height']['ideal']);
          return newConstraints;
        });
      }

      add_constraintsTryon(function(newConstraints){
        delete(newConstraints['video']['width']);
        delete(newConstraints['video']['height']);
        return newConstraints;
      });
    }

    //remove the facingMode:
    if (constraints['video']['facingMode']){
      add_constraintsTryon(function(newConstraints){
        delete(newConstraints['video']['facingMode']);
        return newConstraints;
      });
      
      if (constraints['video']['width'] && constraints['video']['height']){
        add_constraintsTryon(function(newConstraints){
          JeelizMediaStreamAPIHelper.switch_widthHeight(newConstraints);
          delete(newConstraints['video']['facingMode']);
          return newConstraints;
        });
      }
    }

    fallbackConstraints.push({
      'audio': constraints['audio'],
      'video': true
    });

    return fallbackConstraints;
  }, //end create_fallbackConstraints()

  switch_whIfPortrait: function(mandatory){
    if (JeelizMediaStreamAPIHelper.is_portrait()){ //portrait display
      if (!mandatory || !mandatory['video']){
        return false;
      }
      const mandatoryVideoWidth=mandatory['video']['width'];
      const mandatoryVideoHeight=mandatory['video']['height'];
      if (!mandatoryVideoWidth || !mandatoryVideoHeight){
        return false;
      }
      if (mandatoryVideoWidth['ideal'] && mandatoryVideoHeight['ideal']
        && mandatoryVideoWidth['ideal']>mandatoryVideoHeight['ideal']){ //landscape resolution asked
        mandatory['video']['height']=mandatoryVideoWidth;
      mandatory['video']['width']=mandatoryVideoHeight;
      return true;
    }
  }
  return false;
},


  // ==== END CONSTRAINTS HANDLING ====

  mute: function(video){
    video['volume']=0.0;
    JeelizMediaStreamAPIHelper.enable_HTMLprop(video, 'muted');
    
    if (JeelizMediaStreamAPIHelper.check_isSafari()){ //MANTIS 182 
            console.log('INFO in JeelizMediaStreamAPIHelper - mute() : Safari detected');
            if (video['volume']===1){
                console.log('WARNING in JeelizMediaStreamAPIHelper - mute() : cannot mute the video. F****ing Safari !');
                function doMute(){
          video['volume']=0.0;
                    console.log('INFO in JeelizMediaStreamAPIHelper - mute() : mute this fucking volume by a fucking user action.');
                    window.removeEventListener('mousemove', doMute, false);
          window.removeEventListener('touchstart', doMute, false);
        }
        window.addEventListener('mousemove', doMute, false);
        window.addEventListener('touchstart', doMute, false);
      }

      setTimeout(function(){
        video['volume']=0.0;
        JeelizMediaStreamAPIHelper.enable_HTMLprop(video, 'muted');
      }, 5);
    } //end if safari
  }, //end mute()


  //get raw video stream (called by get())
  get_raw: function(video, callbackSuccess, callbackError, constraints){
    let isErrorRaw=false;

    const on_errorRaw=function(errCode){
      if (isErrorRaw){
        return;
      }
      isErrorRaw=true;
      callbackError(errCode);
    }
    const on_successRaw=function(video, localMediaStream, optionsReturned){
      if (isErrorRaw){
                console.log('WARNING in JeelizMediaStreamAPIHelper - get_raw(): cannot launch callbackSuccess because an error was thrown');
        console.log(JSON.stringify(constraints.video));
                return;
      }
            console.log('INFO in JeelizMediaStreamAPIHelper - get_raw(): callbackSuccess called with constraints=');
      console.log(JSON.stringify(constraints.video));
            callbackSuccess(video, localMediaStream, optionsReturned);
    }

    const promise=navigator['mediaDevices'].getUserMedia(constraints).then(
      // success callback
      function(localMediaStream) {
                console.log('INFO in JeelizMediaStreamAPIHelper - get_raw(): videoStream got');
        
        function callSuccessIfPlaying(){
          setTimeout(function(){
            if (video['currentTime']){
              var vw=video['videoWidth'], vh=video['videoHeight'];
              if (vw===0 || vh===0) { //against a firefox bug
                on_errorRaw('VIDEO_NULLSIZE');
                return;
              }
              //to avoid video freezing on Safari:
              if (vw) video['style']['width']=vw.toString()+'px';
              if (vh) video['style']['height']=vh.toString()+'px';

              const optionsReturned={
                capabilities: null,
                settings: null,
                mediaStreamTrack: null
              };
              try {
                const mediaStreamTrack = localMediaStream['getVideoTracks']()[0];
                if (mediaStreamTrack){
                  optionsReturned.mediaStreamTrack=mediaStreamTrack;
                  optionsReturned.capabilities = mediaStreamTrack['getCapabilities']();
                  optionsReturned.settings = mediaStreamTrack['getSettings']();
                }
                
              } catch(e){
                                console.log('WARNING in JeelizMediaStreamAPIHelper - get_raw(): Image Capture API not found');
                              }

              if (JeelizMediaStreamAPIHelper.check_isApple()){
              	              	console.log('WARNING in JeelizMediaStreamAPIHelper - Apple device detected, add the video element to the DOM.');
              	
                if (!video['parentNode'] || video['parentNode']===null){
                  //append the video to the DOM and makes it invisible
                  //if it is not already into the dom
                  document['body']['appendChild'](video);
                  JeelizMediaStreamAPIHelper.mute(video);

                  on_successRaw(video, localMediaStream, optionsReturned);
                  setTimeout(function(){
                    video['style']['transform']='scale(0.0001,0.0001)';
                    video['style']['position']='fixed';
                    video['style']['bottom']='0px';
                    video['style']['right']='0px';
                    JeelizMediaStreamAPIHelper.mute(video);

                    //from https://github.com/jeeliz/jeelizFaceFilter/issues/45
                    setTimeout(function () {
                     video['play']();
                   }, 100);

                  }, 80);
                } else {
                  on_successRaw(video, localMediaStream, optionsReturned);
                  setTimeout(function () {
                   video['play']();
                 }, 100);
                }
              } else { //not IOS  
                on_successRaw(video, localMediaStream, optionsReturned);
              }
            } else { //video.currentTime is null
              on_errorRaw('VIDEO_NOTSTARTED');
                            console.log('INFO in callSuccessIfPlaying(): video.currentTime=', video['currentTime']);
                          }
          }, 700); //check if the video has really started. 500ms -> too small
        } //end callSuccessIfPlaying()

        function onMetaDataLoaded() {
                    console.log('INFO in JeelizMediaStreamAPIHelper - get_raw() : video.onloadedmetadata dispatched');
          
          var playPromise=video['play']();
          JeelizMediaStreamAPIHelper.mute(video);
          
          if (typeof(playPromise) === 'undefined') {
            callSuccessIfPlaying();
          } else {
            playPromise.then(function() {
                        console.log('INFO in JeelizMediaStreamAPIHelper - get_raw() : playPromise accepted');
                        callSuccessIfPlaying();
          }).catch(function(error) {
                        console.log('ERROR in JeelizMediaStreamAPIHelper - get_raw() : playPromise failed - ', error);
                        on_errorRaw('VIDEO_PLAYPROMISEREJECTED');
          });
          } //end if playPromise
        } //end onMetaDataLoaded()

        if (typeof(video.srcObject)!=='undefined'){
          video['srcObject']=localMediaStream;
        } else {
          video['src'] = window['URL'].createObjectURL(localMediaStream);
          video['videoStream']=localMediaStream;
                    console.log('WARNING in JeelizMediaStreamAPIHelper - get_raw() : video.srcObject is not implemented. Old browser ?');
                  }

        JeelizMediaStreamAPIHelper.mute(video);
        video.addEventListener('loadeddata', onMetaDataLoaded, false);
      } //end promise then success callback
      ).catch(function(err){
        on_errorRaw(err);
      });

    

    return promise;
  }, //end get_raw()

  

  /* MAIN FUNCTION. ARGUMENTS :
   * video : DOM video element (not jquery !!!)
   * callback : function to launch if success, with video as argument
   * callbackError : function to launch if error happens
   * mandatory : optionnal. mandatory constraints
   */
   
   get: function(video, callbackSuccess, callbackError, mandatory) {
    if (!video){
            console.log('ERROR in JeelizMediaStreamAPIHelper.js - get() : No video provided');
            if (callbackError){
        callbackError('VIDEO_NOTPROVIDED');
      }
      return false;
    }

    if (!JeelizMediaStreamAPIHelper.compat()){
            console.log('ERROR in JeelizMediaStreamAPIHelper.js - get() : No getUserMedia API found !');
            if (callbackError){
        callbackError('MEDIASTREAMAPI_NOTFOUND');
      }
      return false;
    };

    if (mandatory && mandatory['video']){

      if (JeelizMediaStreamAPIHelper.check_isIOS()){ //otherwise video freeze quickly
                console.log('INFO in JeelizMediaStreamAPIHelper() - get() : iOS detected');
        
        //switch width and height video constraint if mobile portrait mode :
        //because if we are in portrait mode the video will be in portrait mode too
        
        const iOSVersion = JeelizMediaStreamAPIHelper.get_IOSVersion();
        //IOS is <12.2:
        if (iOSVersion[0]<12
          || (iOSVersion[0]===12 && iOSVersion[1]<2)){
          JeelizMediaStreamAPIHelper.switch_whIfPortrait(mandatory);
      }

      } /*else if (JeelizMediaStreamAPIHelper.check_isMobile()){
                console.log('INFO in JeelizMediaStreamAPIHelper() - get() : isMobile but not iOS');
              } //end if mobile
      */

      //see https://stackoverflow.com/questions/45692526/ios-11-getusermedia-not-working:
      if (mandatory['video']['width'] && mandatory['video']['width']['ideal']){
        video['style']['width']=mandatory['video']['width']['ideal']+'px';
      }
      if (mandatory['video']['height'] && mandatory['video']['height']['ideal']){
        video['style']['height']=mandatory['video']['height']['ideal']+'px';
      }
    } //end if mandatory.video

    JeelizMediaStreamAPIHelper.enable_HTMLprop(video, 'autoplay');
    JeelizMediaStreamAPIHelper.enable_HTMLprop(video, 'playsinline');
    var isAudio=(mandatory && mandatory['audio']);
    if (isAudio){
      video['volume']=0.0;
    } else {
      JeelizMediaStreamAPIHelper.enable_HTMLprop(video, 'muted');
    }

        console.log('INFO in JeelizMediaStreamAPIHelper() - get() : constraints =', JSON.stringify(mandatory));  
      

    JeelizMediaStreamAPIHelper.get_raw(video, callbackSuccess, function(err){
            console.log('WARNING in JeelizMediaStreamAPIHelper() - get() : cannot request video with this constraints. Downgrade constraints. err=', err);
            var fallbackConstraints=JeelizMediaStreamAPIHelper.create_fallbackConstraints(mandatory);

      var rec_tryConstraint=function(remainingConstraints){
        if (remainingConstraints.length===0){
          callbackError('INVALID_FALLBACKCONSTRAINS');
          return;
        }
        var testedConstraints=remainingConstraints.shift();
        JeelizMediaStreamAPIHelper.get_raw(video, callbackSuccess, function(err){
                    console.log('WARNING : fails with constraint = ', JSON.stringify(testedConstraints), err);
          
          rec_tryConstraint(remainingConstraints);
        }, testedConstraints);
      };
      rec_tryConstraint(fallbackConstraints);
    }, mandatory);
  }, //end JeelizMediaStreamAPIHelper.get()
  
  get_videoDevices: function(callback){
    if (!navigator['mediaDevices'] || !navigator['mediaDevices']['enumerateDevices']) {
            console.log("INFO in JeelizMediaStreamAPIHelper - get_videoDevices() : enumerateDevices() not supported");
            callback(false, 'NOTSUPPORTED');
      return false;
    }

    // List cameras and microphones :
    navigator['mediaDevices']['enumerateDevices']()
    .then(function(devices) {
      var videoDevices=devices.filter(function(device){
      return (device['kind'] && device['kind'].toLowerCase().indexOf('video')!==-1 && device['label'] && device['deviceId']);
    });
      if (videoDevices && videoDevices.length && videoDevices.length>0){ //there are multiple videoDevices
      callback(videoDevices, false);
      } else { //there are no videoDevices, or only 1
            console.log('ERROR in JeelizMediaStreamAPIHelper - get_videoDevices() : no devices founds');
            callback(false, 'NODEVICESFOUND');
    }
  })
    .catch(function(err) {
            console.log('ERROR in JeelizMediaStreamAPIHelper - get_videoDevices() : enumerateDevices promise rejected', err);
            callback(false, 'PROMISEREJECTED');
    });
  }, //end get_videoDevices()

  //use image capture api
  //test it with: JeelizMediaStreamAPIHelper.change_setting(debugVideoOptions.mediaStreamTrack, 'exposureCompensation', 3000)
  change_setting: function(mediaStreamTrack, settingId, settingValue){
    const constraint={};
    constraint[settingId]=settingValue;
    const advancedConstraintsList=[];
    advancedConstraintsList.push(constraint);
    mediaStreamTrack['applyConstraints']({ 'advanced': advancedConstraintsList})
    .catch(function(errMsg){
            console.log('ERROR in JeelizMediaStreamAPIHelper - change_setting(): ', errMsg);
          });
  }
};

