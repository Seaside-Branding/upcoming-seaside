// Entry point: owns the intro lifecycle (loading, start screen, playback loop, controls). The page-level host lives in index.html.
import { IntroAudio, SPEED_RATE } from './audio';
import { BEAT, CLAP_BEAT, FINAL_BEAT } from './timeline';
import type { IntroScene } from './scene';

interface IntroHost {
  started: boolean;
  play: ((options?: { forced?: boolean }) => void) | null;
  onDismiss: (() => void) | null;
  dismiss: () => void;
  /** Debug/test helper: freeze the intro at `seconds` (or resume with null). */
  seek?: (seconds: number | null) => void;
}
declare global { interface Window { ziffIntro?: IntroHost } }

const SOUND_KEY = 'ziff-intro-sound';
const host = window.ziffIntro;
const film = document.getElementById('intro-film');
let canvas = document.getElementById('intro-canvas') as HTMLCanvasElement | null;
const flash = document.getElementById('intro-flash');
const skipButton = document.getElementById('intro-skip');
const enterButton = document.getElementById('intro-enter');
const soundButton = document.getElementById('intro-sound');
const enterSound = document.getElementById('intro-enter-sound');
const enterMuted = document.getElementById('intro-enter-muted');
const gateNote = document.getElementById('intro-gate-note');

const audio = new IntroAudio();
let token = 0;
let stopLoop: (() => void) | null = null;
let currentTime = 0;
let isPlaying = false;
let pendingChoice: ((sound: boolean) => void) | null = null;

function readChoice(): 'on' | 'off' | null {
  try {
    const value = sessionStorage.getItem(SOUND_KEY);
    return value === 'on' || value === 'off' ? value : null;
  } catch { return null; }
}
function saveChoice(sound: boolean) {
  try { sessionStorage.setItem(SOUND_KEY, sound ? 'on' : 'off'); } catch { /* Storage may be unavailable. */ }
}

function isWeakDevice() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
  return Boolean(
    nav.connection?.saveData ||
    ['slow-2g', '2g'].includes(nav.connection?.effectiveType ?? '') ||
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2)
  );
}

const withCap = (promise: Promise<unknown>, ms: number) =>
  Promise.race([promise.catch(() => undefined), new Promise((resolve) => window.setTimeout(resolve, ms))]);

let peepsPromise: Promise<unknown> | null = null;
function loadPeeps() {
  peepsPromise ??= withCap(new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${import.meta.env.BASE_URL}vendor/css-peeps/css-peeps.compat.css`;
    link.onload = link.onerror = resolve;
    document.head.appendChild(link);
  }), 2500);
  return peepsPromise;
}

function setSoundLabel(on: boolean) {
  if (!soundButton) return;
  soundButton.textContent = on ? 'Sound on' : 'Sound off';
  soundButton.setAttribute('aria-pressed', String(on));
}

async function play(options: { forced?: boolean } = {}) {
  if (!host || !film || !canvas) return;
  const mine = ++token;
  stopLoop?.();
  const forced = options.forced === true;
  if (!forced && isWeakDevice()) {
    host.dismiss();
    return;
  }
  // Replay comes from a click, so the stored choice can start sound without another prompt.
  const stored = readChoice();
  if (forced && stored === 'on') audio.unlock();

  isPlaying = false;
  pendingChoice = null;
  film.classList.remove('is-final', 'is-playing', 'is-ready');
  film.classList.add('is-gate');
  if (gateNote) gateNote.textContent = 'Loading…';
  // A force-lost WebGL context cannot be revived, so each playback gets a fresh canvas.
  const freshCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
  canvas.replaceWith(freshCanvas);
  canvas = freshCanvas;
  setSoundLabel(false);
  skipButton?.focus({ preventScroll: true });

  let scene: IntroScene;
  try {
    const fonts = withCap(Promise.all([document.fonts.load('120px IntroRust'), document.fonts.load('700 56px Oswald')]), 2500);
    const [module] = await Promise.all([import('./scene'), fonts, loadPeeps()]);
    if (mine !== token) return;
    scene = await module.createIntroScene(freshCanvas);
  } catch {
    if (mine === token) host.dismiss();
    return;
  }
  if (mine !== token) {
    scene.dispose();
    return;
  }
  host.started = true;
  const scoreReady = audio.prepare(scene.speedCurve(SPEED_RATE));

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (event: PointerEvent) => {
    pointer.tx = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (event.clientY / window.innerHeight) * 2 - 1;
  };
  const onResize = () => scene.resize();
  const onVisibility = () => { if (document.hidden) audio.suspend(); else audio.resume(); };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') host.dismiss();
    else if (event.key === 'Enter' && film.classList.contains('is-final')) host.dismiss();
    else if (event.key === 'Enter' && pendingChoice && !(event.target instanceof HTMLButtonElement)) {
      audio.unlock();
      pendingChoice(true);
    }
  };
  window.addEventListener('pointermove', onPointer);
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('keydown', onKey);

  let raf = 0;
  let frame = 0;
  let startTime = 0;
  let lastNow = 0;
  let frozen: number | null = null;
  let perfSum = 0;
  let perfCount = 0;
  let isFinal = false;
  let clapped = false;

  const begin = (sound: boolean, persist = true) => {
    if (isPlaying) return;
    isPlaying = true;
    pendingChoice = null;
    film.classList.remove('is-gate', 'is-ready');
    film.classList.add('is-playing');
    if (persist) saveChoice(sound);
    audio.setMuted(!sound);
    let delay = 0;
    if (sound && audio.ready) delay = audio.start(0);
    setSoundLabel(sound && audio.playing);
    startTime = performance.now() + delay * 1000;
    skipButton?.focus({ preventScroll: true });
  };
  host.seek = (seconds) => {
    frozen = seconds;
    if (seconds !== null) begin(false, false);
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const delta = lastNow ? now - lastNow : 16;
    lastNow = now;
    if (isPlaying && delta > 250) startTime += delta;
    currentTime = isPlaying ? frozen ?? Math.max(0, (now - startTime) / 1000) : 0;

    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;
    const { beat } = scene.render(currentTime, pointer);

    const nowFinal = beat >= FINAL_BEAT;
    if (nowFinal !== isFinal) {
      isFinal = nowFinal;
      film.classList.toggle('is-final', isFinal);
      if (isFinal) enterButton?.focus({ preventScroll: true });
    }
    const nowClapped = beat >= CLAP_BEAT;
    if (nowClapped && !clapped && flash) {
      flash.classList.remove('is-popping');
      void flash.offsetWidth;
      flash.classList.add('is-popping');
    }
    clapped = nowClapped;

    if (!isPlaying) return;
    // Weak GPUs: first drop resolution, then jump to the final frame rather than stutter through it.
    frame += 1;
    if (frame > 8 && frame <= 48) { perfSum += delta; perfCount += 1; }
    if (frame === 48 && perfSum / perfCount > 26) scene.setPixelRatio(1);
    if (frame === 49) { perfSum = 0; perfCount = 0; }
    if (frame > 70 && frame <= 170) { perfSum += delta; perfCount += 1; }
    if (frame === 170 && perfSum / perfCount > 38 && !isFinal) startTime = now - FINAL_BEAT * BEAT * 1000;
  };
  raf = requestAnimationFrame(tick);

  stopLoop = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('keydown', onKey);
    host.seek = undefined;
    stopLoop = null;
    pendingChoice = null;
    // Keep the last frame on screen while the film fades out, then free the GPU.
    window.setTimeout(() => scene.dispose(), 700);
  };

  // Rendering the score takes a few seconds on slow machines, so the choice is offered straight away and playback waits if needed.
  const choose = async (sound: boolean) => {
    if (isPlaying || !pendingChoice) return;
    pendingChoice = null;
    if (sound && !audio.ready) {
      if (gateNote) gateNote.textContent = 'Preparing sound…';
      await withCap(scoreReady, 10000);
    }
    if (mine === token) begin(sound);
  };
  if (forced && stored) {
    pendingChoice = () => undefined;
    await choose(stored === 'on');
  } else {
    film.classList.add('is-ready');
    if (gateNote) gateNote.textContent = audio.ready ? 'Best experienced with sound on.' : 'Preparing sound…';
    void scoreReady.then((ok) => {
      if (mine === token && !isPlaying && gateNote) gateNote.textContent = ok ? 'Best experienced with sound on.' : 'Sound is unavailable here.';
    });
    pendingChoice = (sound) => { void choose(sound); };
    enterSound?.focus({ preventScroll: true });
  }
}

if (host) {
  host.play = (options) => { void play(options); };
  host.onDismiss = () => {
    token += 1;
    isPlaying = false;
    stopLoop?.();
    audio.stop();
  };

  skipButton?.addEventListener('click', () => host.dismiss());
  enterButton?.addEventListener('click', () => host.dismiss());
  enterSound?.addEventListener('click', () => {
    if (!pendingChoice) return;
    audio.unlock();
    pendingChoice(true);
  });
  enterMuted?.addEventListener('click', () => pendingChoice?.(false));
  soundButton?.addEventListener('click', () => {
    if (!isPlaying) return;
    if (audio.playing && !audio.isMuted) {
      audio.setMuted(true);
      setSoundLabel(false);
      return;
    }
    audio.unlock();
    audio.setMuted(false);
    if (!audio.playing) audio.start(currentTime);
    setSoundLabel(audio.playing);
  });

  if (document.documentElement.classList.contains('intro-pending')) void play();
}
