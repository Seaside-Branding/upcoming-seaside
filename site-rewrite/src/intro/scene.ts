// Three.js scene for the opening: extruded vector lettering, the original clapper artwork, a low-poly clapperboard prop and film reel.
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { LOGO_LAYERS, LOGO_SIZE } from './logo-data';
import { ICON_ART } from './icon-data';
import iconAsset from './clapper-icon.png';
import {
  BEAT, CLAP_BEAT, CUT_BEAT, END_BEAT, FINAL_BEAT, PALETTES, buildPaths, easeOutBack, easings, paletteAt, samplePose, type Anchor
} from './timeline';

const iconUrl = typeof iconAsset === 'string' ? iconAsset : (iconAsset as { src: string }).src;
const S = 0.01;
const FRONT_DEPTH = 34;
const SHADOW_DEPTH = 14;
const FRONT_Z = FRONT_DEPTH * S;
const FOV = 30;
const CX = LOGO_SIZE.width / 2;
const CY = LOGO_SIZE.height / 2;
const LOGO_W = LOGO_SIZE.width * S;
const LOGO_H = LOGO_SIZE.height * S;
const CONFETTI_PER_BURST = 70;
const BURSTS = [{ beat: 16.8, origin: [0, 0, 0.9] }, { beat: 18.6, origin: [0, -0.3, 0.9] }] as const;
const CONFETTI_COLORS = [0xff8f7a, 0xdcdeff, 0xffd700, 0xc27a7a];
const ICON_REVEAL_BEAT = 17;
const PROP_EXIT_END = CLAP_BEAT + 0.55;

type Box = { minX: number; maxX: number; minY: number; maxY: number };
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toonGradient() {
  const texture = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function canvasTexture(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface IntroScene {
  /** Renders the frame for `time` seconds; `pointer` is -1..1 on each axis (used once the logo is held). */
  render(time: number, pointer: { x: number; y: number }): { beat: number };
  resize(): void;
  setPixelRatio(ratio: number): void;
  /** Normalised camera speed (0-1) sampled `rate` times per second, used to drive wind/whoosh sound. */
  speedCurve(rate: number): Float32Array;
  dispose(): void;
}

export async function createIntroScene(canvas: HTMLCanvasElement): Promise<IntroScene> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.02, 200);
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(2, 4, 6);
  scene.add(key);

  const gradientMap = toonGradient();
  const loader = new SVGLoader();
  const iconTexture = await new THREE.TextureLoader().loadAsync(iconUrl);
  iconTexture.colorSpace = THREE.SRGBColorSpace;
  iconTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // Lettering: front and shadow layers share one group that flips SVG's y axis into world space.
  const logo = new THREE.Group();
  logo.scale.set(S, -S, S);
  logo.position.set(-CX * S, CY * S, 0);
  scene.add(logo);

  const capFront = new THREE.MeshBasicMaterial();
  const sideFront = new THREE.MeshBasicMaterial();
  const capShadow = new THREE.MeshBasicMaterial();
  const sideShadow = new THREE.MeshBasicMaterial();

  function buildRow(markups: readonly string[], depth: number, materials: THREE.Material[], z: number) {
    const pieces = markups.map((markup) => {
      const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`);
      const shapes = data.paths.flatMap((path) => path.toShapes(true));
      const geometry = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 40 });
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox!;
      return { geometry, centerX: (bounds.min.x + bounds.max.x) / 2, bounds };
    });
    pieces.sort((a, b) => a.centerX - b.centerX);
    const boxes: Box[] = pieces.map(({ bounds }) => ({
      minX: (bounds.min.x - CX) * S, maxX: (bounds.max.x - CX) * S,
      minY: -(bounds.max.y - CY) * S, maxY: -(bounds.min.y - CY) * S
    }));
    pieces.forEach(({ geometry }) => {
      const mesh = new THREE.Mesh(geometry, materials);
      mesh.position.z = z;
      logo.add(mesh);
    });
    return boxes;
  }

  const zoomBoxes = buildRow(LOGO_LAYERS.zoomFront, FRONT_DEPTH, [capFront, sideFront], 0);
  const filmBoxes = buildRow(LOGO_LAYERS.filmFront, FRONT_DEPTH, [capFront, sideFront], 0);
  buildRow(LOGO_LAYERS.zoomShadow, SHADOW_DEPTH, [capShadow, sideShadow], -SHADOW_DEPTH);
  buildRow(LOGO_LAYERS.filmShadow, SHADOW_DEPTH, [capShadow, sideShadow], -SHADOW_DEPTH);

  const colors = Object.fromEntries(
    Object.entries(PALETTES).map(([name, p]) => [name, { bg: new THREE.Color(p.bg), front: new THREE.Color(p.front), shadow: new THREE.Color(p.shadow) }])
  ) as Record<keyof typeof PALETTES, { bg: THREE.Color; front: THREE.Color; shadow: THREE.Color }>;
  const background = new THREE.Color();
  scene.background = background;
  function applyPalette(beat: number) {
    const { from, to, mix } = paletteAt(beat);
    background.lerpColors(colors[from].bg, colors[to].bg, mix);
    capFront.color.lerpColors(colors[from].front, colors[to].front, mix);
    sideFront.color.copy(capFront.color).multiplyScalar(0.6);
    capShadow.color.lerpColors(colors[from].shadow, colors[to].shadow, mix);
    sideShadow.color.copy(capShadow.color).multiplyScalar(0.6);
  }

  // The original clapper artwork. It sits above the lettering like in the brand lockup and fades in as the prop leaves.
  const iconCenter = {
    x: (ICON_ART.x + ICON_ART.width / 2 - CX) * S,
    y: -(ICON_ART.y + ICON_ART.height / 2 - CY) * S
  };
  const iconMaterial = new THREE.MeshBasicMaterial({ map: iconTexture, transparent: true, depthWrite: false, opacity: 0 });
  const iconPlane = new THREE.Mesh(new THREE.PlaneGeometry(ICON_ART.width * S, ICON_ART.height * S), iconMaterial);
  iconPlane.position.set(iconCenter.x, iconCenter.y, FRONT_Z + 0.06);
  iconPlane.visible = false;
  scene.add(iconPlane);

  // Clapperboard prop: a separate low-poly toy that claps on the beat and spins away.
  const toon = (color: number) => new THREE.MeshToonMaterial({ color, gradientMap });
  const addBox = (parent: THREE.Object3D, w: number, h: number, d: number, color: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(color));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const stripedBar = (width: number, height: number, flip: boolean) => {
    const bar = new THREE.Group();
    const count = 7;
    for (let i = 0; i < count; i += 1) {
      const color = (i + (flip ? 1 : 0)) % 2 === 0 ? 0xdcdeff : 0x550000;
      addBox(bar, width / count + 0.01, height, 0.42, color, (i + 0.5) * (width / count), 0, 0);
    }
    return bar;
  };

  const labelTexture = canvasTexture(512, 256, (context) => {
    context.fillStyle = '#ff8f7a';
    context.fillRect(0, 0, 512, 256);
    context.fillStyle = '#550000';
    context.textAlign = 'center';
    context.font = '88px IntroRust, Oswald, sans-serif';
    context.fillText('SCENE 27', 256, 120);
    context.font = '700 56px Oswald, sans-serif';
    context.fillText('TAKE 1 · ZIFF', 256, 214);
  });

  const clapper = new THREE.Group();
  const clapperBody = new THREE.Group();
  clapper.add(clapperBody);
  addBox(clapperBody, 4.6, 2.9, 0.4, 0xff8f7a, 0, -0.9, 0);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), new THREE.MeshBasicMaterial({ map: labelTexture }));
  label.position.set(0, -0.9, 0.23);
  clapperBody.add(label);
  const fixedBar = stripedBar(4.6, 0.6, true);
  fixedBar.position.set(-2.3, 0.85, 0);
  clapperBody.add(fixedBar);
  const armPivot = new THREE.Group();
  armPivot.position.set(-2.3, 1.2, 0);
  const arm = stripedBar(4.6, 0.6, false);
  arm.position.set(0, 0.32, 0);
  armPivot.add(arm);
  addBox(armPivot, 0.34, 0.34, 0.5, 0x894742, 0, 0, 0);
  clapperBody.add(armPivot);
  clapperBody.rotation.z = -0.2;
  const clapperHome = new THREE.Vector3(iconCenter.x, iconCenter.y, 0.5);
  clapper.visible = false;
  scene.add(clapper);

  // Film reel.
  const reelA = new THREE.Group();
  const discGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.14, 28).rotateX(Math.PI / 2);
  const holeGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.2, 14).rotateX(Math.PI / 2);
  const discMaterial = toon(0xdcdeff);
  const holeMaterial = toon(0x550000);
  [-0.1, 0.1].forEach((z) => {
    const disc = new THREE.Mesh(discGeometry, discMaterial);
    disc.position.z = z;
    reelA.add(disc);
  });
  for (let i = 0; i < 5; i += 1) {
    const hole = new THREE.Mesh(holeGeometry, holeMaterial);
    const angle = (i / 5) * Math.PI * 2;
    hole.position.set(Math.cos(angle) * 0.92, Math.sin(angle) * 0.92, 0);
    reelA.add(hole);
  }
  reelA.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.42, 14).rotateX(Math.PI / 2), toon(0xff8f7a)));
  const reelB = reelA.clone();
  [reelA, reelB].forEach((reel) => { reel.visible = false; scene.add(reel); });

  // Light sweep over the final logo.
  const sweepTexture = canvasTexture(256, 16, (context) => {
    const gradient = context.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, 'rgba(255,240,230,0.95)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 16);
  });
  const sweep = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 26),
    new THREE.MeshBasicMaterial({ map: sweepTexture, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })
  );
  sweep.rotation.z = 0.35;
  sweep.position.z = 1;
  sweep.renderOrder = 10;
  sweep.visible = false;
  scene.add(sweep);

  // Confetti: one instanced mesh, simulated analytically so seeking to any time works.
  const random = mulberry32(7);
  const confettiCount = CONFETTI_PER_BURST * BURSTS.length;
  const confetti = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.09, 0.012), new THREE.MeshBasicMaterial(), confettiCount);
  const particles = Array.from({ length: confettiCount }, (_, i) => {
    const angle = random() * Math.PI * 2;
    const speed = 2.5 + random() * 7;
    confetti.setColorAt(i, new THREE.Color(CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)]));
    return { burst: Math.floor(i / CONFETTI_PER_BURST), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed + 2, vz: random() * 4, spin: (random() - 0.5) * 14, phase: random() * 6 };
  });
  confetti.frustumCulled = false;
  confetti.visible = false;
  scene.add(confetti);
  const dummy = new THREE.Object3D();

  const anchor: Anchor = (row, index, u, v) => {
    if (row === 'center') return { x: 0, y: 0 };
    if (row === 'clapper') return { x: clapperHome.x, y: clapperHome.y };
    const box = (row === 'zoom' ? zoomBoxes : filmBoxes)[index];
    return { x: lerp(box.minX, box.maxX, u), y: lerp(box.minY, box.maxY, v) };
  };
  const paths = buildPaths(anchor);

  function armAngle(beat: number) {
    const open = 0.75;
    if (beat < 14.5) return 0;
    if (beat < 15.4) return open * easings.out((beat - 14.5) / 0.9);
    if (beat < 15.85) return open;
    if (beat < CLAP_BEAT) return open * (1 - easings.inOut((beat - 15.85) / 0.15));
    return 0;
  }

  function updateProps(beat: number, time: number) {
    clapper.visible = beat >= 12 && beat < PROP_EXIT_END;
    if (clapper.visible) {
      const arrive = clamp01((beat - 12) / 2);
      const pos = easeOutBack(arrive);
      const exit = clamp01((beat - CLAP_BEAT) / (PROP_EXIT_END - CLAP_BEAT));
      const fly = exit * exit;
      clapper.position.set(
        lerp(clapperHome.x - 7, clapperHome.x, pos) + fly * 2.5,
        lerp(clapperHome.y - 9, clapperHome.y, pos) + fly * 5,
        lerp(5, clapperHome.z, pos) + fly * 14
      );
      clapper.rotation.set(fly * 1.2, fly * 5, lerp(-2.4, 0, easings.out(arrive)) + fly * 6);
      clapper.scale.setScalar(lerp(0.3, 1, easings.out(arrive)) * (1 + fly * 0.8));
      armPivot.rotation.z = armAngle(beat);
    }

    const reelAWindow = clamp01((beat - 12.5) / 2.7);
    reelA.visible = beat >= 12.5 && beat < 15.2;
    reelA.position.set(lerp(0, -10.5, reelAWindow), lerp(2.4, -0.6, reelAWindow), 2.2);
    reelA.rotation.set(0.5, 0.3, time * 2.4);

    const reelBWindow = clamp01((beat - 16.6) / 3);
    reelB.visible = beat >= 16.6 && beat < 19.6;
    reelB.position.set(lerp(10, -10, reelBWindow), lerp(-3, 3, reelBWindow), 1.8);
    reelB.rotation.set(-0.4, -0.3, -time * 2.4);

    const iconIn = easings.out(clamp01((beat - ICON_REVEAL_BEAT) / 1));
    iconPlane.visible = iconIn > 0;
    iconMaterial.opacity = iconIn;
    iconPlane.scale.setScalar(lerp(0.94, 1, iconIn));

    const sweepWindow = clamp01((beat - 18.6) / 1.9);
    sweep.visible = beat >= 18.6 && beat < 20.6;
    sweep.position.x = lerp(-13, 13, easings.inOut(sweepWindow));

    confetti.visible = beat >= BURSTS[0].beat && beat < 21;
    if (confetti.visible) {
      particles.forEach((particle, i) => {
        const burst = BURSTS[particle.burst];
        const age = time - burst.beat * BEAT;
        if (age < 0 || age > 2.4) {
          dummy.scale.setScalar(0);
        } else {
          const drag = 1 - age * 0.18;
          dummy.position.set(
            burst.origin[0] + particle.vx * age * drag,
            burst.origin[1] + particle.vy * age * drag - 4.2 * age * age,
            burst.origin[2] + particle.vz * age * drag
          );
          dummy.rotation.set(particle.phase + age * particle.spin, age * particle.spin * 0.7, age * particle.spin);
          dummy.scale.setScalar(clamp01((2.4 - age) / 0.6));
        }
        dummy.updateMatrix();
        confetti.setMatrixAt(i, dummy.matrix);
      });
      confetti.instanceMatrix.needsUpdate = true;
    }
  }

  const target = new THREE.Vector3();
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  // Zoom 1 fits the whole lockup with room below for the Enter button; width-bound on tall screens.
  const baseHeight = (aspect: number) => Math.max(LOGO_H / 0.5, (LOGO_W * 1.18) / aspect);

  function render(time: number, pointer: { x: number; y: number }) {
    const beat = time / BEAT;
    const pose = samplePose(paths, beat);
    applyPalette(beat);
    updateProps(beat, time);

    const height = baseHeight(camera.aspect) / pose.zoom;
    const distance = height / (2 * tanHalf);
    // Scale the clip planes with the camera distance so thin surfaces (the clapper label) never z-fight.
    camera.near = Math.max(0.01, distance * 0.04);
    camera.far = distance * 8 + 60;
    camera.updateProjectionMatrix();

    const hold = clamp01((beat - FINAL_BEAT) / 1);
    const yaw = pose.yaw + pointer.x * 0.1 * hold;
    const pitch = pose.pitch - pointer.y * 0.06 * hold;
    target.set(pose.x, pose.y - pose.vy * height, FRONT_Z);
    camera.position.set(
      target.x + distance * Math.sin(yaw) * Math.cos(pitch),
      target.y + distance * Math.sin(pitch),
      target.z + distance * Math.cos(yaw) * Math.cos(pitch)
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.rotateZ(pose.roll);

    renderer.render(scene, camera);
    return { beat };
  }

  function speedCurve(rate: number) {
    const samples = Math.ceil(END_BEAT * BEAT * rate);
    const curve = new Float32Array(samples);
    const dt = 1 / rate;
    for (let i = 0; i < samples; i += 1) {
      const beat = (i * dt) / BEAT;
      // Hard cuts are not camera motion, so keep them silent.
      if (Math.abs(beat - 12) < 0.15 || Math.abs(beat - CUT_BEAT) < 0.15) continue;
      const a = samplePose(paths, beat);
      const b = samplePose(paths, beat + dt / BEAT);
      const height = baseHeight(16 / 9) / a.zoom;
      const travel = Math.hypot(b.x - a.x, b.y - a.y) / height;
      const dive = Math.abs(Math.log(b.zoom) - Math.log(a.zoom));
      curve[i] = clamp01((travel * 0.5 + dive * 0.4 + Math.abs(b.roll - a.roll) * 0.2) / dt / 2.2);
    }
    return curve;
  }

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();

  function dispose() {
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      materials.forEach((material) => {
        (material as THREE.MeshBasicMaterial).map?.dispose();
        material.dispose();
      });
    });
    gradientMap.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { render, resize, setPixelRatio: (ratio) => { renderer.setPixelRatio(ratio); resize(); }, speedCurve, dispose };
}
