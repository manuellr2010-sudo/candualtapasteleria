import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Escena 3D de la portada: un entremet de capas con glaseado espejo, frambuesas y pan de oro,
 * sobre un plato de madera tallada junto a una granada y un limón.
 *
 *  - Con el scroll (o el botón «Ver las capas») las capas se separan en vista explosionada.
 *  - El entremet es una ILUSTRACIÓN procedural: no representa un producto concreto de Candú.
 *  - Plato, granada y limón son modelos fotoescaneados CC0 de Poly Haven (ver docs/CREDITOS-3D.md).
 */
export interface SceneOptions {
  onFail: () => void;
  /** Sin animaciones automáticas: solo responde a arrastrar y al botón. */
  reduced?: boolean;
  onInteract?: () => void;
  /** Etiquetas HTML de las capas (de abajo arriba). La escena las coloca junto a cada capa. */
  labels?: HTMLElement[];
}

export interface SceneHandle {
  setOpen: (open: boolean) => void;
  dispose: () => void;
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (a: number, b: number, t: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
/** power2.inOut: se queda quieto al principio y al final del recorrido. */
const inOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true, repeat?: [number, number]) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

/** Bizcocho: miga dorada con alveolos. */
function spongeTex(bump: boolean) {
  return canvasTex(
    512,
    256,
    (g) => {
      g.fillStyle = bump ? "#9a9a9a" : "#d9a865";
      g.fillRect(0, 0, 512, 256);
      const r = rng(5);
      for (let i = 0; i < 1600; i++) {
        const x = r() * 512;
        const y = r() * 256;
        const s = 0.8 + r() * 3.2;
        g.fillStyle = bump ? `rgba(20,20,20,${0.35 + r() * 0.5})` : `rgba(${120 + r() * 30},${70 + r() * 20},30,${0.25 + r() * 0.45})`;
        g.beginPath();
        g.ellipse(x, y, s, s * (0.6 + r() * 0.6), r() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
      for (let i = 0; i < 900; i++) {
        g.fillStyle = bump ? `rgba(255,255,255,${r() * 0.25})` : `rgba(250,215,150,${r() * 0.3})`;
        g.fillRect(r() * 512, r() * 256, 1 + r() * 2, 1 + r() * 2);
      }
    },
    !bump,
  );
}

/** Base crujiente: sablé tostado con miga gruesa. */
function crumbTex(bump: boolean) {
  return canvasTex(
    512,
    256,
    (g) => {
      const grad = g.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, bump ? "#888" : "#b9773f");
      grad.addColorStop(1, bump ? "#777" : "#8a5228");
      g.fillStyle = grad;
      g.fillRect(0, 0, 512, 256);
      const r = rng(11);
      for (let i = 0; i < 2600; i++) {
        const light = r() > 0.5;
        g.fillStyle = bump
          ? `rgba(${light ? "255,255,255" : "0,0,0"},${r() * 0.5})`
          : light
            ? `rgba(240,195,130,${r() * 0.4})`
            : `rgba(70,38,16,${r() * 0.45})`;
        g.beginPath();
        g.arc(r() * 512, r() * 256, 0.8 + r() * 2.6, 0, Math.PI * 2);
        g.fill();
      }
    },
    !bump,
  );
}

/** Mousse: crema lisa con una ligera variación de tono. */
function mousseTex() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = "#f2e4cf";
    g.fillRect(0, 0, 256, 256);
    const r = rng(17);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? "255,250,240" : "214,190,160"},${r() * 0.12})`;
      g.beginPath();
      g.arc(r() * 256, r() * 256, 2 + r() * 10, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** Glaseado espejo: frambuesa con vetas muy sutiles. */
function glazeTex() {
  return canvasTex(1024, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#6e0b1d");
    grad.addColorStop(0.5, "#861328");
    grad.addColorStop(1, "#981c31");
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 256);
    const r = rng(7);
    g.lineCap = "round";
    for (let i = 0; i < 18; i++) {
      const x = r() * 1024;
      const y = 40 + r() * 180;
      g.strokeStyle = `rgba(255,190,200,${0.05 + r() * 0.12})`;
      g.lineWidth = 2 + r() * 10;
      g.filter = `blur(${3 + r() * 4}px)`;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + 60, y - 40 + r() * 80, x + 120, y + 30 - r() * 60, x + 200 + r() * 100, y + r() * 30 - 15);
      g.stroke();
    }
    g.filter = "none";
  });
}

function shadowTex() {
  return canvasTex(
    256,
    256,
    (g) => {
      const rg = g.createRadialGradient(128, 128, 8, 128, 128, 128);
      rg.addColorStop(0, "rgba(60,30,20,0.5)");
      rg.addColorStop(0.55, "rgba(60,30,20,0.18)");
      rg.addColorStop(1, "rgba(60,30,20,0)");
      g.fillStyle = rg;
      g.fillRect(0, 0, 256, 256);
    },
    false,
  );
}

/**
 * UV sin vetas radiales: en las caras planas (tapas) se proyecta desde arriba;
 * en los laterales, alrededor del cilindro. Así la miga y el bizcocho parecen materia, no rayos.
 */
function fixUVs(geo: THREE.BufferGeometry, scale = 1): THREE.BufferGeometry {
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.abs(nor.getY(i)) > 0.6) uv.setXY(i, (x * 0.5 + 0.5) * scale, (z * 0.5 + 0.5) * scale);
    else uv.setXY(i, ((Math.atan2(z, x) / (Math.PI * 2)) + 0.5) * 3 * scale, y * 1.6 * scale);
  }
  uv.needsUpdate = true;
  return geo;
}

/** Cilindro con aristas redondeadas (perfil de torno). Base en y=0. */
function roundedCylinder(r: number, h: number, bevel: number, segments = 96): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0001, 0)];
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = a0 + ((a1 - a0) * i) / 6;
      pts.push(new THREE.Vector2(cx + Math.cos(a) * bevel, cy + Math.sin(a) * bevel));
    }
  };
  arc(r - bevel, bevel, -Math.PI / 2, 0);
  arc(r - bevel, h - bevel, 0, Math.PI / 2);
  pts.push(new THREE.Vector2(0.0001, h));
  return fixUVs(new THREE.LatheGeometry(pts, segments));
}

/** Cubierta de glaseado: tapa y laterales con canto suave (abierta por abajo). */
function glazeShell(r: number, y0: number, y1: number, bevel: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [new THREE.Vector2(r, y0)];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - bevel + Math.cos(a) * bevel, y1 - bevel + Math.sin(a) * bevel));
  }
  pts.push(new THREE.Vector2(0.0001, y1));
  return new THREE.LatheGeometry(pts, 128);
}

/** Frambuesas: cada una formada por ~70 drupas (esferas instanciadas, una sola llamada de dibujo). */
function raspberries(positions: THREE.Vector3[], material: THREE.Material, geo: THREE.BufferGeometry) {
  const per = 72;
  const mesh = new THREE.InstancedMesh(geo, material, per * positions.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  let k = 0;
  const r = rng(3);
  for (const [pi, p] of positions.entries()) {
    const tq = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.9, r() * Math.PI * 2, (r() - 0.5) * 0.9));
    for (let i = 0; i < per; i++) {
      // Distribución de Fibonacci sobre un elipsoide algo cónico (forma de frambuesa).
      const t = (i + 0.5) / per;
      const phi = Math.acos(1 - 1.7 * t);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i + pi;
      const ry = 0.13 * Math.cos(phi);
      const rr = 0.105 * Math.sin(phi) * (0.85 + 0.15 * Math.cos(phi));
      v.set(Math.cos(theta) * rr, ry, Math.sin(theta) * rr).applyQuaternion(tq).add(p);
      const sc = 0.85 + r() * 0.3;
      s.set(sc, sc, sc);
      m.compose(v, q, s);
      mesh.setMatrixAt(k++, m);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function createScene(container: HTMLElement, opts: SceneOptions): SceneHandle {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    opts.onFail();
    return { setOpen() {}, dispose() {} };
  }
  let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environment = env;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);

  // Luz cálida de ventana de obrador + relleno suave + contraluz rosado.
  const key = new THREE.DirectionalLight(0xfff1df, 2.4);
  key.position.set(-4, 6, 5);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(5, 2, 4);
  const rim = new THREE.DirectionalLight(0xffc9c0, 1.6);
  rim.position.set(3, 3, -5);
  scene.add(key, fill, rim, new THREE.HemisphereLight(0xfff6ec, 0xc9a98a, 0.45));

  const disposables: { dispose: () => void }[] = [env, pmrem];
  const track = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  const root = new THREE.Group();
  scene.add(root);

  // ── Plato (modelo de madera tallada, se añade cuando carga) ──
  const plate = new THREE.Group();
  root.add(plate);
  let baseY = 0.12;

  const shadow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1, 1)),
    track(new THREE.MeshBasicMaterial({ map: track(shadowTex()), transparent: true, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.005;
  shadow.scale.set(5.6, 5.6, 1);
  root.add(shadow);

  // ── Entremet ──
  const cake = new THREE.Group();
  root.add(cake);

  const mats = {
    base: track(new THREE.MeshStandardMaterial({ map: track(crumbTex(false)), bumpMap: track(crumbTex(true)), bumpScale: 3, roughness: 0.92 })),
    sponge: track(new THREE.MeshStandardMaterial({ map: track(spongeTex(false)), bumpMap: track(spongeTex(true)), bumpScale: 4, roughness: 0.9 })),
    insert: track(
      new THREE.MeshPhysicalMaterial({ color: 0x8f1028, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenColor: new THREE.Color(0xff6f7f), envMapIntensity: 0.9 }),
    ),
    mousse: track(
      new THREE.MeshPhysicalMaterial({ map: track(mousseTex()), bumpMap: track(spongeTex(true)), bumpScale: 0.6, roughness: 0.62, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xfff4e6), envMapIntensity: 0.6 }),
    ),
    glaze: track(
      new THREE.MeshPhysicalMaterial({ map: track(glazeTex()), color: new THREE.Color(0.62, 0.6, 0.6), roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, specularIntensity: 1, side: THREE.DoubleSide }),
    ),
    berry: track(new THREE.MeshPhysicalMaterial({ color: 0x7c0a20, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.6, sheenColor: new THREE.Color(0xff8095) })),
    gold: track(new THREE.MeshStandardMaterial({ color: 0xe0b55e, metalness: 1, roughness: 0.22, side: THREE.DoubleSide })),
  };

  /** Capas de abajo arriba: altura de montaje, subida al abrir y punto de anclaje de la etiqueta. */
  type Layer = { obj: THREE.Object3D; y: number; lift: number; anchorR: number; anchorH: number };
  const layers: Layer[] = [];
  const addLayer = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, lift: number, anchorR: number, anchorH: number) => {
    const mesh = new THREE.Mesh(track(geo), mat);
    mesh.position.y = y;
    cake.add(mesh);
    layers.push({ obj: mesh, y, lift, anchorR, anchorH });
  };
  addLayer(roundedCylinder(1.0, 0.14, 0.03), mats.base, 0, 0, 1.0, 0.07); // base crujiente
  addLayer(roundedCylinder(0.92, 0.2, 0.02), mats.sponge, 0.14, 0.45, 0.92, 0.1); // bizcocho
  addLayer(roundedCylinder(0.68, 0.16, 0.05), mats.insert, 0.34, 0.8, 0.68, 0.08); // inserto de fruta
  addLayer(roundedCylinder(1.0, 0.5, 0.05), mats.mousse, 0.14, 1.5, 1.0, 0.25); // mousse

  // Cubierta de glaseado + decoración (se mueven juntas).
  const top = new THREE.Group();
  cake.add(top);
  // Al abrir, la cubierta se recoge hacia arriba hasta quedar como una tapa fina de glaseado.
  const shell = new THREE.Mesh(track(glazeShell(1.03, 0.12, 0.92, 0.08)), mats.glaze);
  top.add(shell);
  const drupe = track(new THREE.SphereGeometry(0.036, 10, 8));
  top.add(
    raspberries(
      [new THREE.Vector3(0.42, 1.03, 0.1), new THREE.Vector3(0.18, 1.03, 0.36), new THREE.Vector3(-0.12, 1.03, 0.4), new THREE.Vector3(0.3, 1.03, -0.2), new THREE.Vector3(0.12, 1.2, 0.12)],
      mats.berry,
      drupe,
    ),
  );
  // Pan de oro: escamas irregulares.
  const r0 = rng(23);
  for (let i = 0; i < 9; i++) {
    const shape = new THREE.Shape();
    const n = 5 + Math.floor(r0() * 3);
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2;
      const rr = 0.03 + r0() * 0.035;
      if (j === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const flake = new THREE.Mesh(track(new THREE.ShapeGeometry(shape)), mats.gold);
    const a = r0() * Math.PI * 2;
    const d = 0.25 + r0() * 0.55;
    flake.position.set(Math.cos(a) * d, 0.925, Math.sin(a) * d);
    flake.rotation.set(-Math.PI / 2 + (r0() - 0.5) * 0.4, 0, r0() * Math.PI);
    top.add(flake);
  }
  layers.push({ obj: top, y: 0, lift: 2.35, anchorR: 1.03, anchorH: 0.62 });

  let dirty = true;

  // ── Modelos fotoescaneados (CC0): se cargan después de mostrar la escena ──
  const fruit = new THREE.Group();
  root.add(fruit);
  let disposed = false;
  (async () => {
    try {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const load = (url: string) => new Promise<THREE.Group>((res, rej) => loader.load(url, (g) => res(g.scene), undefined, rej));
      const [plateM, pome, lemon] = await Promise.all([
        load("/models/carved_wooden_plate.glb"),
        load("/models/food_pomegranate_01.glb"),
        load("/models/lemon.glb"),
      ]);
      if (disposed) return;
      const keep = (o: THREE.Object3D) =>
        o.traverse((c) => {
          const m = c as THREE.Mesh;
          if (!m.isMesh) return;
          track(m.geometry);
          const mm = m.material as THREE.MeshStandardMaterial;
          track(mm);
          for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap"] as const) {
            const tex = mm[k];
            if (tex) track(tex);
          }
          mm.envMapIntensity = 0.7;
        });
      // Escala real: el entremet mide unos 16 cm (2 unidades) → 1 m = 12,5 unidades.
      const S = 12.5;
      plateM.scale.setScalar(S * 1.12);
      keep(plateM);
      plate.add(plateM);
      // Altura real de la superficie del plato en el centro.
      plate.updateMatrixWorld(true);
      const hit = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0)).intersectObject(plateM, true)[0];
      if (hit) baseY = hit.point.y + 0.005;

      pome.scale.setScalar(S);
      pome.position.set(-1.75, 0, 1.35);
      pome.rotation.set(0.12, 0.6, -0.1);
      keep(pome);
      lemon.scale.setScalar(S);
      lemon.position.set(1.65, 0.45, 1.3);
      lemon.rotation.set(Math.PI / 2.1, 0.3, 0.9);
      keep(lemon);
      fruit.add(pome, lemon);
      dirty = true;
    } catch {
      // Sin modelos (sin conexión, bloqueados…): la escena sigue funcionando solo con el entremet.
    }
  })();

  // ── Interacción ──
  const reduced = Boolean(opts.reduced);
  let px = 0;
  let py = 0;
  let tx = 0;
  let ty = 0;
  let progress = 0; // scroll dentro del hero (solo con animaciones completas)
  let openTarget = 0; // botón
  let shown = 0;
  let spin = 0;
  let spinTarget = 0;
  let tilt = 0;
  let tiltTarget = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const onPointer = (e: PointerEvent) => {
    if (reduced || dragging) return;
    tx = e.clientX / window.innerWidth - 0.5;
    ty = e.clientY / window.innerHeight - 0.5;
  };
  const hero = (container.closest("section") ?? container) as HTMLElement;
  const onScroll = () => {
    if (reduced) return;
    const rect = hero.getBoundingClientRect();
    const travel = Math.max(window.innerHeight * 0.4, rect.height - window.innerHeight);
    progress = clamp01(-rect.top / travel);
  };
  const canvas = renderer.domElement;
  canvas.style.touchAction = "pan-y";
  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
    opts.onInteract?.();
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    spinTarget += (e.clientX - lastX) * 0.012;
    tiltTarget = Math.max(-0.25, Math.min(0.4, tiltTarget + (e.clientY - lastY) * 0.005));
    lastX = e.clientX;
    lastY = e.clientY;
    dirty = true;
  };
  const onUp = () => {
    dragging = false;
    canvas.style.cursor = "grab";
  };
  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  let cw = 1;
  let ch = 1;
  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    cw = w;
    ch = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // En pantallas estrechas se abre el encuadre para que la pieza abierta quepa.
    camera.fov = w / h < 0.9 ? 34 : 28;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
  io.observe(container);

  const labels = opts.labels ?? [];
  const p = new THREE.Vector3();
  const look = new THREE.Vector3();

  let frames = 0;
  let acc = 0;
  let last = performance.now();
  let raf = 0;
  const clock = new THREE.Clock();

  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden) {
      last = performance.now();
      return;
    }
    const now = performance.now();
    const dt = now - last;
    last = now;
    // Si el dispositivo va lento: baja resolución; si va muy lento, se muestra la foto.
    if (frames < 90 && document.hasFocus()) {
      frames++;
      if (frames > 10) acc += dt;
      if (frames === 90) {
        const avg = acc / 80;
        if (avg > 90) {
          cancelAnimationFrame(raf);
          opts.onFail();
          return;
        }
        if (avg > 24 && dpr > 1) {
          dpr = 1;
          renderer.setPixelRatio(1);
          resize();
        }
      }
    }
    const t = clock.getElapsedTime();
    const prev = shown + spin + tilt + px + py;
    px += (tx - px) * 0.06;
    py += (ty - py) * 0.06;
    spin += (spinTarget - spin) * 0.16;
    tilt += (tiltTarget - tilt) * 0.16;
    const scrollOpen = reduced ? 0 : smooth(0.12, 0.78, progress);
    const target = Math.max(scrollOpen, openTarget);
    shown += (target - shown) * (reduced ? 0.22 : 0.1);
    const e = inOut(clamp01(shown));
    const settled = Math.abs(shown + spin + tilt + px + py - prev) < 1e-4;
    // Con movimiento reducido solo se dibuja cuando algo cambia (ahorra batería).
    if (reduced && settled && !dirty && frames >= 90) return;
    dirty = false;

    const idle = reduced ? 0 : 1;
    root.rotation.y = -0.35 + spin + px * 0.45 + Math.sin(t * 0.3) * 0.12 * idle + e * 0.5 * idle;
    root.rotation.x = tilt + py * 0.08;
    cake.position.y = baseY;

    // Vista explosionada: cada capa sube con un pequeño giro propio.
    for (const [i, L] of layers.entries()) {
      L.obj.position.y = L.y + L.lift * e + (i > 0 ? Math.sin(t * 0.9 + i) * 0.015 * e * idle : 0);
      L.obj.rotation.y = e * (i - 2) * 0.12;
    }
    const sy = 1 - 0.82 * e;
    shell.scale.y = sy;
    shell.position.y = 0.92 * (1 - sy);

    // Cámara: se aleja y sube para encuadrar la pieza abierta.
    camera.position.set(0, 2.7 + e * 0.9, 9.6 + e * 2.0);
    look.set(0, 0.45 + e * 1.15, 0);
    camera.lookAt(look);

    renderer.render(scene, camera);

    // Etiquetas: aparecen con la pieza abierta, a la derecha de cada capa en pantalla.
    if (labels.length) {
      const op = smooth(0.55, 0.9, e);
      scene.updateMatrixWorld();
      for (const [i, el] of labels.entries()) {
        const L = layers[i];
        if (!L) continue;
        p.set(0, L.obj.position.y + L.anchorH, 0);
        cake.localToWorld(p);
        p.x += L.anchorR * 1.04;
        p.project(camera);
        el.style.transform = `translate3d(${((p.x * 0.5 + 0.5) * cw).toFixed(1)}px, ${((-p.y * 0.5 + 0.5) * ch).toFixed(1)}px, 0)`;
        el.style.opacity = op.toFixed(3);
      }
    }
  };
  loop();

  return {
    setOpen(open: boolean) {
      openTarget = open ? 1 : 0;
      dirty = true;
      opts.onInteract?.();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      ro.disconnect();
      io.disconnect();
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
