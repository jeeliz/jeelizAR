/*
Coffee Animation
Dependancies:
- THREE.JS (v95)
- Tween.js
- TeapotBufferGeometry.js
*/

"use strict";

const CoffeeAnimation = (function(){

	const _settings = {
		particlesCount: 330,
		
		// animation timing:
		particleFallDuration: 1000, //in ms
		stopParticlesAfter: 3000,
		animationDuration: 3500,     //in ms

		// colors and lighting:
		teapotColor: 0xffffff,      //HTML notation
		ambientLightColor: 0xffeeaa,
		ambientLightIntensity: 1.2,
		directionalLightColor: 0xffffff,
		directionalLightIntensity: 0.6,
	};

	var _threeObject, _threeParticles, _threeTeapot, _threeObjectWrapper, _spec;
	const _timers = [];
	const _states = {
		notLoaded: -2,
		loading: -1,
		idle: 0,
		potRotating: 1,
		potFlowing: 2,
		potFlowingEnd: 3
	};
	let _state = _states.notLoaded;

	const _specDefault = {
			assetsPath: ''
		};

	//BEGIN PARTICLE FUNCTIONS
	//particle system is inspired from: https://threejs.org/examples/#canvas_particles_sprites
	function init_particles(){
		_threeParticles = new THREE.Object3D();
		_threeObject.add(_threeParticles);
		_threeParticles.visible = false;

		const material = new THREE.SpriteMaterial( {
			map: new THREE.TextureLoader().load( _spec.assetsPath + 'coffeeSprite.png' ),
			blending: THREE.NormalBlending,
		} );

		for ( let i = 0; i < _settings.particlesCount; ++i ) {
			const particle = new THREE.Sprite( material );
			_threeParticles.add( particle );
		}
	}

	function start_particles(){
		_threeParticles.visible = true;
		_threeParticles.children.forEach(function(particle, i){
			init_particle( particle, i * 3 );
		});
	}

	function stop_particles(){
		_state = _states.potFlowingEnd;
	}

	function init_particle( particle0, delay0 ) {
		const particle = (this instanceof THREE.Sprite) ? this : particle0;
		if (_state !== _states.potFlowing){
			particle.visible = false;
			return;
		}
		particle.visible = true;

		const delay = (delay0 !== undefined) ? delay0 : 0;

		particle.position.set( 0, 0, 0 );
		particle.scale.x = particle.scale.y = Math.random() * 0.003 + 0.008;

		new TWEEN.Tween( particle )
			.delay( delay )
			.to( {}, _settings.particleFallDuration )
			.onComplete( init_particle )
			.start();

		new TWEEN.Tween( particle.position )
			.delay( delay )
			.to({ x: Math.random() * 0.01 - 0.005 + 0.002*Math.cos(Date.now()/50)+ 0.05,
				  z: Math.random() * 0.01 - 0.005 + 0.002*Math.sin(Date.now()/60)}, _settings.particleFallDuration )
			.start();

		new TWEEN.Tween( particle.position )
			.easing(TWEEN.Easing.Quadratic.In)
			.delay( delay )
			.to({ y: -0.2}, _settings.particleFallDuration )
			.start();

		new TWEEN.Tween( particle.scale )
			.delay( delay )
			.to( { x: 0.005+Math.random()*0.003, y: 0.018+Math.random()*0.003 }, _settings.particleFallDuration )
			.start();
	}
	//END PARTICLES

	//BEGIN TEAPOT
	function init_teaPot(){
		const teapotGeometry = new THREE.TeapotBufferGeometry(0.06, 8);
		const teapotMaterial = new THREE.MeshLambertMaterial({
			color: _settings.teapotColor
		});
		_threeTeapot = new THREE.Mesh(teapotGeometry, teapotMaterial);
		_threeTeapot.position.set(-0.09,0.085,0)
		_threeObject.add(_threeTeapot);

		const dLight = new THREE.DirectionalLight( _settings.ambientLightColor, _settings.ambientLightIntensity );
		const aLight = new THREE.AmbientLight( _settings.directionalLightColor, _settings.directionalLightIntensity);
		_threeObject.add(aLight, dLight);
	}

	function start_teapotRotation(onComplete){
		_threeTeapot.rotation.z = 0; //horizontal position
		const delay = 500;

		//we cannot tween rotation directly.
		// see: https://stackoverflow.com/questions/30769091/tween-js-rotation-not-working-when-using-three-js-loader
		const tweenRot = {z: 0}; 
		new TWEEN.Tween( tweenRot )
			.easing(TWEEN.Easing.Quadratic.InOut)
			.delay( delay )
			.to({ z: -Math.PI/3}, 1000 )
			.onUpdate(function() {
				_threeTeapot.rotation.z = tweenRot.z;
			})
			.onComplete( onComplete )
			.start();
	}
	//END TEAPOT

	/*
	 * spec properties:
	 * <string> assetsPath: where to find the assets
	 */  
	const that = {
		init: function(spec){
			if (_state !== _states.notLoaded){
				return;
			}

			_spec = (spec) ? Object.assign({}, _specDefault, spec) : _specDefault;

			_state = _states.loading;

			_threeObjectWrapper = new THREE.Object3D();
			_threeObject = new THREE.Object3D();
			_threeObjectWrapper.add(_threeObject);
			_threeObject.visible = false;
			init_teaPot();
			init_particles();

			//move _threeObject so that the bottom of the coffee flow match with the origin
			_threeObject.position.set(-0.05, 0.21, 0);
			
			_state = _states.idle;
			
			return _threeObjectWrapper;
		},

		// start the animation:
		start: function(onComplete){
			if (_state !== _states.idle){
				return false;
			}
			_state = _states.potRotating;
			_threeObject.visible = true;

			start_teapotRotation(function(){
				_state = _states.potFlowing;
				start_particles();
				_timers.push(
					setTimeout(stop_particles, _settings.stopParticlesAfter),
					setTimeout(function(){
						_threeObject.visible = false;
						_state = _states.idle;
						if (onComplete){
							onComplete();
						}
					}, _settings.animationDuration)
				); //end timers.push
			}); //end start_teapotRotation callback

			return true;
		},

		// reset the animation:
		reset: function(){
			_threeObject.visible = false;
			_threeParticles.visible = false;
			TWEEN.removeAll();
			_timers.forEach(function(timer){
				clearTimeout(timer);
			});
			_timers.splice(0, _timers.length);
			_state = _states.idle;
		},

		// should be executed at each rendering loop
		update: function(){
			TWEEN.update();
		}
	};

	return that;
})();
