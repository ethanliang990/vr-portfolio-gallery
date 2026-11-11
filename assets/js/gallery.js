import * as THREE from "three";
import { exhibits } from "./content.js";

const canvas = document.querySelector("#scene");
const loading = document.querySelector("#loading");
const startHint = document.querySelector("#start-hint");
const resetButton = document.querySelector("#reset-view");
const cleanButton = document.querySelector("#toggle-ui");
const panel = document.querySelector("#info-panel");
const panelHandle = document.querySelector("#panel-drag-handle");
const closePanel = document.querySelector("#close-panel");
const cursor = document.querySelector(".cursor-dot");
const panelNumber = document.querySelector("#panel-number");
const panelTitle = document.querySelector("#panel-title");
const panelBody = document.querySelector("#panel-body");
const panelLink = document.querySelector("#panel-link");

const EDGE_RADIUS = 7.8;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x08090b, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x08090b, 0.047);
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
const view = { yaw: -0.11, pitch: -0.1, distance: 12, target: new THREE.Vector3(0, 1.7, 0), yawVelocity: 0, pitchVelocity: 0 };
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const floorHit = new THREE.Vector3();
const dragOffset = new THREE.Vector3();
const clickable = [];
const clock = new THREE.Clock();
let draggingCamera = false;
let activeObject = null;
let hovered = null;
let moved = false;
let lastX = 0;
let lastY = 0;
let lastObjectTime = 0;
let panelDrag = null;

function updateCamera() {
  view.pitch = THREE.MathUtils.clamp(view.pitch, -0.75, 0.45);
  const spherical = new THREE.Spherical(view.distance, Math.PI / 2 - view.pitch, view.yaw);
  camera.position.setFromSpherical(spherical).add(view.target);
  camera.lookAt(view.target);
}

function addSpace() {
  scene.add(new THREE.HemisphereLight(0xb9c7db, 0x11110d, 1.1));
  const key = new THREE.DirectionalLight(0xf6eee2, 2.1);
  key.position.set(3, 8, 5);
  scene.add(key);
  const lime = new THREE.PointLight(0xcaff5e, 27, 15, 2);
  lime.position.set(-4, 3.6, -1);
  scene.add(lime);
  const warm = new THREE.PointLight(0xff8269, 15, 14, 2);
  warm.position.set(4, 2, -4);
  scene.add(warm);

  const voidFloor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ color: 0x050608 }));
  voidFloor.rotation.x = -Math.PI / 2;
  voidFloor.position.y = -0.12;
  scene.add(voidFloor);

  const platform = new THREE.Mesh(new THREE.CylinderGeometry(EDGE_RADIUS, EDGE_RADIUS, 0.2, 96), new THREE.MeshStandardMaterial({ color: 0x111419, metalness: 0.54, roughness: 0.68 }));
  platform.position.y = -0.1;
  scene.add(platform);

  [2.1, 4.5, 6.5].forEach((radius, index) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.008, radius + 0.008, 96), new THREE.MeshBasicMaterial({ color: index === 2 ? 0xcaff5e : 0x536052, transparent: true, opacity: index === 2 ? 0.09 : 0.12, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    scene.add(ring);
  });

  const edge = new THREE.Mesh(new THREE.TorusGeometry(EDGE_RADIUS, 0.022, 6, 120), new THREE.MeshBasicMaterial({ color: 0xcaff5e, transparent: true, opacity: 0.18 }));
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.025;
  scene.add(edge);

  const starGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(900 * 3);
  for (let i = 0; i < positions.length; i += 3) {
    const radius = THREE.MathUtils.randFloat(8, 42);
    const angle = THREE.MathUtils.randFloat(0, Math.PI * 2);
    positions[i] = Math.cos(angle) * radius;
    positions[i + 1] = THREE.MathUtils.randFloat(-1.5, 17);
    positions[i + 2] = Math.sin(angle) * radius;
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xe9f0ee, size: 0.022, transparent: true, opacity: 0.72 })));
}

function objectGeometry(kind) {
  if (kind === "orb") return new THREE.IcosahedronGeometry(0.88, 2);
  if (kind === "arch") return new THREE.TorusGeometry(0.95, 0.22, 12, 64, Math.PI);
  if (kind === "tower") return new THREE.OctahedronGeometry(0.96, 0);
  return new THREE.BoxGeometry(1.55, 1.55, 0.18);
}

function addExhibit(exhibit, index) {
  const group = new THREE.Group();
  group.position.set(...exhibit.position);
  group.rotation.y = index * 0.7;
  const color = new THREE.Color(exhibit.color);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.03, 0.48, 40), new THREE.MeshStandardMaterial({ color: 0x151a1e, metalness: 0.7, roughness: 0.34 }));
  plinth.position.y = 0.24;
  group.add(plinth);
  const core = new THREE.Mesh(objectGeometry(exhibit.geometry), new THREE.MeshStandardMaterial({ color, metalness: 0.36, roughness: 0.22, emissive: color, emissiveIntensity: 0.2 }));
  core.position.y = 1.5;
  group.add(core);
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.14, 1.18, 64), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.52;
  group.add(halo);
  const light = new THREE.PointLight(color, 7, 5.8, 2);
  light.position.y = 1.7;
  group.add(light);
  group.userData = { exhibit, core, halo, originY: core.position.y, phase: index * 1.61, velocity: new THREE.Vector3(), held: false, returning: false };
  clickable.push(group);
  scene.add(group);
}

function resetPanelPosition() {
  panel.style.left = "";
  panel.style.top = "";
  panel.style.right = "";
  panel.style.bottom = "";
  panel.style.transform = "";
}

function openPanel(exhibit) {
  panelNumber.textContent = exhibit.number;
  panelTitle.textContent = exhibit.title;
  panelBody.textContent = exhibit.body;
  panelLink.textContent = exhibit.link;
  panelLink.href = exhibit.href;
  resetPanelPosition();
  if (!panel.open) panel.showModal();
  else { panel.style.animation = "none"; panel.offsetHeight; panel.style.animation = ""; }
}

function closeInfo() { if (panel.open) panel.close(); }

function updatePointer(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  cursor.style.left = event.clientX + "px";
  cursor.style.top = event.clientY + "px";
  cursor.classList.add("is-visible");
}

function getIntersected() {
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(clickable, true);
  if (!intersections.length) return null;
  let object = intersections[0].object;
  while (object && !object.userData.exhibit) object = object.parent;
  return object || null;
}

function pointOnPlatform() {
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(floorPlane, floorHit) ? floorHit.clone() : null;
}

function beginObjectDrag(object, event) {
  activeObject = object;
  object.userData.held = true;
  object.userData.returning = false;
  object.userData.velocity.set(0, 0, 0);
  const point = pointOnPlatform();
  dragOffset.copy(object.position).sub(point || object.position);
  dragOffset.y = 0;
  lastObjectTime = event.timeStamp || performance.now();
  canvas.classList.add("is-object-dragging");
}

function moveObject(event) {
  const point = pointOnPlatform();
  if (!point || !activeObject) return;
  const next = point.add(dragOffset);
  const now = event.timeStamp || performance.now();
  const delta = Math.max((now - lastObjectTime) / 1000, 1 / 120);
  activeObject.userData.velocity.set((next.x - activeObject.position.x) / delta, 0, (next.z - activeObject.position.z) / delta).clampLength(0, 14);
  activeObject.position.x = next.x;
  activeObject.position.z = next.z;
  activeObject.position.y = 0;
  lastObjectTime = now;
}

canvas.addEventListener("pointerdown", (event) => {
  if (panel.open) return;
  updatePointer(event);
  moved = false;
  lastX = event.clientX;
  lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
  startHint.classList.add("is-hidden");
  const hit = getIntersected();
  if (hit) beginObjectDrag(hit, event);
  else {
    draggingCamera = true;
    view.yawVelocity = 0;
    view.pitchVelocity = 0;
    canvas.classList.add("is-dragging");
  }
});

canvas.addEventListener("pointermove", (event) => {
  updatePointer(event);
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
  if (activeObject) moveObject(event);
  else if (draggingCamera) {
    view.yaw -= dx * 0.006;
    view.pitch += dy * 0.005;
    view.yawVelocity = -dx * 0.0018;
    view.pitchVelocity = dy * 0.0015;
  } else {
    hovered = getIntersected();
    canvas.style.cursor = hovered ? "pointer" : "grab";
  }
  lastX = event.clientX;
  lastY = event.clientY;
});

canvas.addEventListener("pointerup", (event) => {
  try { canvas.releasePointerCapture(event.pointerId); } catch { }
  canvas.classList.remove("is-dragging", "is-object-dragging");
  if (activeObject) {
    const released = activeObject;
    released.userData.held = false;
    if (!moved) { released.userData.velocity.set(0, 0, 0); openPanel(released.userData.exhibit); }
    activeObject = null;
  }
  draggingCamera = false;
});
canvas.addEventListener("pointerleave", () => cursor.classList.remove("is-visible"));
canvas.addEventListener("wheel", (event) => { event.preventDefault(); view.distance = THREE.MathUtils.clamp(view.distance + event.deltaY * 0.01, 7.6, 16); }, { passive: false });

cleanButton.addEventListener("click", () => {
  const clean = document.body.classList.toggle("is-clean");
  cleanButton.setAttribute("aria-pressed", String(clean));
  cleanButton.textContent = clean ? "Show UI" : "Clean view";
});
startHint.addEventListener("click", () => startHint.classList.add("is-hidden"));
resetButton.addEventListener("click", () => {
  view.yaw = -0.11;
  view.pitch = -0.1;
  view.distance = 12;
  view.yawVelocity = 0;
  view.pitchVelocity = 0;
  closeInfo();
});
closePanel.addEventListener("click", closeInfo);
panel.addEventListener("click", (event) => { if (event.target === panel) closeInfo(); });

panelHandle.addEventListener("pointerdown", (event) => {
  if (!panel.open) return;
  event.preventDefault();
  const rect = panel.getBoundingClientRect();
  panel.style.left = rect.left + "px";
  panel.style.top = rect.top + "px";
  panel.style.right = "auto";
  panel.style.bottom = "auto";
  panel.style.transform = "none";
  panelDrag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  panel.classList.add("is-dragging");
  panelHandle.setPointerCapture(event.pointerId);
});
panelHandle.addEventListener("pointermove", (event) => {
  if (!panelDrag) return;
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  panel.style.left = THREE.MathUtils.clamp(event.clientX - panelDrag.x, 8, window.innerWidth - width - 8) + "px";
  panel.style.top = THREE.MathUtils.clamp(event.clientY - panelDrag.y, 8, window.innerHeight - height - 8) + "px";
});
function stopPanelDrag(event) {
  if (!panelDrag) return;
  panelDrag = null;
  panel.classList.remove("is-dragging");
  try { panelHandle.releasePointerCapture(event.pointerId); } catch { }
}
panelHandle.addEventListener("pointerup", stopPanelDrag);
panelHandle.addEventListener("pointercancel", stopPanelDrag);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function simulatePhysics(group, delta) {
  const state = group.userData;
  if (state.held) return;
  const position = group.position;
  const velocity = state.velocity;
  const radius = Math.hypot(position.x, position.z);
  if (state.returning || radius > EDGE_RADIUS) {
    state.returning = true;
    velocity.x += -position.x * 7.5 * delta;
    velocity.z += -position.z * 7.5 * delta;
    velocity.y -= 10 * delta;
    velocity.multiplyScalar(Math.pow(0.985, delta * 60));
    position.addScaledVector(velocity, delta);
    if (position.y < -3.5) { position.y = -3.5; velocity.y = Math.abs(velocity.y) * 0.18; }
    if (Math.hypot(position.x, position.z) < 1.15 && position.y < -2.7) {
      position.set(position.x, 0, position.z);
      velocity.set(0, 3.2, 0);
      state.returning = false;
    }
    return;
  }
  velocity.y -= 12 * delta;
  position.addScaledVector(velocity, delta);
  if (position.y < 0) {
    position.y = 0;
    if (velocity.y < 0) velocity.y *= -0.32;
    velocity.x *= Math.pow(0.72, delta * 60);
    velocity.z *= Math.pow(0.72, delta * 60);
  }
}

addSpace();
exhibits.forEach(addExhibit);
updateCamera();
function animate() {
  const delta = Math.min(clock.getDelta(), 0.04);
  const elapsed = clock.getElapsedTime();
  if (!draggingCamera) {
    view.yaw += view.yawVelocity;
    view.pitch += view.pitchVelocity;
    view.yawVelocity *= Math.pow(0.9, delta * 60);
    view.pitchVelocity *= Math.pow(0.9, delta * 60);
  }
  clickable.forEach((group) => {
    simulatePhysics(group, delta);
    const data = group.userData;
    data.core.rotation.y += 0.006;
    if (!data.held) data.core.position.y = data.originY + Math.sin(elapsed * 1.2 + data.phase) * 0.08;
    data.halo.rotation.z = elapsed * 0.2 + data.phase;
    const nextScale = THREE.MathUtils.lerp(data.core.scale.x, group === hovered ? 1.11 : 1, 0.12);
    data.core.scale.setScalar(nextScale);
  });
  updateCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
window.setTimeout(() => loading.classList.add("is-gone"), 550);
