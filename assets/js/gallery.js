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

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x08090b, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x08090b, 0.034);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 100);
camera.rotation.order = "YXZ";
const galleryRing = new THREE.Group();
scene.add(galleryRing);

const view = { yaw: 0, pitch: -0.12, fov: 62, yawVelocity: 0 };
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const clickable = [];
const clock = new THREE.Clock();
let draggingLook = false;
let moved = false;
let lastX = 0;
let lastY = 0;
let lastMoveTime = 0;
let panelDrag = null;
let hovered = null;
let openId = null;
let centerpiece = null;

function updateCamera() {
  view.pitch = THREE.MathUtils.clamp(view.pitch, -0.7, 0.55);
  camera.position.set(0, 1.62, 0);
  camera.rotation.set(view.pitch, 0, 0);
  if (camera.fov !== view.fov) {
    camera.fov = view.fov;
    camera.updateProjectionMatrix();
  }
  galleryRing.rotation.y = view.yaw;
}

function addEnvironment() {
  scene.add(new THREE.HemisphereLight(0xcad7e8, 0x08090b, 1.25));
  const key = new THREE.DirectionalLight(0xf6eee2, 2.2);
  key.position.set(2.5, 6, 3);
  scene.add(key);
  const lime = new THREE.PointLight(0xcaff5e, 18, 15, 2);
  lime.position.set(-3, 2.6, -3);
  scene.add(lime);
  const coral = new THREE.PointLight(0xff8269, 12, 14, 2);
  coral.position.set(3.5, 2.5, -2);
  scene.add(coral);
  const voidFloor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ color: 0x050608 }));
  voidFloor.rotation.x = -Math.PI / 2;
  voidFloor.position.y = -0.13;
  scene.add(voidFloor);
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(7.75, 7.75, 0.22, 96), new THREE.MeshStandardMaterial({ color: 0x10141b, metalness: 0.45, roughness: 0.73 }));
  platform.position.y = -0.11;
  scene.add(platform);
  [1.4, 3.2, 5.15, 6.85].forEach((radius, index) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.009, radius + 0.009, 96), new THREE.MeshBasicMaterial({ color: index === 3 ? 0xcaff5e : 0x536052, transparent: true, opacity: index === 3 ? 0.13 : 0.11, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    scene.add(ring);
  });
  const stars = new THREE.BufferGeometry();
  const positions = new Float32Array(1100 * 3);
  for (let i = 0; i < positions.length; i += 3) {
    const radius = THREE.MathUtils.randFloat(8, 42);
    const angle = THREE.MathUtils.randFloat(0, Math.PI * 2);
    positions[i] = Math.cos(angle) * radius;
    positions[i + 1] = THREE.MathUtils.randFloat(-1.5, 18);
    positions[i + 2] = Math.sin(angle) * radius;
  }
  stars.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xe9f0ee, size: 0.022, transparent: true, opacity: 0.72 })));
}

function labelTexture(text, color) {
  const badge = document.createElement("canvas");
  badge.width = 560;
  badge.height = 170;
  const context = badge.getContext("2d");
  context.fillStyle = "#0c1015";
  context.fillRect(0, 0, badge.width, badge.height);
  context.strokeStyle = "#" + new THREE.Color(color).getHexString();
  context.lineWidth = 9;
  context.strokeRect(10, 10, badge.width - 20, badge.height - 20);
  context.fillStyle = "#edf2ef";
  context.font = "600 48px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, badge.width / 2, badge.height / 2 + 4);
  const texture = new THREE.CanvasTexture(badge);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addCenterpiece() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.76, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x171d26, metalness: 0.68, roughness: 0.31 }));
  base.position.y = 0.2;
  group.add(base);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.82, 0.14), new THREE.MeshStandardMaterial({ color: 0x15211a, emissive: 0x52711d, emissiveIntensity: 0.7, metalness: 0.34, roughness: 0.3 }));
  screen.position.set(0, 0.96, -0.7);
  screen.rotation.x = -0.18;
  group.add(screen);
  const globe = new THREE.Group();
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), new THREE.MeshStandardMaterial({ color: 0x0d2430, emissive: 0x1f9ec9, emissiveIntensity: 0.48, metalness: 0.48, roughness: 0.27, wireframe: true })));
  globe.add(new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.018, 6, 48), new THREE.MeshBasicMaterial({ color: 0x74b9ff, transparent: true, opacity: 0.72 })));
  globe.position.set(0, 0.76, 0);
  group.add(globe);
  [[-1.7, -0.65, 0xcaff5e], [1.7, -0.55, 0xff8269], [0.2, 1.75, 0x74b9ff]].forEach(([x, z, color], index) => {
    const toy = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18 + index * 0.025, 1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, metalness: 0.45, roughness: 0.3 }));
    toy.position.set(x, 0.52 + index * 0.05, z);
    group.add(toy);
  });
  group.userData.globe = globe;
  galleryRing.add(group);
  centerpiece = group;
}

function addProp(group, prop, color) {
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.24, metalness: 0.45, roughness: 0.27 });
  if (prop === "globe") {
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.28, wireframe: true }));
    globe.position.set(0, 1.46, 0.2);
    group.add(globe);
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 5, 36), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    orbit.position.copy(globe.position);
    orbit.rotation.x = 0.9;
    group.add(orbit);
  } else if (prop === "cartridges") {
    [-0.34, 0, 0.34].forEach((x, index) => {
      const cartridge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55 + index * 0.08, 0.14), material.clone());
      cartridge.position.set(x, 1.35 + index * 0.035, 0.18);
      cartridge.rotation.z = (index - 1) * 0.15;
      group.add(cartridge);
    });
  } else if (prop === "terminal") {
    const terminal = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.52, 0.13), new THREE.MeshStandardMaterial({ color: 0x15201b, emissive: color, emissiveIntensity: 0.3, metalness: 0.62, roughness: 0.25 }));
    terminal.position.set(0, 1.42, 0.19);
    terminal.rotation.x = -0.13;
    group.add(terminal);
  } else {
    const signal = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.075, 10, 36), material);
    signal.position.set(0, 1.42, 0.2);
    signal.rotation.x = Math.PI / 2;
    group.add(signal);
  }
}

function addExhibit(exhibit, index) {
  const group = new THREE.Group();
  const radius = 5.35;
  group.position.set(Math.sin(exhibit.angle) * radius, 0, -Math.cos(exhibit.angle) * radius);
  group.rotation.y = -exhibit.angle;
  const color = new THREE.Color(exhibit.color);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.04, 0.42, 28), new THREE.MeshStandardMaterial({ color: 0x161c24, metalness: 0.7, roughness: 0.32 }));
  pedestal.position.y = 0.21;
  group.add(pedestal);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.78, 1.1, 0.16), new THREE.MeshStandardMaterial({ color: 0x10161d, metalness: 0.48, roughness: 0.24, emissive: color, emissiveIntensity: 0.07 }));
  body.position.y = 1.34;
  group.add(body);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.92, 1.25, 0.04), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.52 }));
  frame.position.set(0, 1.34, -0.11);
  group.add(frame);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.57, 0.48), new THREE.MeshBasicMaterial({ map: labelTexture(exhibit.label, exhibit.color), transparent: true }));
  label.position.set(0, 1.31, 0.091);
  group.add(label);
  addProp(group, exhibit.prop, exhibit.color);
  const light = new THREE.PointLight(color, 4.6, 3.4, 2);
  light.position.set(0, 1.65, 0.34);
  group.add(light);
  group.userData = { exhibit, body, frame, phase: index * 1.4 };
  clickable.push(group);
  galleryRing.add(group);
}

function resetPanelPosition() {
  panel.style.left = "";
  panel.style.top = "";
  panel.style.right = "";
  panel.style.bottom = "";
  panel.style.transform = "";
}

function openPanel(exhibit) {
  openId = exhibit.id;
  panelNumber.textContent = exhibit.number;
  panelTitle.textContent = exhibit.title;
  panelBody.textContent = exhibit.body;
  panelLink.textContent = exhibit.link;
  panelLink.href = exhibit.href;
  resetPanelPosition();
  if (!panel.open) panel.showModal();
  else { panel.style.animation = "none"; panel.offsetHeight; panel.style.animation = ""; }
}

function closeInfo() {
  openId = null;
  if (panel.open) panel.close();
}

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

canvas.addEventListener("pointerdown", (event) => {
  if (panel.open) return;
  updatePointer(event);
  moved = false;
  draggingLook = true;
  lastX = event.clientX;
  lastY = event.clientY;
  lastMoveTime = event.timeStamp || performance.now();
  view.yawVelocity = 0;
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add("is-dragging");
  startHint.classList.add("is-hidden");
});

canvas.addEventListener("pointermove", (event) => {
  updatePointer(event);
  if (!draggingLook) {
    hovered = getIntersected();
    canvas.style.cursor = hovered ? "pointer" : "grab";
    return;
  }
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
  const now = event.timeStamp || performance.now();
  const delta = Math.max((now - lastMoveTime) / 1000, 1 / 120);
  const yawChange = -dx * 0.0053;
  view.yaw += yawChange;
  view.pitch += dy * 0.004;
  view.yawVelocity = THREE.MathUtils.lerp(view.yawVelocity, yawChange / delta, 0.4);
  lastX = event.clientX;
  lastY = event.clientY;
  lastMoveTime = now;
});

canvas.addEventListener("pointerup", (event) => {
  try { canvas.releasePointerCapture(event.pointerId); } catch { }
  canvas.classList.remove("is-dragging");
  draggingLook = false;
  if (!moved) {
    updatePointer(event);
    const hit = getIntersected();
    if (hit) openPanel(hit.userData.exhibit);
    view.yawVelocity = 0;
  } else {
    view.yawVelocity = THREE.MathUtils.clamp(view.yawVelocity, -3.9, 3.9);
  }
});
canvas.addEventListener("pointerleave", () => cursor.classList.remove("is-visible"));
canvas.addEventListener("wheel", (event) => { event.preventDefault(); view.fov = THREE.MathUtils.clamp(view.fov + event.deltaY * 0.03, 35, 80); }, { passive: false });

cleanButton.addEventListener("click", () => {
  const clean = document.body.classList.toggle("is-clean");
  cleanButton.setAttribute("aria-pressed", String(clean));
  cleanButton.textContent = clean ? "Show UI" : "Clean view";
});
startHint.addEventListener("click", () => startHint.classList.add("is-hidden"));
resetButton.addEventListener("click", () => {
  view.yaw = 0;
  view.pitch = -0.12;
  view.fov = 62;
  view.yawVelocity = 0;
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
  panel.style.left = THREE.MathUtils.clamp(event.clientX - panelDrag.x, 8, window.innerWidth - panel.offsetWidth - 8) + "px";
  panel.style.top = THREE.MathUtils.clamp(event.clientY - panelDrag.y, 8, window.innerHeight - panel.offsetHeight - 8) + "px";
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

addEnvironment();
addCenterpiece();
exhibits.forEach(addExhibit);
updateCamera();

function animate() {
  const delta = Math.min(clock.getDelta(), 0.04);
  const elapsed = clock.getElapsedTime();
  if (!draggingLook && view.yawVelocity) {
    view.yaw += view.yawVelocity * delta;
    view.yawVelocity *= Math.exp(-delta * 3);
    if (Math.abs(view.yawVelocity) < 0.01) view.yawVelocity = 0;
  }
  clickable.forEach((group) => {
    const data = group.userData;
    const active = group === hovered || data.exhibit.id === openId;
    data.body.position.y = 1.34 + Math.sin(elapsed * 1.05 + data.phase) * 0.025;
    data.frame.material.opacity = THREE.MathUtils.lerp(data.frame.material.opacity, active ? 0.9 : 0.52, 0.1);
    data.body.material.emissiveIntensity = THREE.MathUtils.lerp(data.body.material.emissiveIntensity, active ? 0.25 : 0.07, 0.1);
  });
  if (centerpiece && centerpiece.userData.globe) centerpiece.userData.globe.rotation.y += delta * 0.42;
  updateCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
window.setTimeout(() => loading.classList.add("is-gone"), 550);
