/*
Coffee Animation
Dependancies:
- THREE.JS (v95)
- Tween.js
- TeapotBufferGeometry.js
*/

"use strict";

const CoffeeAnimation=(function(){

	var _threeObject, _threeParticles, _threeTeapot, _threeObjectWrapper;
	var _states={
		notLoaded: -2,
		loading: -1,
		idle: 0,
		potRotating: 1,
		potFlowing: 2,
		potFlowingEnd: 3
	};
	var _state=_states.notLoaded;

	//BEGIN PARTICLE FUNCTIONS
	//particle system is inspired from: https://threejs.org/examples/#canvas_particles_sprites
	function init_particles(){
		_threeParticles=new THREE.Object3D();
		_threeObject.add(_threeParticles);
		_threeParticles.visible=false;

		var material = new THREE.SpriteMaterial( {
			map: new THREE.TextureLoader().load( 'coffeeSprite.png' ),
			blending: THREE.NormalBlending,//THREE.AdditiveBlending
		} );

		var i, particle;
		for ( i = 0; i < 330; ++i ) {
			particle = new THREE.Sprite( material );
			_threeParticles.add( particle );
		}
	}

	function start_particles(){
		_threeParticles.visible=true;
		_threeParticles.children.forEach(function(particle, i){
			init_particle( particle, i * 3 );
		});
	}

	function stop_particles(){
		_state=_states.potFlowingEnd;
	}

	function init_particle( particle, delay ) {
		var particle = this instanceof THREE.Sprite ? this : particle;
		if (_state!==_states.potFlowing){
			particle.visible=false;
			return;
		}
		particle.visible=true;

		var delay = delay !== undefined ? delay : 0;
	//	delay/=100;

		particle.position.set( 0, 0, 0 );
		particle.scale.x = particle.scale.y = Math.random() * 0.003 + 0.008;

		new TWEEN.Tween( particle )
			.delay( delay )
			.to( {}, 1000 )
			.onComplete( init_particle )
			.start();

		new TWEEN.Tween( particle.position )
			//.easing(TWEEN.Easing.Quadratic.Out)
			.delay( delay )
			.to({ x: Math.random() * 0.01 - 0.005 +0.002*Math.cos(Date.now()/50)+ 0.05,
				  z: Math.random() * 0.01 - 0.005 +0.002*Math.sin(Date.now()/60)}, 1000 )
			.start();

		new TWEEN.Tween( particle.position )
			.easing(TWEEN.Easing.Quadratic.In)
			.delay( delay )
			.to({ y: -0.2}, 1000 )
			.start();

		new TWEEN.Tween( particle.scale )
			.delay( delay )
			.to( { x: 0.005+Math.random()*0.003, y: 0.018+Math.random()*0.003 }, 1000 )
			.start();
	}
	//END PARTICLES

	//BEGIN TEAPOT
	function init_teaPot(){
		var teapotGeometry = new THREE.TeapotBufferGeometry(0.06, 8);
		var teapotMaterial = new THREE.MeshLambertMaterial({
			color: 0xffffff
		});
		_threeTeapot=new THREE.Mesh(teapotGeometry, teapotMaterial);
		_threeTeapot.position.set(-0.09,0.085,0)
		_threeObject.add(_threeTeapot);

		var dLight = new THREE.DirectionalLight( 0xFFFFFF, 1.2 );
		var aLight = new THREE.AmbientLight(0xFFFFFF, 0.6);
		_threeObject.add(aLight, dLight);
	}

	function start_teapotRotation(onComplete){
		_threeTeapot.rotation.z=0; //horizontal position
		const delay=500;

		//we cannot tween rotation directly.
		// see: https://stackoverflow.com/questions/30769091/tween-js-rotation-not-working-when-using-three-js-loader

		const tweenRot={z: 0}; 
		new TWEEN.Tween( tweenRot )
			.easing(TWEEN.Easing.Quadratic.InOut)
			.delay( delay )
			.to({ z: -Math.PI/3}, 1000 )
			.onUpdate(function() {
				_threeTeapot.rotation.z=tweenRot.z;
			})
			.onComplete( onComplete )
			.start();
	}
	//END TEAPOT

	const that={
		init: function(){
			if (_state!==_states.notLoaded){
				return;
			}
			_state=_states.loading;

			_threeObjectWrapper=new THREE.Object3D();
			_threeObject=new THREE.Object3D();
			_threeObjectWrapper.add(_threeObject);
			_threeObject.visible=false;
			init_teaPot();
			init_particles();

			//move _threeObject so that the bottom of the coffee flow match with the origin
			_threeObject.position.set(-0.05,0.21,0);
			
			_state=_states.idle;
			//return _threeObject;
			return _threeObjectWrapper;
		},

		start: function(onComplete){
			if (_state!==_states.idle){
				return false;
			}
			_state=_states.potRotating;
			_threeObject.visible=true;

			start_teapotRotation(function(){
				_state=_states.potFlowing;
				start_particles();
				setTimeout(stop_particles, 3000);
				setTimeout(function(){
					_threeObject.visible=false;
					_state=_states.idle;
					if (onComplete){
						onComplete();
					}
				}, 3500); //*/
			});

			return true;
		},

		update: function(){
			TWEEN.update();
		}
	};

	return that;
})();
