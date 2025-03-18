import * as THREE from './node_modules/three/build/three.module.js';
import { GLTFLoader } from './node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { ARButton } from './node_modules/three/examples/jsm/webxr/ARButton.js';

class ARCarExperience {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.models = {};
        this.currentCar = null;
        this.reticle = null;
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        
        this.init();
        
        // Add error handler for WebGL
        this.checkWebGLSupport();
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.xr.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Setup lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(0, 1, 0);
        this.scene.add(ambientLight, directionalLight);

        // Create placement reticle
        this.createReticle();

        // Load car models
        this.loadModels();
        
        // Setup AR
        this.setupAR();
        
        // Add interaction handlers
        this.setupInteraction();
    }

    createReticle() {
        const geometry = new THREE.RingGeometry(0.15, 0.2, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.reticle = new THREE.Mesh(geometry, material);
        this.reticle.rotation.x = -Math.PI / 2;
        this.reticle.visible = false;
        this.scene.add(this.reticle);
    }

    loadModels() {
        const loader = new GLTFLoader();
        
        // Load each car model
        const carModels = ['car1.gltf', 'car2.gltf', 'car3.gltf'];
        carModels.forEach(modelPath => {
            loader.load(
                `./models/${modelPath}`,
                (gltf) => {
                    const model = gltf.scene;
                    model.scale.set(0.5, 0.5, 0.5);
                    this.models[modelPath] = model;
                },
                undefined,
                (error) => console.error('Error loading model:', error)
            );
        });
    }

    checkWebGLSupport() {
        if (!this.renderer.capabilities.isWebGL2) {
            console.warn('WebGL 2 not supported');
            this.showErrorMessage('WebGL 2 is not supported on this device');
            return false;
        }
        return true;
    }

    setupAR() {
        console.log('Setting up AR...');
        
        // Check if WebXR is supported
        if (!navigator.xr) {
            console.error('WebXR not supported');
            this.showErrorMessage('WebXR is not supported in this browser');
            return;
        }

        navigator.xr.isSessionSupported('immersive-ar')
            .then((supported) => {
                console.log('AR supported:', supported);
                if (supported) {
                    const sessionInit = {
                        requiredFeatures: ['hit-test'],
                        optionalFeatures: ['dom-overlay'],
                        domOverlay: { root: document.getElementById('ar-overlay') }
                    };

                    // Create and add AR button
                    const arButton = ARButton.createButton(this.renderer, {
                        ...sessionInit,
                        onSessionStarted: (session) => {
                            console.log('AR session started');
                            this.onSessionStart(session);
                        },
                        onSessionEnded: () => {
                            console.log('AR session ended');
                            this.onSessionEnd();
                        }
                    });
                    
                    arButton.addEventListener('click', () => {
                        console.log('AR button clicked');
                    });
                    
                    document.body.appendChild(arButton);
                } else {
                    this.showErrorMessage('AR not supported on this device');
                }
            })
            .catch((error) => {
                console.error('Error checking AR support:', error);
                this.showErrorMessage('Error initializing AR: ' + error.message);
            });
    }

    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '50%';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translate(-50%, -50%)';
        errorDiv.style.background = 'rgba(255,0,0,0.8)';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '20px';
        errorDiv.style.borderRadius = '10px';
        errorDiv.style.textAlign = 'center';
        errorDiv.style.zIndex = '1000';
        errorDiv.innerHTML = message;
        document.body.appendChild(errorDiv);
    }

    onSessionStart(session) {
        console.log('Starting AR session...');
        this.scene.add(this.reticle);
        
        // Setup hit testing
        session.requestReferenceSpace('viewer').then((referenceSpace) => {
            console.log('Got viewer reference space');
            session.requestHitTestSource({ space: referenceSpace })
                .then((source) => {
                    console.log('Got hit test source');
                    this.hitTestSource = source;
                })
                .catch(error => console.error('Error requesting hit test source:', error));
        });
    }

    onSessionEnd() {
        this.hitTestSourceRequested = false;
        this.hitTestSource = null;
        this.reticle.visible = false;
    }

    setupInteraction() {
        this.renderer.domElement.addEventListener('select', (event) => {
            if (this.reticle.visible) {
                // Place car at reticle position
                const modelKey = Object.keys(this.models)[0]; // For demo, using first car
                const model = this.models[modelKey].clone();
                model.position.setFromMatrixPosition(this.reticle.matrix);
                model.userData.isCar = true;
                this.scene.add(model);
                this.currentCar = model;
            }
        });

        // Add touch handlers for car interaction
        const touch = new THREE.Vector2();
        const raycaster = new THREE.Raycaster();

        window.addEventListener('touchstart', (event) => {
            event.preventDefault();
            touch.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
            touch.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
            this.handleInteraction(raycaster, touch);
        });
    }

    handleInteraction(raycaster, pointer) {
        raycaster.setFromCamera(pointer, this.camera);
        const intersects = raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            const selected = intersects[0].object;
            if (selected.userData.isCar) {
                this.handleCarInteraction(selected);
            }
        }
    }

    handleCarInteraction(car) {
        car.rotation.y += Math.PI / 4;
    }

    async updateHitTest(frame) {
        const referenceSpace = this.renderer.xr.getReferenceSpace();
        const session = this.renderer.xr.getSession();

        if (!this.hitTestSourceRequested) {
            session.requestReferenceSpace('viewer').then((referenceSpace) => {
                session.requestHitTestSource({ space: referenceSpace })
                    .then((source) => this.hitTestSource = source);
            });
            this.hitTestSourceRequested = true;
        }

        if (this.hitTestSource) {
            const hitTestResults = frame.getHitTestResults(this.hitTestSource);
            if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(referenceSpace);
                this.reticle.visible = true;
                this.reticle.matrix.fromArray(pose.transform.matrix);
            } else {
                this.reticle.visible = false;
            }
        }
    }

    animate(timestamp, frame) {
        if (frame) {
            this.updateHitTest(frame);
        }

        // Animate current car
        if (this.currentCar) {
            this.currentCar.rotation.y += 0.01;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

export default ARCarExperience; 