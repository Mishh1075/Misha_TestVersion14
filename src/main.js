// main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { lastClickedButton } from './caller.js';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd6d6d6);

export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 20);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio > 1 ? 1.5 : 1);
document.getElementById('canvas-container').appendChild(renderer.domElement);

const hdrLoader = new RGBELoader();
hdrLoader.load("./assets/HDR/kloppenheim_06_puresky_4k.hdr", (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;
  scene.environment = envMap;
  scene.background = envMap;
  renderer.toneMappingExposure = 0.4;
  scene.environmentIntensity = 0.3;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 100;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
scene.add(dirLight);

scene.add(new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.3));

let ceiling;
export { ceiling };

const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
loader.setDRACOLoader(dracoLoader);

let model;
loader.load(
  '/2BHKFlat_draco_optimized.glb',
  (gltf) => {
    model = gltf.scene;
    model.position.set(0, 0.2, 0);
    scene.add(model);

    ceiling = model.getObjectByName("Ceiling");
    const basecube = model.getObjectByName("Cube");
    if (basecube) basecube.visible = false;
    if (ceiling) ceiling.visible = true;

    model.traverse(child => console.log(`Name: ${child.name}, Type: ${child.type}`));

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const boundingBox = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, visible: false })
    );
    boundingBox.position.copy(center);
    scene.add(boundingBox);
  },
  undefined,
  error => console.error('An error occurred while loading the model:', error)
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 5, 0);

const moveSpeed = 0.25;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;

// Event listeners for hover effect
let isHovering = true;
renderer.domElement.addEventListener('pointerdown', () => {
  isHovering = false;
  controls.enableRotate = true;
});
renderer.domElement.addEventListener('pointerup', () => {
  isHovering = true;
});

document.addEventListener('keydown', ({ code }) => {
  if (code === 'KeyW') moveForward = true;
  if (code === 'KeyS') moveBackward = true;
  if (code === 'KeyA') moveLeft = true;
  if (code === 'KeyD') moveRight = true;
});

document.addEventListener('keyup', ({ code }) => {
  if (code === 'KeyW') moveForward = false;
  if (code === 'KeyS') moveBackward = false;
  if (code === 'KeyA') moveLeft = false;
  if (code === 'KeyD') moveRight = false;
});

const raycaster = new THREE.Raycaster();
const collisionDistance = 1.5;

function isCameraInsideBox() {
  const p = camera.position;
  return p.x >= -6.1 && p.x <= 5.5 && p.y >= 0 && p.y <= 5 && p.z >= -13 && p.z <= 13;
}

function restrictWASDMovement() {
  if (isCameraInsideBox()) return;
  const moveVector = new THREE.Vector3();
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
  if (moveForward) moveVector.add(forward);
  if (moveBackward) moveVector.sub(forward);
  if (moveLeft) moveVector.sub(right);
  if (moveRight) moveVector.add(right);
  camera.position.add(moveVector.normalize().multiplyScalar(moveSpeed));
  camera.position.y = Math.max(camera.position.y, 0);
}

const mouse = new THREE.Vector2();
let isCtrlPressed = false;
document.addEventListener('keydown', e => { if (e.key === 'Control') isCtrlPressed = true; });
document.addEventListener('keyup', e => { if (e.key === 'Control') isCtrlPressed = false; });

renderer.domElement.addEventListener('pointerdown', e => handleInteraction(e, isCtrlPressed && e.button === 0));
renderer.domElement.addEventListener('dblclick', e => handleInteraction(e, true));

function handleInteraction(event, condition) {
  if (!model || !condition || lastClickedButton == null) return;

  ceiling.visible = true;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(model, true);

  if (intersects.length > 0) {
    const hit = intersects[0];
    const point = hit.point;
    const normal = hit.face.normal.clone();
    const cameraNewPos = point.clone().add(normal.multiplyScalar(-0.5));
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const newTarget = cameraNewPos.clone().add(dir);
    moveCameraTo(
      { x: cameraNewPos.x, y: 1.5, z: cameraNewPos.z },
      { x: newTarget.x, y: 1.5, z: newTarget.z },
      1,
      'no'
    );
  }
}

export function moveCameraTo(loc, target, duration = 1, blur = "no") {
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const endPos = new THREE.Vector3(loc.x, loc.y, loc.z);
  const endTarget = new THREE.Vector3(target.x, target.y, target.z);

  if (blur === "yes") applyBlurEffect("yes");

  let startTime = null;
  function animateCam(time) {
    if (!startTime) startTime = time;
    const t = Math.min((time - startTime) / (duration * 1000), 1);
    camera.position.lerpVectors(startPos, endPos, t);
    controls.target.lerpVectors(startTarget, endTarget, t);
    controls.update();
    renderer.render(scene, camera);
    if (t < 1) requestAnimationFrame(animateCam);
    else {
      camera.position.copy(endPos);
      controls.target.copy(endTarget);
      if (blur === "yes") applyBlurEffect("no");
    }
  }
  requestAnimationFrame(animateCam);
}

function applyBlurEffect(blur) {
  renderer.domElement.style.transition = "filter 0.3s";
  renderer.domElement.style.filter = blur === "yes" ? "blur(10px)" : "none";
}

export function changeObjectTexturemain(path, objectName) {
  if (!model) return console.error("Model not ready.");
  const target = model.getObjectByName(objectName);
  if (!target) return console.error(`"${objectName}" not found.`);

  new THREE.TextureLoader().load(
    path,
    (tex) => {
      if (target.material) {
        target.material.map = tex;
        target.material.needsUpdate = true;
      }
    },
    undefined,
    (err) => console.error('Texture load failed:', err)
  );
}

let lastFrame = 0;
const frameInterval = 1000 / 60;
export const animate = (time) => {
  requestAnimationFrame(animate);
  if (time - lastFrame < frameInterval) return;
  lastFrame = time;
  restrictWASDMovement();
  controls.update();
  renderer.render(scene, camera);
};
animate();
