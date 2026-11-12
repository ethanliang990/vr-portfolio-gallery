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
renderer.setClearColor(0xf1f0eb, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xf1f0eb, 0.024);
const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 100);
camera.rotation.order = "YXZ";
const galleryRing = new THREE.Group();
scene.add(galleryRing);

const view = { yaw: 0, pitch: -0.11, fov: 56, yawVelocity: 0 };
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.25);
const planePoint = new THREE.Vector3();
const clickable = [];
const draggables = [];
const clock = new THREE.Clock();
let draggingLook = false;
let objectDrag = null;
let moved = false;
let lastX = 0;
let lastY = 0;
let lastMoveTime = 0;
let panelDrag = null;
let hoveredScreen = null;
let hoveredObject = null;
let openId = null;
let centerpiece = null;

const platformRadius = 6.55;
const platformLimit = 5.78;
const floorY = 0.39;

function updateCamera() {
  view.pitch = THREE.MathUtils.clamp(view.pitch, -0.48, 0.34);
  camera.position.set(0, 2.35, 10.2);
  camera.rotation.set(view.pitch, view.yaw, 0);
  if (camera.fov !== view.fov) {
    camera.fov = view.fov;
    camera.updateProjectionMatrix();
  }
}

function shadow(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return object;
}

function addEnvironment() {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c3cf, 2.65));
  const key = new THREE.DirectionalLight(0xffffff, 3.1);
  key.position.set(4.5, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -11;
  key.shadow.camera.right = 11;
  key.shadow.camera.top = 11;
  key.shadow.camera.bottom = -11;
  scene.add(key);
  const fill = new THREE.PointLight(0xcbd8ff, 10, 16, 2);
  fill.position.set(-4, 4.3, -2);
  scene.add(fill);
  const warm = new THREE.PointLight(0xffd8bb, 7, 14, 2);
  warm.position.set(4.5, 3.6, -5);
  scene.add(warm);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0xe7e9e8, roughness: 0.94, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.18;
  floor.receiveShadow = true;
  scene.add(floor);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(platformRadius, platformRadius, 0.22, 112),
    new THREE.MeshStandardMaterial({ color: 0xfaf9f4, roughness: 0.76, metalness: 0.08 })
  );
  platform.position.y = -0.07;
  platform.receiveShadow = true;
  scene.add(platform);
  const edge = new THREE.Mesh(
    new THREE.TorusGeometry(platformRadius - 0.08, 0.026, 8, 112),
    new THREE.MeshBasicMaterial({ color: 0x91a3ad, transparent: true, opacity: 0.45 })
  );
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.07;
  scene.add(edge);
  [1.8, 3.75].forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.01, radius + 0.01, 96),
      new THREE.MeshBasicMaterial({ color: index ? 0xa6b6c2 : 0xb6c4d3, transparent: true, opacity: 0.32, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.055;
    scene.add(ring);
  });

  const motes = new THREE.BufferGeometry();
  const positions = new Float32Array(720 * 3);
  for (let i = 0; i < positions.length; i += 3) {
    const radius = THREE.MathUtils.randFloat(8, 28);
    const angle = THREE.MathUtils.randFloat(0, Math.PI * 2);
    positions[i] = Math.cos(angle) * radius;
    positions[i + 1] = THREE.MathUtils.randFloat(1.1, 12);
    positions[i + 2] = Math.sin(angle) * radius;
  }
  motes.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(motes, new THREE.PointsMaterial({ color: 0xffffff, size: 0.028, transparent: true, opacity: 0.72 })));
}

function labelTexture(text, accent) {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 640;
  textureCanvas.height = 188;
  const context = textureCanvas.getContext("2d");
  context.fillStyle = "#fbfaf6";
  context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
  context.strokeStyle = `#${new THREE.Color(accent).getHexString()}`;
  context.lineWidth = 8;
  context.strokeRect(13, 13, textureCanvas.width - 26, textureCanvas.height - 26);
  context.fillStyle = "#172029";
  context.font = "600 52px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, textureCanvas.width / 2, textureCanvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addCenterpiece() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.38, 1.58, 0.34, 14),
    new THREE.MeshStandardMaterial({ color: 0xf8f8f5, metalness: 0.23, roughness: 0.48 })
  );
  base.position.y = 0.15;
  group.add(base);
  const rail = new THREE.Mesh(
    new THREE.TorusGeometry(1.16, 0.018, 6, 60),
    new THREE.MeshBasicMaterial({ color: 0x7b95ea, transparent: true, opacity: 0.68 })
  );
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 0.34;
  group.add(rail);
  const terminal = new THREE.Mesh(
    new THREE.BoxGeometry(1.28, 0.62, 0.11),
    new THREE.MeshStandardMaterial({ color: 0xdfe8ff, emissive: 0x748eff, emissiveIntensity: 0.16, metalness: 0.28, roughness: 0.35 })
  );
  terminal.position.set(0, 0.78, 0.1);
  terminal.rotation.x = -0.19;
  group.add(terminal);
  const globe = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.43, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xe3ecff, emissive: 0x8ca9ff, emissiveIntensity: 0.23, metalness: 0.4, roughness: 0.22, wireframe: true })
  );
  const globeRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.013, 6, 48), new THREE.MeshBasicMaterial({ color: 0x4366ff, transparent: true, opacity: 0.78 }));
  globeRing.rotation.x = 0.84;
  globe.add(sphere, globeRing);
  globe.position.set(0, 0.98, 0);
  group.add(globe);
  group.userData.globe = globe;
  galleryRing.add(shadow(group));
  centerpiece = group;
}

function addExhibit(exhibit, index) {
  const group = new THREE.Group();
  const radius = 5.3;
  group.position.set(Math.sin(exhibit.angle) * radius, 0, -Math.cos(exhibit.angle) * radius);
  group.rotation.y = Math.atan2(-group.position.x, 10.2 - group.position.z);
  const accent = new THREE.Color(exhibit.color);
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 1.04, 0.38, 28),
    new THREE.MeshStandardMaterial({ color: 0xf9f9f7, metalness: 0.17, roughness: 0.54 })
  );
  plinth.position.y = 0.19;
  group.add(plinth);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 1.16, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xfaf9f5, metalness: 0.1, roughness: 0.46, emissive: accent, emissiveIntensity: 0.025 })
  );
  body.position.set(0, 1.26, 0);
  group.add(body);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.02, 1.29, 0.025),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.62 })
  );
  frame.position.set(0, 1.26, 0.083);
  group.add(frame);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.62, 0.49),
    new THREE.MeshBasicMaterial({ map: labelTexture(exhibit.label, exhibit.color), transparent: true, depthTest: false, depthWrite: false })
  );
  label.position.set(0, 1.26, 0.13);
  label.renderOrder = 2;
  group.add(label);
  const status = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshBasicMaterial({ color: accent }));
  status.position.set(-0.74, 1.72, 0.13);
  group.add(status);
  const light = new THREE.PointLight(accent, 2.4, 3, 2);
  light.position.set(0, 1.42, 0.55);
  group.add(light);
  group.userData = { exhibit, body, frame, phase: index * 1.2, screen: true };
  clickable.push(group);
  galleryRing.add(shadow(group));
}

function material(color, metalness = 0.36) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.28, emissive: color, emissiveIntensity: 0.05 });
}

function addCollectible({ type, color, position, rotation = [0, 0, 0] }) {
  const group = new THREE.Group();
  let object;
  const trim = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78 });
  if (type === "orb") {
    object = new THREE.Mesh(new THREE.IcosahedronGeometry(0.31, 2), material(color));
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.017, 6, 40), trim);
    orbit.rotation.x = 0.8;
    group.add(orbit);
  } else if (type === "cartridge") {
    object = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.18), material(color));
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.028, 0.187), trim);
    stripe.position.y = 0.045;
    group.add(stripe);
  } else if (type === "ring") {
    object = new THREE.Mesh(new THREE.TorusKnotGeometry(0.24, 0.07, 72, 10), material(color));
  } else {
    object = new THREE.Mesh(new THREE.OctahedronGeometry(0.31, 1), material(color));
  }
  object.rotation.set(...rotation);
  group.add(object);
  group.position.set(...position);
  group.userData = {
    draggable: true,
    radius: 0.44,
    velocity: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    home: new THREE.Vector3(...position),
    phase: Math.random() * Math.PI * 2,
    object
  };
  draggables.push(group);
  galleryRing.add(shadow(group));
}

function addCollectibles() {
  addCollectible({ type: "orb", color: 0x6d8dff, position: [-2.0, 0.8, -1.2], rotation: [0.3, 0.1, 0.2] });
  addCollectible({ type: "cartridge", color: 0xe78972, position: [1.9, 0.57, -0.9], rotation: [0.1, -0.22, 0.08] });
  addCollectible({ type: "ring", color: 0x8fc5b7, position: [1.8, 0.52, 1.85], rotation: [0.55, 0.25, 0] });
  addCollectible({ type: "crystal", color: 0xc6a5f2, position: [-2.0, 0.55, 1.82], rotation: [0.2, 0.4, 0.1] });
}

function resetPanelPosition() {
  panel.classList.remove("is-manual-position");
  panel.style.left = "";
  panel.style.top = "";
  panel.style.right = "";
  panel.style.bottom = "";
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
  else {
    panel.style.animation = "none";
    panel.offsetHeight;
    panel.style.animation = "";
  }
}

function closeInfo() {
  openId = null;
  if (panel.open) panel.close();
}

function updatePointer(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  cursor.style.left = `${event.clientX}px`;
  cursor.style.top = `${event.clientY}px`;
  cursor.classList.add("is-visible");
}

function objectFromIntersections(roots, key) {
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(roots, true);
  if (!intersections.length) return null;
  let object = intersections[0].object;
  while (object && !object.userData[key]) object = object.parent;
  return object || null;
}

function getScreen() {
  return objectFromIntersections(clickable, "screen");
}

function getDraggable() {
  return objectFromIntersections(draggables, "draggable");
}

function limitToPlatform(root) {
  const flat = new THREE.Vector2(root.position.x, root.position.z);
  if (flat.length() > platformLimit - root.userData.radius) {
    flat.setLength(platformLimit - root.userData.radius);
    root.position.x = flat.x;
    root.position.z = flat.y;
    root.userData.velocity.x *= -0.28;
    root.userData.velocity.z *= -0.28;
  }
}

function startObjectDrag(root, event) {
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(dragPlane, planePoint);
  const data = root.userData;
  objectDrag = {
    root,
    offset: new THREE.Vector3(root.position.x - planePoint.x, 0, root.position.z - planePoint.z),
    previous: root.position.clone(),
    lastTime: event.timeStamp || performance.now()
  };
  data.velocity.set(0, 0, 0);
  data.spin.set(0, 0, 0);
  canvas.classList.add("is-object-dragging");
  canvas.setPointerCapture(event.pointerId);
  startHint.classList.add("is-hidden");
}

function moveObject(event) {
  if (!objectDrag) return;
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(dragPlane, planePoint)) return;
  const root = objectDrag.root;
  const now = event.timeStamp || performance.now();
  const delta = Math.max((now - objectDrag.lastTime) / 1000, 1 / 120);
  root.position.set(planePoint.x + objectDrag.offset.x, 1.25, planePoint.z + objectDrag.offset.z);
  limitToPlatform(root);
  root.userData.velocity.copy(root.position).sub(objectDrag.previous).multiplyScalar(1 / delta);
  root.userData.velocity.multiplyScalar(0.75);
  objectDrag.previous.copy(root.position);
  objectDrag.lastTime = now;
}

function releaseObject(event) {
  if (!objectDrag) return;
  const root = objectDrag.root;
  root.userData.velocity.clampLength(0, 9.5);
  root.userData.spin.set(root.userData.velocity.z * 1.15, 0.8 + root.userData.velocity.x * 0.32, -root.userData.velocity.x * 1.15);
  objectDrag = null;
  canvas.classList.remove("is-object-dragging");
  try { canvas.releasePointerCapture(event.pointerId); } catch { }
}

canvas.addEventListener("pointerdown", (event) => {
  if (panel.open) return;
  updatePointer(event);
  const smallObject = getDraggable();
  if (smallObject) {
    startObjectDrag(smallObject, event);
    return;
  }
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
  if (objectDrag) {
    moveObject(event);
    return;
  }
  if (!draggingLook) {
    hoveredObject = getDraggable();
    hoveredScreen = hoveredObject ? null : getScreen();
    canvas.style.cursor = hoveredObject ? "grab" : hoveredScreen ? "pointer" : "grab";
    return;
  }
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
  const now = event.timeStamp || performance.now();
  const delta = Math.max((now - lastMoveTime) / 1000, 1 / 120);
  const yawChange = -dx * 0.0038;
  view.yaw += yawChange;
  view.pitch += dy * 0.0028;
  view.yawVelocity = THREE.MathUtils.lerp(view.yawVelocity, yawChange / delta, 0.22);
  lastX = event.clientX;
  lastY = event.clientY;
  lastMoveTime = now;
});

canvas.addEventListener("pointerup", (event) => {
  if (objectDrag) {
    releaseObject(event);
    return;
  }
  try { canvas.releasePointerCapture(event.pointerId); } catch { }
  canvas.classList.remove("is-dragging");
  draggingLook = false;
  if (!moved) {
    updatePointer(event);
    const hit = getScreen();
    if (hit) openPanel(hit.userData.exhibit);
    view.yawVelocity = 0;
  } else {
    view.yawVelocity = THREE.MathUtils.clamp(view.yawVelocity, -1.15, 1.15);
  }
});
canvas.addEventListener("pointercancel", releaseObject);
canvas.addEventListener("pointerleave", () => cursor.classList.remove("is-visible"));
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  view.fov = THREE.MathUtils.clamp(view.fov + event.deltaY * 0.025, 40, 72);
}, { passive: false });

cleanButton.addEventListener("click", () => {
  const clean = document.body.classList.toggle("is-clean");
  cleanButton.setAttribute("aria-pressed", String(clean));
  cleanButton.textContent = clean ? "Show UI" : "Clean view";
});
startHint.addEventListener("click", () => startHint.classList.add("is-hidden"));
resetButton.addEventListener("click", () => {
  view.yaw = 0;
  view.pitch = -0.11;
  view.fov = 56;
  view.yawVelocity = 0;
  draggables.forEach((object) => {
    object.position.copy(object.userData.home);
    object.rotation.set(0, 0, 0);
    object.userData.velocity.set(0, 0, 0);
    object.userData.spin.set(0, 0, 0);
  });
  closeInfo();
});
closePanel.addEventListener("click", closeInfo);
panel.addEventListener("click", (event) => { if (event.target === panel) closeInfo(); });

panelHandle.addEventListener("pointerdown", (event) => {
  if (!panel.open) return;
  event.preventDefault();
  const rect = panel.getBoundingClientRect();
  panel.style.left = `${rect.left}px`;
  panel.style.top = `${rect.top}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
  panel.classList.add("is-manual-position");
  panelDrag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  panel.classList.add("is-dragging");
  panelHandle.setPointerCapture(event.pointerId);
});
panelHandle.addEventListener("pointermove", (event) => {
  if (!panelDrag) return;
  panel.style.left = `${THREE.MathUtils.clamp(event.clientX - panelDrag.x, 8, window.innerWidth - panel.offsetWidth - 8)}px`;
  panel.style.top = `${THREE.MathUtils.clamp(event.clientY - panelDrag.y, 8, window.innerHeight - panel.offsetHeight - 8)}px`;
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
addCollectibles();
updateCamera();

function animate() {
  const delta = Math.min(clock.getDelta(), 0.04);
  const elapsed = clock.getElapsedTime();
  if (!draggingLook && view.yawVelocity) {
    view.yaw += view.yawVelocity * delta;
    view.yawVelocity *= Math.exp(-delta * 8.5);
    if (Math.abs(view.yawVelocity) < 0.01) view.yawVelocity = 0;
  }
  clickable.forEach((group) => {
    const data = group.userData;
    const active = group === hoveredScreen || data.exhibit.id === openId;
    data.body.position.y = 1.26 + Math.sin(elapsed * 1.05 + data.phase) * 0.018;
    data.frame.material.opacity = THREE.MathUtils.lerp(data.frame.material.opacity, active ? 0.98 : 0.62, 0.1);
    data.body.material.emissiveIntensity = THREE.MathUtils.lerp(data.body.material.emissiveIntensity, active ? 0.13 : 0.025, 0.1);
  });
  draggables.forEach((root) => {
    const data = root.userData;
    if (root !== objectDrag?.root) {
      data.velocity.y -= 8.7 * delta;
      root.position.addScaledVector(data.velocity, delta);
      root.rotation.x += data.spin.x * delta;
      root.rotation.y += data.spin.y * delta;
      root.rotation.z += data.spin.z * delta;
      data.spin.multiplyScalar(Math.exp(-delta * 1.7));
      if (root.position.y < floorY) {
        root.position.y = floorY;
        if (Math.abs(data.velocity.y) > 0.42) data.velocity.y *= -0.38;
        else data.velocity.y = 0;
        data.velocity.x *= 0.91;
        data.velocity.z *= 0.91;
      }
      limitToPlatform(root);
      if (data.velocity.lengthSq() < 0.0008) data.velocity.set(0, 0, 0);
    }
    const isHeld = root === objectDrag?.root;
    data.object.material.emissiveIntensity = THREE.MathUtils.lerp(data.object.material.emissiveIntensity, isHeld || root === hoveredObject ? 0.24 : 0.05, 0.14);
  });
  if (centerpiece?.userData.globe) centerpiece.userData.globe.rotation.y += delta * 0.38;
  updateCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
window.setTimeout(() => loading.classList.add("is-gone"), 550);
