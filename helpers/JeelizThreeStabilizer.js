/*
spec:
  - <THREE.Object3D> obj3D: Object to stabilize
  - <integer> n: the size of the sliding window to compute floating average is 2^n. default: 3
  - <float> k: stabilization coefficient. Default: 1
  - <boolean> enablePositionSigmaWeighting. Default: false

 */
const JeelizThreeStabilizer = (function(){
  
  function computePositionsMean(positions, result){
    result.set(0, 0, 0);
    positions.forEach(function(pos){
      result.add(pos);
    });
    result.divideScalar(positions.length);
  }

  function computePositionSwitches(positions, positionMean, switchesCount){
    switchesCount.set(0, 0, 0);
    let sx = 0, sy = 0, sz = 0;
    positions.forEach(function(position, ind){
      const nsx = Math.sign(position.x - positionMean.x);
      const nsy = Math.sign(position.y - positionMean.y);
      const nsz = Math.sign(position.z - positionMean.z);
      if (ind > 0) {
        switchesCount.x += Math.abs((nsx - sx)) / 2.0;
        switchesCount.y += Math.abs((nsy - sy)) / 2.0;
        switchesCount.z += Math.abs((nsz - sz)) / 2.0;
      }
      sx = nsx, sy = nsy, sz = nsz;
    });
  }

  function computePositionSigmaFactor(N, switchesCount, sigmaFactor){
    if (N < 4) return;
    const denom = N - 2;
    sigmaFactor.set(
        (switchesCount.x - 1) / denom,
        (switchesCount.y - 1) / denom,
        (switchesCount.z - 1) / denom
      );
  }

  function computePositionsSigma(positions, mean, result){
    result.set(0, 0, 0);
    const diff = new THREE.Vector3();
    positions.forEach(function(pos){
      diff.copy(pos).sub(mean);
      diff.set(Math.abs(diff.x), Math.abs(diff.y), Math.abs(diff.z));
      result.add(diff);
    });
    result.divideScalar(positions.length);
  }

  function computeQuaternionsSigma(quaternions, mean){
    let angle = 0;
    quaternions.forEach(function(quat){
      angle += quat.angleTo(mean);
    });
    return angle / quaternions.length;
  }

  function stabilizeDiffComponent(diffVal, sigma, k){
    if (diffVal >=0 ){
      return Math.max(diffVal - k*sigma, 0);
    } else {
      return Math.min(diffVal + k*sigma, 0);
    }
  }

  return {
    instance: function(spec){
      let _counter = 0;
      let _curs = 0;
      
      const _spec = Object.assign({ //default values:
        n: 3,
        k: 1,
        enablePositionSigmaWeighting: false
      }, spec);
      const _N = Math.pow(2, _spec.n);
      const _quaternionSlerps = [];
      allocateQuaternionsMeansIntermediary();

      const _lastQuaternions = [];
      const _lastPositions = [];
      for (let i=0; i<_N; ++i){
        _lastPositions.push(new THREE.Vector3());
        _lastQuaternions.push(new THREE.Quaternion());
      }
      const _positionMean = new THREE.Vector3();
      const _quaternionMean = new THREE.Quaternion();

      const _positionSwitchesCount = new THREE.Vector3();
      const _positionSigmaFactor = new THREE.Vector3(1, 1, 1);
      const _positionSigma = new THREE.Vector3();

      const _positionStabilized = new THREE.Vector3();
      const _quaternionStabilized = new THREE.Quaternion();

      const _diffPosition = new THREE.Vector3();
      const _diffQuaternion = new THREE.Quaternion();
      const _quaternionMeanInv = new THREE.Quaternion();
      

      // private dynamic functions:
      function savePositionQuaternion(threePosition, threeQuaternion){
        _lastPositions[_curs].copy(threePosition);
        _lastQuaternions[_curs].copy(threeQuaternion);
        _curs = (_curs + 1) % _N;
      }

      function applyPositionQuaternion(threePosition, threeQuaternion){
        _spec.obj3D.quaternion.copy(threeQuaternion);
        _spec.obj3D.position.copy(threePosition);
      }

      function allocateQuaternionsMeansIntermediary(){
        for (let i=_spec.n-1; i>=0; --i){
          const quatSlerps = [];
          const l = Math.pow(2, i);
          for (let j=0; j<l; ++j) {
            quatSlerps.push(new THREE.Quaternion());
          }
          _quaternionSlerps.push(quatSlerps);
        }
      }

      function computeQuaternionsMean(quaternions, result){
        _quaternionSlerps.forEach(function(quaternionSlerpLevel, level){
          const previousLevelQuats = (level === 0) ? quaternions : _quaternionSlerps[level - 1];
          quaternionSlerpLevel.forEach(function(quat, i){
            THREE.Quaternion.slerp( previousLevelQuats[2*i], previousLevelQuats[2*i + 1], quat, 0.5 );
            if (level === _spec.n - 1){
              result.copy(quat);
            }
          });
        });
      }

      const that = {
        update: function(threePosition, threeQuaternion){
          if (++_counter < _N){
            applyPositionQuaternion(threePosition, threeQuaternion)
            savePositionQuaternion(threePosition, threeQuaternion);
            return;
          }

          // compute mean of orientation and position:
          computePositionsMean(_lastPositions, _positionMean);
          computeQuaternionsMean(_lastQuaternions, _quaternionMean);
          
          // compute sigma, represented by an angle and a Vector3:
          computePositionsSigma(_lastPositions, _positionMean, _positionSigma);
          
          if (_spec.enablePositionSigmaWeighting){
            computePositionSwitches(_lastPositions, _positionMean, _positionSwitchesCount);
            computePositionSigmaFactor(_N, _positionSwitchesCount, _positionSigmaFactor);
            _positionSigma.multiply(_positionSigmaFactor);
          }

          const angleSigma = computeQuaternionsSigma(_lastQuaternions, _quaternionMean);

          // compute stabilized position:
          _diffPosition.copy(threePosition).sub(_positionMean);
          _diffPosition.set(
            stabilizeDiffComponent(_diffPosition.x, _positionSigma.x, _spec.k),
            stabilizeDiffComponent(_diffPosition.y, _positionSigma.y, _spec.k),
            stabilizeDiffComponent(_diffPosition.z, _positionSigma.z, _spec.k)
          );
          _positionStabilized.copy(_positionMean).add(_diffPosition);

          // compute stabilized quaternion:
          const angle = _quaternionMean.angleTo(threeQuaternion);
          const angleStabilized = stabilizeDiffComponent(angle, angleSigma, _spec.k);
          _quaternionStabilized.copy(_quaternionMean).rotateTowards(threeQuaternion, angleStabilized);

          applyPositionQuaternion(_positionStabilized, _quaternionStabilized);
          savePositionQuaternion(threePosition, threeQuaternion);
        },

        reset: function(){
          _counter = 0;
          _positionSigmaFactor.set(1, 1, 1);
        }
      };
      return that;
    } // end instance()
  } // end class return value
})(); 
