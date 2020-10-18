
/**
* Gravy is the global object providing access to all functionality in the system.
* @constructor
* @param {Potential} sceneObj - The object defining the gravitational potential
*/
var Gravy = function(potentialObj)
{
	this.initialized = false;
	this.terminated = false;
	this.rendering = false;
	this.potentialObj = potentialObj;
	gravy = this;

	let container = document.getElementById("container");
	this.container = container;

	var render_canvas = document.getElementById('render-canvas');
	this.render_canvas = render_canvas;
	this.width = render_canvas.width;
	this.height = render_canvas.height;
	render_canvas.style.width = render_canvas.width;
	render_canvas.style.height = render_canvas.height;

	var text_canvas = document.getElementById('text-canvas');
	this.text_canvas = text_canvas;
	this.textCtx = text_canvas.getContext("2d");
	this.onGravyLink = false;
	this.onUserLink = false;

	window.addEventListener( 'resize', this, false );

	// Setup THREE.js orbit camera
	var VIEW_ANGLE = 45;
	var ASPECT = this.width / this.height;
	var NEAR = 0.05;
	var FAR = 1000;
	this.camera = new THREE.PerspectiveCamera(VIEW_ANGLE, ASPECT, NEAR, FAR);
	this.camera.lookAt(new THREE.Vector3(0.0, 0.0, 0.0));
	this.camera.position.set(1.0, 1.0, 1.0);

	this.camControls = new THREE.OrbitControls(this.camera, this.container);
	this.camControls.zoomSpeed = 2.0;
	this.camControls.flySpeed = 0.01;
	this.camControls.addEventListener('change', camChanged);
	this.camControls.keyPanSpeed = 100.0;

	this.gui = null;
	this.guiVisible = true;

	// Instantiate raytracer
	this.raytracer = new Raytracer();
	this.auto_resize = true;

	// Allow user to define the gravitational potential, and also programmatically initialize the camera and raytracer
	this.initPotential();

	// Do initial resize:
	this.resize();

	// Create dat gui
	this.gui = new GUI(this.guiVisible);

	// Setup keypress and mouse events
	window.addEventListener( 'mousemove', this, false );
	window.addEventListener( 'mousedown', this, false );
	window.addEventListener( 'mouseup',   this, false );
	window.addEventListener( 'contextmenu',   this, false );
	window.addEventListener( 'click', this, false );
	window.addEventListener( 'keydown', this, false );

	this.initialized = true;
}

/**
* Returns the current version number of the Gravy system, in the format [1, 2, 3] (i.e. major, minor, patch version)
*  @returns {Array}
*/
Gravy.prototype.getVersion = function()
{
	return [1, 0, 2];
}

Gravy.prototype.handleEvent = function(event)
{
	switch (event.type)
	{
		case 'resize':      this.resize();  break;
		/*
		case 'mousemove':   this.onDocumentMouseMove(event);  break;
		case 'mousedown':   this.onDocumentMouseDown(event);  break;
		case 'mouseup':     this.onDocumentMouseUp(event);    break;
		case 'contextmenu': this.onDocumentRightClick(event); break;
		case 'click':       this.onClick(event);  break;
		case 'keydown':     this.onkeydown(event);  break;
		*/
	}
}

/**
* Access to the Renderer object
*  @returns {Renderer}
*/
Gravy.prototype.getRaytracer = function()
{
	return this.raytracer;
}


Gravy.prototype.getPotential = function()
{
	return this.potentialObj;
}


/**
* Access to the GUI object
*  @returns {GUI}
*/
Gravy.prototype.getGUI = function()
{
	return this.gui;
}

/**
* Access to the camera object
* @returns {THREE.PerspectiveCamera}.
*/
Gravy.prototype.getCamera = function()
{
	return this.camera;
}

/**
* Access to the camera controller object
* @returns {THREE.OrbitControls}
*/
Gravy.prototype.getControls = function()
{
	return this.camControls;
}

/**
 * @returns {WebGLRenderingContext} The webGL context
 */
Gravy.prototype.getGLContext = function()
{
	return GLU.gl;
}


/**
* Programmatically show or hide the dat.GUI UI
* @param {Boolean} show - toggle
*/
Gravy.prototype.showGUI = function(show)
{
	this.guiVisible = show;
}



Gravy.prototype.dumpScene = function()
{
	let camera = this.camera;
	let controls = this.camControls;
	let raytracer = this.raytracer;

	var code = `/******* copy-pasted console output on 'O', begin *******/\n`;
	code += `
let raytracer  = gravy.getRaytracer();
let camera    = gravy.getCamera();
let controls  = gravy.getControls();
	`;

	if (typeof this.potentialObj.initGenerator !== "undefined")
	{
		code += this.potentialObj.initGenerator();
	}

	code += this.guiVisible ? `\ngravy.showGUI(true);\n` : `\ngravy.showGUI(false);\n`;

	code += `
/** Camera settings **/
gravy.fov = ${gravy.fov};
camera.up.set(${camera.up.x}, ${camera.up.y}, ${camera.up.z});
camera.position.set(${camera.position.x}, ${camera.position.y}, ${camera.position.z});
controls.target.set(${controls.target.x}, ${controls.target.y}, ${controls.target.z});

/** Raytracer settings **/
raytracer.raySize = ${raytracer.raySize};
raytracer.maxNumSteps = ${raytracer.maxNumSteps};
raytracer.marchDistance = ${raytracer.marchDistance};
raytracer.exposure = ${raytracer.exposure};
raytracer.gamma = ${raytracer.gamma};
raytracer.sourceDist = ${raytracer.sourceDist};
raytracer.sourceRadius = ${raytracer.sourceRadius};
raytracer.sourceBeamAngle = ${raytracer.sourceBeamAngle};
raytracer.timeScale = ${raytracer.timeScale};
raytracer.timePeriodSecs = ${raytracer.timePeriodSecs};
raytracer.colorA = [${raytracer.colorA[0]}, ${raytracer.colorA[1]}, ${raytracer.colorA[2]}];
raytracer.colorB = [${raytracer.colorB[0]}, ${raytracer.colorB[1]}, ${raytracer.colorB[2]}];

/******* copy-pasted console output on 'O', end *******/
	`;

	return code;
}

Gravy.prototype.initPotential = function()
{
	if (this.potentialObj == null) return;
	if (typeof this.potentialObj.program == "undefined") GLU.fail('Potential must define a "program" function!');

	let lengthScale = this.potentialObj.getScale();

	this.minScale = 1.0e-4 * lengthScale;
	this.maxScale = 1.0e3 * lengthScale;
	if (typeof this.potentialObj.getMinScale !== "undefined") this.minScale = this.potentialObj.getMinScale();
	if (typeof this.potentialObj.getMaxScale !== "undefined") this.maxScale = this.potentialObj.getMaxScale();
	this.minScale = Math.max(1.0e-6, this.minScale);
	this.maxScale = Math.min(1.0e20, this.maxScale);

	// Set initial default camera position and target based on max scale
	let po = lengthScale; // @todo: should be e.g. 10.0 * this.sceneScale
	this.camera.position.set(po, po, po);
	this.camControls.target.set(0.0, 0.0, 0.0);

	// Call user-defined init function
	if (typeof this.potentialObj.init != "undefined") this.potentialObj.init(this);

	// Read optional scene name and URL, if provided
	this.sceneName = '';
	this.sceneURL = '';
	if (typeof this.potentialObj.getName !== "undefined") this.sceneName = this.potentialObj.getName();
	if (typeof this.potentialObj.getURL !== "undefined") this.sceneURL = this.potentialObj.getURL();

	// cache initial camera position to allow reset on 'F'
	this.initial_camera_position = new THREE.Vector3();
	this.initial_camera_position.copy(this.camera.position);
	this.initial_camera_target = new THREE.Vector3();
	this.initial_camera_target.copy(this.camControls.target);

	// Compile GLSL shaders
	this.raytracer.compileShaders();

	// Fix renderer to width & height, if they were specified
	if ((typeof this.raytracer.width!=="undefined") && (typeof this.raytracer.height!=="undefined"))
	{
		this.auto_resize = false;
		this._resize(this.raytracer.width, this.raytracer.height);
	}

	// Camera setup
	this.camera.near = this.minScale;
	this.camera.far  = this.maxScale;
	this.camControls.update();
	this.reset(false);

	// Saver Setup
	this.animFrame = 0;
}


// Renderer reset on camera or other parameters update
Gravy.prototype.reset = function(no_recompile = false)
{
	if (!this.initialized || this.terminated) return;
	this.raytracer.reset(no_recompile);
}


///////////////////////////////////
Gravy.prototype.preframeCallback = function(gl)
{
	let renderer  = this.getRaytracer();
	let camera    = this.getCamera();
	let controls  = this.getControls();
	let gui       = this.getGUI();

	let FPS = 24.0;
	let time = this.animFrame/FPS;
	this.endFrame = 10.0 * FPS; // frames = seconds * frames/second

	/*
		 CAMERA CHANGE  =  RE RENDER ALL LINES (ie. this.reset() occurs)
		 - will make shapiro effect fail
	*/
	let movement = false;

	if (this.animFrame==0)
	{
		this.advanceFrame = false;
		///
		// Do any one-time initial setup of the scene state here
		///
	}

	///
	// Animate scene state according to current time value here
	// (e.g. update scene, camera, materials or renderer parameters)
	///

  let i = (this.animFrame)/this.endFrame; // [0 -> 1] completion interpolant

	console.log("interpolant : " + i);

	if (movement==true){

			let pos0 = new THREE.Vector3(-80.50191689209592, 61.07658249868336, -111.39383308993129);
			let pos1 = new THREE.Vector3(-82.29843492907813, 86.58581022527527, 73.10256174781598);
			let pos = new THREE.Vector3();

			pos.addVectors( pos0.multiplyScalar(1.0 - i), pos1.multiplyScalar(i) );

			console.log("set position : " + pos.x +' '+ pos.y +' '+ pos.z);

			camera.position.set(pos.x, pos.y, pos.z);
			controls.update();
	}

	if (this.animFrame==0)
	{
		this.advanceFrame = false;
	}

	// Advance scene state to next anim frame, if we just exported a rendered frame
	if (this.advanceFrame)
	{
		//gui.sync();
		let no_recompile = true;

		if (movement==true){
			this.reset(no_recompile);
		}

		this.advanceFrame = false;
	}
}

Gravy.prototype.postframeCallback = function(gl)
{
	// return;
	let renderer  = this.getRaytracer();
	let targetWaves = 100.0; // essentially a pre-delay

	//console.log('waves, target: ' + renderer.wavesTraced + ' '+ targetWaves);
	//console.log('animF, endFra: ' + this.animFrame + ' '+ this.endFrame);

	// User code to post webGL framebuffer data to local server for processing
	if (this.animFrame>=0 && renderer.wavesTraced>=targetWaves && this.animFrame<=this.endFrame)
	{
		console.log(this.animFrame);
		let dataURI = gl.canvas.toDataURL();
		var mimetype = dataURI.split(",")[0].split(':')[1].split(';')[0];
		var byteString = atob(dataURI.split(',')[1]);
		var u8a = new Uint8Array(byteString.length);
		for (var i = 0; i < byteString.length; i++)
		{
			u8a[i] = byteString.charCodeAt(i);
		}
		let blob = new Blob([u8a.buffer], { type: mimetype });
		let r = new XMLHttpRequest();
		r.open('POST', 'http://localhost:3999/' + this.animFrame, false);
		r.send(blob);

		this.advanceFrame = true;
		this.animFrame++;
	}
}
///////////////////////////////////


// Render all
Gravy.prototype.render = function()
{
	var gl = GLU.gl;
	gl.viewport(0, 0, this.width, this.height);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.enable(gl.DEPTH_TEST);

	if (!this.initialized || this.terminated) return;
	if (this.potentialObj == null) return;
	this.rendering = true;

	this.preframeCallback(gl);

	// Render lensed light via raytracing
	this.raytracer.render();

	this.postframeCallback(gl);

	// Update HUD text canvas
	this.textCtx.textAlign = "left";   	// This determines the alignment of text, e.g. left, center, right
	this.textCtx.textBaseline = "middle";	// This determines the baseline of the text, e.g. top, middle, bottom
	this.textCtx.font = '12px monospace';	// This determines the size of the text and the font family used
	this.textCtx.clearRect(0, 0, this.textCtx.canvas.width, this.textCtx.canvas.height);
	this.textCtx.globalAlpha = 0.95;
	this.textCtx.strokeStyle = 'black';
	this.textCtx.lineWidth  = 2;
	if (this.guiVisible)
	{
	  	if (this.onGravyLink) this.textCtx.fillStyle = "#ff5500";
	  	else                  this.textCtx.fillStyle = "#ffff00";
	  	let ver = this.getVersion();
	  	this.textCtx.strokeText('Gravy v'+ver[0]+'.'+ver[1]+'.'+ver[2], 14, 20);
	  	this.textCtx.fillText('RENDERING Gravy lensing simulator v'+ver[0]+'.'+ver[1]+'.'+ver[2], 14, 20);

	  	if (this.sceneName != '')
	  	{
	  		this.textCtx.fillStyle = "#ffaa22";
	  		this.textCtx.strokeText(this.sceneName, 14, this.textCtx.canvas.height-25);
	  		this.textCtx.fillText(this.sceneName, 14, this.textCtx.canvas.height-25);
	  	}
		if (this.sceneURL != '')
		{
			if (this.onUserLink) this.textCtx.fillStyle = "#aaccff";
	  		else                 this.textCtx.fillStyle = "#55aaff";
	  		this.textCtx.strokeText(this.sceneURL, 14, this.textCtx.canvas.height-40);
	  		this.textCtx.fillText(this.sceneURL, 14, this.textCtx.canvas.height-40);
		}
	}

	gl.finish();
	this.rendering = false;
}

Gravy.prototype._resize = function(width, height)
{
	this.width = width;
	this.height = height;

	let render_canvas = this.render_canvas;
	render_canvas.width  = width;
	render_canvas.height = height;
	render_canvas.style.width = width;
	render_canvas.style.height = height;

	var text_canvas = this.text_canvas;
	text_canvas.width  = width;
	text_canvas.height = height

	this.camera.aspect = width / height;
	this.camera.updateProjectionMatrix();
	this.camControls.update();

	this.raytracer.resize(width, height);
}

Gravy.prototype.resize = function()
{
	if (this.terminated) return;
	if (this.auto_resize)
	{
		// If no explicit renderer size was set by user, resizing the browser window
		// resizes the render itself to match.
		let width = window.innerWidth;
		let height = window.innerHeight;
		this._resize(width, height);
		if (this.initialized)
			this.render();
	}
	else
	{
		// Otherwise if the user set a fixed renderer resolution, we scale the resultant render
		// to fit into the current window with preserved aspect ratio:
		let render_canvas = this.render_canvas;
		let window_width = window.innerWidth;
		let window_height = window.innerHeight;
		let render_aspect = render_canvas.width / render_canvas.height;
		let window_aspect = window_width / window_height;
		if (render_aspect > window_aspect)
		{
			render_canvas.style.width = window_width;
			render_canvas.style.height = window_width / render_aspect;
		}
		else
		{
			render_canvas.style.width = window_height * render_aspect;
			render_canvas.style.height = window_height;
		}
		var text_canvas = this.text_canvas;
		text_canvas.width = window_width;
		text_canvas.height = window_height;
	}
}

/*
Gravy.prototype.onClick = function(event)
{
	if (this.onGravyLink)
	{
    	window.location = "https://github.com/portsmouth/gravy";
    }
    if (this.onUserLink)
	{
    	window.location = this.sceneURL;
    }
	event.preventDefault();
}

Gravy.prototype.onDocumentMouseMove = function(event)
{
	// Check whether user is trying to click the Gravy home link, or user link
	var textCtx = this.textCtx;
	var x = event.pageX;
    var y = event.pageY;
	let linkWidth = this.textCtx.measureText('Gravy lensing simulator vX.X.X').width;
	if (x>14 && x<14+linkWidth && y>15 && y<25) this.onGravyLink = true;
	else this.onGravyLink = false;
	if (this.sceneURL != '')
	{
		linkWidth = this.textCtx.measureText(this.sceneURL).width;
		if (x>14 && x<14+linkWidth && y>this.height-45 && y<this.height-35) this.onUserLink = true;
		else this.onUserLink = false;
	}

	this.camControls.update();
}

Gravy.prototype.onDocumentMouseDown = function(event)
{
	this.camControls.update();
}

Gravy.prototype.onDocumentMouseUp = function(event)
{
	this.camControls.update();
}

Gravy.prototype.onDocumentRightClick = function(event)
{

}

Gravy.prototype.onkeydown = function(event)
{
	var charCode = (event.which) ? event.which : event.keyCode;
	switch (charCode)
	{
		case 122: // F11 key: go fullscreen
			var element	= document.body;
			if      ( 'webkitCancelFullScreen' in document ) element.webkitRequestFullScreen();
			else if ( 'mozCancelFullScreen'    in document ) element.mozRequestFullScreen();
			else console.assert(false);
			break;

		case 70: // F key: reset cam  (@todo)
			this.camera.position.copy(this.initial_camera_position);
			this.camControls.target.copy(this.initial_camera_target);
			this.reset(true);
			break;

		case 82: // R key: reset scene
			this.initPotential();
			break;

		case 72: // H key: toggle hide/show dat gui
			this.guiVisible = !this.guiVisible;
			gravy.getGUI().toggleHide();
			break;

		case 79: // O key: output scene settings code to console
			let code = this.dumpScene();
			console.log(code);
			break;

		case 80: // P key: save current image to disk
		{
   			var w = window.open('about:blank', 'Gravy screenshot');
   			let dataURL = this.render_canvas.toDataURL("image/png");
   			w.document.write("<img src='"+dataURL+"' alt='from canvas'/>");
			break;
		}

		case 87: // W key: cam forward
		{
			let toTarget = new THREE.Vector3();
			toTarget.copy(this.camControls.target);
			toTarget.sub(this.camera.position);
			let distToTarget = toTarget.length();
			toTarget.normalize();
			var move = new THREE.Vector3();
			move.copy(toTarget);
			move.multiplyScalar(this.camControls.flySpeed*distToTarget);
			this.camera.position.add(move);
			this.camControls.target.add(move);
			this.reset(true);
			break;
		}

		case 65: // A key: cam left
		{
			let toTarget = new THREE.Vector3();
			toTarget.copy(this.camControls.target);
			toTarget.sub(this.camera.position);
			let distToTarget = toTarget.length();
			var localX = new THREE.Vector3(1.0, 0.0, 0.0);
			var worldX = localX.transformDirection( this.camera.matrix );
			var move = new THREE.Vector3();
			move.copy(worldX);
			move.multiplyScalar(-this.camControls.flySpeed*distToTarget);
			this.camera.position.add(move);
			this.camControls.target.add(move);
			this.reset(true);
			break;
		}

		case 83: // S key: cam back
		{
			let toTarget = new THREE.Vector3();
			toTarget.copy(this.camControls.target);
			toTarget.sub(this.camera.position);
			let distToTarget = toTarget.length();
			toTarget.normalize();
			var move = new THREE.Vector3();
			move.copy(toTarget);
			move.multiplyScalar(-this.camControls.flySpeed*distToTarget);
			this.camera.position.add(move);
			this.camControls.target.add(move);
			this.reset(true);
			break;
		}

		case 68: // S key: cam right
		{
			let toTarget = new THREE.Vector3();
			toTarget.copy(this.camControls.target);
			toTarget.sub(this.camera.position);
			let distToTarget = toTarget.length();
			var localX = new THREE.Vector3(1.0, 0.0, 0.0);
			var worldX = localX.transformDirection( this.camera.matrix );
			var move = new THREE.Vector3();
			move.copy(worldX);
			move.multiplyScalar(this.camControls.flySpeed*distToTarget);
			this.camera.position.add(move);
			this.camControls.target.add(move);
			this.reset(true);
			break;
		}
	}
}
*/

function camChanged()
{
	if (!gravy.rendering)
	{
		var no_recompile = true;
		gravy.reset(no_recompile);
	}
}
