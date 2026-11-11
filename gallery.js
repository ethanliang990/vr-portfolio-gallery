import * as THREE from "three";
import { exhibits } from "./content.js";

const canvas = document.querySelector("#scene");
const loading = document.querySelector("#loading");
const startHint = document.querySelector("#start-hint");
const resetButton = document.querySelector("#reset-view");
const panel = document.querySelector("#info-panel");
const closePanel = document.querySelector("#close-panel");
const cursor = document.querySelector(".cursor-dot");
const panelNumber = document.querySelector("#panel-number");
const panelTitle = document.querySelector("#panel-title");
const panelBody = document.querySelector("#panel-body");
const panelLink = document.querySelector("#panel-link");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x08090b, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x08090b, 0.038);
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
const orbit = { yaw: -0.11, pitch: -0.1, distance: 12, target: new THREE.Vector3(0, 1.7, 0) };
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const clickable = [];
const clock = new THREE.Clock();
let dragging = false;
let moved = false;
let startX = 0;
let startY = 0;
let hovered = null;

function updateCamera() {
  orbit.pitch = THREE.MathUtils.clamp(orbit.pitch, -0.75, 0.45);
  const spherical = new THREE.Spherical(orbit.distance, Math.PI / 2 - orbit.pitch, orbit.yaw);
  camera.position.setFromSpherical(spherical).add(orbit.target);
  camera.lookAt(orbit.target);
}

function addLights() {
  scene.add(new THREE.HemisphereLight(0xb9c7db, 0x17110c, 1.4));
  const key = new THREE.DirectionalLight(0xf6eee2, 2.7);
  key.position.set(3, 8, 5);
  key.castShadow = true;
  scene.add(key);
  const lime = new THREE.PointLight(0xcaff5e, 30, 16, 2);
  lime.position.set(-4, 3.6, -1);
  scene.add(lime);
  const warm = new THREE.PointLight(0xff8269, 18, 14, 2);
  warm.position.set(4, 2, -4);
  scene.add(warm);
}

function addRoom() {
  const room = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshStandardMaterial({ color: 0x111419, metalness: 0.5, roughness: 0.72 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const grid = new THREE.GridHelper(28, 28, 0x2a3426, 0x1b201d);
  grid.position.y = 0.012;
  grid.material.transparent = true;
  grid.material.opacity = 0.42;
  room.add(grid);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.92, side: THREE.BackSide });
  const roomBox = new THREE.Mesh(new THREE.BoxGeometry(28, 12, 28), wallMaterial);
  roomBox.position.y = 5.9;
  room.add(roomBox);

  const horizon = new THREE.Mesh(
    new THREE.TorusGeometry(8.3, 0.018, 6, 120),
    new THREE.MeshBasicMaterial({ color: 0xcaff5e, transparent: true, opacity: 0.38 }),
  );
  horizon.rotation.x = Math.PI / 2;
  horizon.position.y = 0.05;
  room.add(horizon);
  scene.add(room);
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

  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 1.03, 0.48, 40),
    new THREE.MeshStandardMaterial({ color: 0x151a1e, metalness: 0.7, roughness: 0.34 }),
  );
  plinth.position.y = 0.24;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  const core = new THREE.Mesh(
    objectGeometry(exhibit.geometry),
    new THREE.MeshStandardMaterial({ color, metalness: 0.36, roughness: 0.22, emissive: color, emissiveIntensity: 0.2 }),
  );
  core.position.y = 1.5;
  core.castShadow = true;
  group.add(core);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(1.14, 1.18, 64),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.52;
  group.add(halo);

  const point = new THREE.PointLight(color, 7, 5.8, 2);
  point.position.y = 1.7;
  group.add(point);
  group.userData = { exhibit, core, halo, originY: core.position.y, phase: index * 1.61 };
  clickable.push(group);
  scene.add(group);
}

function addStars() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(680 * 3);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = THREE.MathUtils.randFloatSpread(25);
    positions[i + 1] = THREE.MathUtils.randFloat(0.5, 10);
    positions[i + 2] = THREE.MathUtils.randFloatSpread(25);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xe9f0ee, size: 0.018, transparent: true, opacity: 0.7 }));
  scene.add(stars);
}

function openPanel(exhibit) {
  panelNumber.textContent = exhibit.number;
  panelTitle.textContent = exhibit.title;
  panelBody.textContent = exhibit.body;
  panelLink.textContent = exhibit.link;
  panelLink.href = exhibit.href;
  if (!panel.open) panel.showModal();
}

function closeInfo() { if (panel.open) panel.close(); }

function updatePointer(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  cursor.style.left = `${event.clientX}px`;
  cursor.style.top = `${event.clientY}px`;
  cursor.classList.add("is-visible");
}

function findIntersected() {
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(clickable, true);
  if (!intersections.length) return null;
  let object = intersections[0].object;
  while (object && !object.userData.exhibit) object = object.parent;
  return object || null;
}

canvas.addEventListener("pointerdown", (event) => {
  if (panel.open) return;
  dragging = true;
  moved = false;
  startX = event.clientX;
  startY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-dragging");
  startHint.classList.add("is-hidden");
});

canvas.addEventListener("pointermove", (event) => {
  updatePointer(event);
  if (dragging) {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    orbit.yaw -= dx * 0.006;
    orbit.pitch += dy * 0.005;
    startX = event.clientX;
    startY = event.clientY;
    return;
  }
  const hit = findIntersected();
  hovered = hit;
  canvas.style.cursor = hit ? "pointer" : "grab";
});

canvas.addEventListener("pointerup", (event) => {
  if (!dragging) return;
  dragging = false;
  canvas.classList.remove("is-dragging");
  try { canvas.releasePointerCapture(event.pointerId); } catch { /* pointer capture already released */ }
  if (!moved) {
    updatePointer(event);
    const hit = findIntersected();
    if (hit) openPanel(hit.userData.exhibit);
  }
});

canvas.addEventListener("pointerleave", () => cursor.classList.remove("is-visible"));
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  orbit.distance = THREE.MathUtils.clamp(orbit.distance + event.deltaY * 0.01, 7.6, 16);
}, { passive: false });

startHint.addEventListener("click", () => {
  startHint.classList.add("is-hidden");
  canvas.focus();
});
resetButton.addEventListener("click", () => {
  orbit.yaw = -0.11;
  orbit.pitch = -0.1;
  orbit.distance = 12;
  closeInfo();
});
closePanel.addEventListener("click", closeInfo);
panel.addEventListener("click", (event) => { if (event.target === panel) closeInfo(); });

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

addLights();
addRoom();
addStars();
exhibits.forEach(addExhibit);
updateCamera();

function animate() {
  const elapsed = clock.getElapsedTime();
  clickable.forEach((group) => {
    const { core, halo, originY, phase } = group.userData;
    core.rotation.y += 0.006;
    core.position.y = originY + Math.sin(elapsed * 1.2 + phase) * 0.08;
    halo.rotation.z = elapsed * 0.2 + phase;
    const active = group === hovered;
    const nextScale = THREE.MathUtils.lerp(core.scale.x, active ? 1.11 : 1, 0.12);
    core.scale.setScalar(nextScale);
  });
  updateCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
window.setTimeout(() => loading.classList.add("is-gone"), 550);
