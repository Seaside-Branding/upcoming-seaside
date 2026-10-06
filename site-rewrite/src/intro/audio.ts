// Synthesised score (no audio files). It is rendered once into a buffer, so playback is sample-accurate and seekable.
import { BEAT, CLAP_BEAT, CUT_BEAT, END_BEAT, FINAL_BEAT } from './timeline';

const SAMPLE_RATE = 32000;
const DURATION = END_BEAT * BEAT + 2.8;
export const SPEED_RATE = 20;

const NOTE = (name: string) => {
  const names: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const match = /^([A-G])(#|b)?(\d)$/.exec(name)!;
  const semitone = names[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0) + (Number(match[3]) + 1) * 12;
  return 440 * Math.pow(2, (semitone - 69) / 12);
};

// D minor, one chord per bar: Dm, Bb, Gm, A (tension before the clap), Dm.
const BARS = [
  { root: 'D', chord: ['D3', 'F3', 'A3', 'D4'], bass: 'D2' },
  { root: 'Bb', chord: ['Bb2', 'D3', 'F3', 'Bb3'], bass: 'Bb1' },
  { root: 'G', chord: ['G2', 'Bb2', 'D3', 'G3'], bass: 'G1' },
  { root: 'A', chord: ['A2', 'C#3', 'E3', 'A3'], bass: 'A1' },
  { root: 'D', chord: ['D3', 'F3', 'A3', 'D4'], bass: 'D2' }
];
const bar = (beat: number) => BARS[Math.min(BARS.length - 1, Math.max(0, Math.floor(beat / 4)))];

export async function renderScore(speed?: Float32Array): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(DURATION * SAMPLE_RATE), SAMPLE_RATE);
  const at = (beat: number) => beat * BEAT;

  // Bus layout: music -> duck -> dry; every voice can also feed the reverb and the echo.
  const dry = ctx.createGain();
  dry.gain.value = 0.5;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.knee.value = 12;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.22;
  const clip = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 1.4) / Math.tanh(1.4);
  clip.curve = curve;
  clip.oversample = '2x';
  const master = ctx.createGain();
  master.gain.value = 1.2;
  dry.connect(compressor).connect(clip).connect(master).connect(ctx.destination);

  const music = ctx.createGain();
  music.connect(dry);
  // The beat before the clap drops out so the hit lands harder.
  music.gain.setValueAtTime(1, 0);
  music.gain.setValueAtTime(1, at(15.7));
  music.gain.exponentialRampToValueAtTime(0.12, at(15.75));
  music.gain.setValueAtTime(0.12, at(CLAP_BEAT) - 0.004);
  music.gain.exponentialRampToValueAtTime(1, at(CLAP_BEAT) + 0.02);

  const reverbLength = Math.ceil(1.9 * SAMPLE_RATE);
  const impulse = ctx.createBuffer(2, reverbLength, SAMPLE_RATE);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < reverbLength; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / reverbLength, 2.6);
  }
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse;
  const reverbSend = ctx.createGain();
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.55;
  reverbSend.connect(reverb).connect(reverbReturn).connect(dry);

  const echo = ctx.createDelay(1);
  echo.delayTime.value = BEAT * 0.75;
  const echoFeedback = ctx.createGain();
  echoFeedback.gain.value = 0.38;
  const echoTone = ctx.createBiquadFilter();
  echoTone.type = 'lowpass';
  echoTone.frequency.value = 2600;
  const echoSend = ctx.createGain();
  echoSend.connect(echo);
  echo.connect(echoTone).connect(echoFeedback).connect(echo);
  echoTone.connect(music);
  echoTone.connect(reverbSend);

  const noiseLength = 2 * SAMPLE_RATE;
  const noiseBuffer = ctx.createBuffer(1, noiseLength, SAMPLE_RATE);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseLength; i += 1) noiseData[i] = Math.random() * 2 - 1;

  const noise = (start: number, length: number) => {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    source.start(start, Math.random() * 1.5);
    source.stop(start + length);
    return source;
  };
  const route = (node: AudioNode, bus: AudioNode, send = 0, echoAmount = 0, pan = 0) => {
    let tail: AudioNode = node;
    if (pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      tail.connect(panner);
      tail = panner;
    }
    tail.connect(bus);
    if (send > 0) { const g = ctx.createGain(); g.gain.value = send; tail.connect(g).connect(reverbSend); }
    if (echoAmount > 0) { const g = ctx.createGain(); g.gain.value = echoAmount; tail.connect(g).connect(echoSend); }
  };
  const pluck = (param: AudioParam, start: number, peak: number, attack: number, decay: number) => {
    param.setValueAtTime(0.0001, start);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
    param.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  };

  const tone = (type: OscillatorType, from: number, to: number, start: number, length: number, peak: number, bus: AudioNode, send = 0) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + length);
    pluck(gain.gain, start, peak, 0.004, length);
    osc.connect(gain);
    route(gain, bus, send);
    osc.start(start);
    osc.stop(start + length + 0.05);
  };

  const burst = (type: BiquadFilterType, from: number, to: number, start: number, length: number, peak: number, bus: AudioNode, send = 0, attack = 0.002, q = 1, pan = 0) => {
    const source = noise(start, length + attack + 0.05);
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, start);
    if (to !== from) filter.frequency.exponentialRampToValueAtTime(to, start + length);
    pluck(gain.gain, start, peak, attack, length);
    source.connect(filter).connect(gain);
    route(gain, bus, send, 0, pan);
  };

  const kick = (t: number, level = 1, bus: AudioNode = music) => {
    tone('sine', 160, 44, t, 0.3, 0.95 * level, bus);
    burst('highpass', 3500, 3500, t, 0.012, 0.18 * level, bus);
  };
  const clap = (t: number, level = 1, bus: AudioNode = music) => {
    burst('bandpass', 1700, 1100, t, 0.17, 0.5 * level, bus, 0.35, 0.002, 0.9);
    burst('bandpass', 2300, 1500, t + 0.011, 0.14, 0.4 * level, bus, 0.3, 0.002, 0.8);
    burst('highpass', 5200, 5200, t + 0.02, 0.1, 0.2 * level, bus, 0.2);
  };
  const snare = (t: number, level = 1) => {
    tone('triangle', 230, 130, t, 0.1, 0.3 * level, music);
    burst('bandpass', 2100, 1500, t, 0.16, 0.42 * level, music, 0.18);
  };
  const hat = (t: number, open: boolean, level = 1) => burst('highpass', 7600, 7600, t, open ? 0.22 : 0.045, 0.11 * level, music, 0.05);

  const bassNote = (t: number, freq: number, length: number, level = 1) => {
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(160, t + length);
    const gain = ctx.createGain();
    pluck(gain.gain, t, 0.3 * level, 0.006, length);
    saw.connect(filter).connect(gain);
    route(gain, music);
    saw.start(t);
    saw.stop(t + length + 0.05);
    tone('sine', freq, freq, t, length * 1.1, 0.55 * level, music);
  };

  const arpNote = (t: number, freq: number, length: number, cutoff: number, pan: number, level = 1) => {
    [0, 7].forEach((detune, index) => {
      const osc = ctx.createOscillator();
      osc.type = index === 0 ? 'sawtooth' : 'square';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 5;
      filter.frequency.setValueAtTime(cutoff * 1.8, t);
      filter.frequency.exponentialRampToValueAtTime(cutoff * 0.5, t + length);
      const gain = ctx.createGain();
      pluck(gain.gain, t, 0.055 * level, 0.004, length);
      osc.connect(filter).connect(gain);
      route(gain, music, 0.25, 0.3, pan);
      osc.start(t);
      osc.stop(t + length + 0.05);
    });
  };

  const pad = (start: number, end: number, notes: string[], level: number, bright = 900) => {
    notes.forEach((note, index) => {
      [-8, 8].forEach((detune) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = NOTE(note);
        osc.detune.value = detune + index;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(bright * 0.5, start);
        filter.frequency.linearRampToValueAtTime(bright * 1.6, end);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(level / notes.length, end - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, end + 0.9);
        osc.connect(filter).connect(gain);
        route(gain, music, 0.45);
        osc.start(start);
        osc.stop(end + 1);
      });
    });
  };

  const bell = (t: number, freq: number, level = 1, decay = 1.6, pan = 0) => {
    const partials: [number, number, number][] = [[1, 1, 1], [2.76, 0.35, 0.55], [5.4, 0.16, 0.3], [8.9, 0.07, 0.2]];
    partials.forEach(([ratio, gainScale, lengthScale]) => {
      if (freq * ratio > 12000) return;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * ratio;
      const gain = ctx.createGain();
      pluck(gain.gain, t, 0.16 * level * gainScale, 0.003, decay * lengthScale);
      osc.connect(gain);
      route(gain, dry, 0.7, 0.2, pan);
      osc.start(t);
      osc.stop(t + decay + 0.1);
    });
  };

  const whoosh = (start: number, length: number, from: number, to: number, peak: number, panFrom: number, panTo: number) => {
    const source = noise(start, length + 0.2);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + length * 0.75);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length * 1.05);
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(panFrom, start);
    panner.pan.linearRampToValueAtTime(panTo, start + length);
    source.connect(filter).connect(gain).connect(panner).connect(dry);
    const send = ctx.createGain();
    send.gain.value = 0.35;
    panner.connect(send).connect(reverbSend);
  };

  // ---- Bar 1 (beats 0-4): projector flutter, drone, first heartbeats.
  for (let t = 0; t < at(3.6); t += 1 / 24) {
    const fade = Math.min(1, t / at(1.2)) * Math.max(0, 1 - Math.max(0, t - at(2.4)) / at(1.2));
    burst('highpass', 2600, 2600, t, 0.004, 0.06 * fade, dry, 0.05, 0.0005);
  }
  tone('sine', 36.7, 36.7, 0, at(4.2), 0.32, music);
  pad(0, at(4), BARS[0].chord, 0.16, 700);
  kick(at(2), 0.4);
  kick(at(3), 0.55);
  kick(at(3.5), 0.4);

  // ---- Bars 2-4 (beats 4-16): groove builds.
  for (let beat = 4; beat < 15.5; beat += 1) {
    kick(at(beat), beat < 8 ? 0.85 : 1);
    const chord = bar(beat);
    const rootFreq = NOTE(chord.bass);
    bassNote(at(beat), rootFreq, BEAT * 0.45);
    bassNote(at(beat + 0.5), rootFreq * (beat % 2 ? 2 : 1), BEAT * 0.35, 0.8);
    hat(at(beat + 0.5), false, beat < 8 ? 0.7 : 1);
    if (beat >= 8) hat(at(beat + 0.25), false, 0.45);
    if (beat >= 8 && beat % 2 === 1) clap(at(beat));
    if (beat % 4 === 3) hat(at(beat + 0.5), true, 0.9);
  }
  kick(at(11.5), 0.8);
  kick(at(15), 1);
  [4, 8, 12].forEach((start, index) => pad(at(start), at(start + 4), BARS[index + 1].chord, 0.18 + index * 0.03, 900 + index * 500));

  // Arpeggio: sixteenth notes, one octave higher from bar 3, brighter every bar.
  for (let step = 16; step < 62; step += 1) {
    const beat = step * 0.25;
    if (beat >= 15.75) break;
    const chord = bar(beat);
    const pattern = [0, 2, 1, 3, 2, 3, 1, 2];
    const note = chord.chord[pattern[step % pattern.length]];
    const octave = beat >= 8 ? 2 : 1;
    arpNote(at(beat), NOTE(note) * 2 * octave, BEAT * 0.22, 700 + beat * 160, step % 2 ? 0.35 : -0.35, beat < 8 ? 0.8 : 1);
  }

  // Build: riser, reverse crash, snare roll, clapper arrival.
  const riseStart = at(10);
  const riseEnd = at(CLAP_BEAT - 0.25);
  const riser = noise(riseStart, riseEnd - riseStart + 0.1);
  const riserFilter = ctx.createBiquadFilter();
  riserFilter.type = 'bandpass';
  riserFilter.Q.value = 2.4;
  riserFilter.frequency.setValueAtTime(300, riseStart);
  riserFilter.frequency.exponentialRampToValueAtTime(9000, riseEnd);
  const riserGain = ctx.createGain();
  riserGain.gain.setValueAtTime(0.0001, riseStart);
  riserGain.gain.exponentialRampToValueAtTime(0.38, riseEnd);
  riserGain.gain.linearRampToValueAtTime(0.0001, riseEnd + 0.05);
  riser.connect(riserFilter).connect(riserGain);
  route(riserGain, dry, 0.2);
  tone('sawtooth', 110, 1760, riseStart, riseEnd - riseStart, 0.05, dry, 0.3);
  const reverseCrash = noise(at(14.5), at(1.25));
  const reverseFilter = ctx.createBiquadFilter();
  reverseFilter.type = 'highpass';
  reverseFilter.frequency.value = 2800;
  const reverseGain = ctx.createGain();
  reverseGain.gain.setValueAtTime(0.0001, at(14.5));
  reverseGain.gain.exponentialRampToValueAtTime(0.4, at(15.75));
  reverseGain.gain.linearRampToValueAtTime(0, at(15.78));
  reverseCrash.connect(reverseFilter).connect(reverseGain);
  route(reverseGain, dry, 0.15);

  [14, 14.5, 15, 15.25, 15.5, 15.625].forEach((beat, index) => snare(at(beat), 0.45 + index * 0.1));
  snare(at(15.75 - 0.0001), 1);
  whoosh(at(12), at(1.8), 250, 3200, 0.55, -0.9, 0.5);
  tone('sine', 150, 55, at(13.9), 0.16, 0.5, dry, 0.2);
  burst('bandpass', 700, 500, at(13.9), 0.07, 0.28, dry, 0.1);
  burst('highpass', 4800, 4800, at(14.5), 0.012, 0.3, dry, 0.1);

  // ---- The clap (beat 16): layered clap, sub drop, crash.
  clap(at(CLAP_BEAT), 1.5, dry);
  burst('bandpass', 900, 500, at(CLAP_BEAT), 0.05, 0.6, dry, 0.2, 0.001, 0.7);
  tone('sine', 190, 60, at(CLAP_BEAT), 0.05, 0.6, dry);
  kick(at(CLAP_BEAT), 1.3, dry);
  tone('sine', 78, 27, at(CLAP_BEAT), 1.6, 0.85, dry);
  burst('highpass', 3200, 3200, at(CLAP_BEAT), 2.0, 0.42, dry, 0.9, 0.003);

  // ---- Zoom-out (beats 16.5-19.5): big whoosh, groove returns, letters chime in.
  whoosh(at(CUT_BEAT), at(2.6), 220, 7200, 0.85, -0.8, 0.8);
  tone('sawtooth', 70, 140, at(CUT_BEAT), at(2.4), 0.05, dry, 0.3);
  for (let beat = 17; beat < FINAL_BEAT; beat += 1) {
    kick(at(beat), 1);
    bassNote(at(beat), NOTE('D2'), BEAT * 0.45);
    bassNote(at(beat + 0.5), NOTE('D2') * 2, BEAT * 0.35, 0.8);
    hat(at(beat + 0.5), false);
    if (beat % 2 === 1) clap(at(beat), 0.9);
  }
  pad(at(CLAP_BEAT), at(FINAL_BEAT), ['D3', 'F3', 'A3', 'D4', 'A4'], 0.24, 1400);
  for (let step = 68; step < 78; step += 1) {
    const beat = step * 0.25;
    arpNote(at(beat), NOTE(BARS[4].chord[[0, 2, 1, 3][step % 4]]) * 4, BEAT * 0.22, 3200, step % 2 ? 0.4 : -0.4);
  }
  const scale = ['D5', 'F5', 'G5', 'A5', 'C6', 'D6', 'F6', 'G6', 'A6', 'C7', 'D7', 'F7', 'G7', 'A7'];
  scale.forEach((note, index) => bell(at(CLAP_BEAT + 0.9 + index * 0.17), NOTE(note), 0.8, 1.3, Math.sin(index) * 0.6));

  // ---- Final hit (beat 19.5): stinger chord, sub swell, shimmer and a long tail.
  const finalT = at(FINAL_BEAT);
  clap(finalT, 0.8);
  kick(finalT, 1.1);
  tone('sine', 73.4, 36.7, finalT, 2.0, 0.7, dry);
  burst('highpass', 3500, 3500, finalT, 2.2, 0.28, dry, 0.9, 0.003);
  ['D4', 'F4', 'A4', 'C5', 'E5', 'A5'].forEach((note, index) => bell(finalT + index * 0.035, NOTE(note), 1.1, 2.4, (index - 2.5) * 0.25));
  const sparkle = [0, 7, 12, 16, 19, 24].map((n) => NOTE('D6') * Math.pow(2, n / 12));
  for (let i = 0; i < 18; i += 1) bell(finalT + 0.15 + i * 0.09, sparkle[i % sparkle.length] * (i > 11 ? 2 : 1), 0.28, 0.7, Math.sin(i * 1.7) * 0.8);

  // ---- Wind layer: noise that follows how fast the camera is actually moving.
  if (speed && speed.length) {
    const wind = noise(0, DURATION);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.Q.value = 0.9;
    const windGain = ctx.createGain();
    const times = speed.length / SPEED_RATE;
    const freq = Float32Array.from(speed, (s) => 350 + s * 3200);
    const level = Float32Array.from(speed, (s) => 0.0001 + s * 0.16);
    windFilter.frequency.setValueCurveAtTime(freq, 0, times);
    windGain.gain.setValueCurveAtTime(level, 0, times);
    wind.connect(windFilter).connect(windGain);
    route(windGain, dry, 0.25);
  }

  return ctx.startRendering();
}

/** Plays the pre-rendered score. `unlock()` must run synchronously inside a click or key handler. */
export class IntroAudio {
  private buffer: AudioBuffer | null = null;
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private muted = false;

  get ready() { return this.buffer !== null; }
  get playing() { return this.source !== null; }
  get isMuted() { return this.muted; }

  async prepare(speed?: Float32Array) {
    if (this.buffer) return true;
    try {
      this.buffer = await renderScore(speed);
    } catch {
      this.buffer = null;
    }
    return this.ready;
  }

  unlock() {
    if (!this.context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      this.context = new Ctor();
      this.gain = this.context.createGain();
      this.gain.gain.value = this.muted ? 0 : 1;
      this.gain.connect(this.context.destination);
    }
    void this.context.resume();
    return true;
  }

  /** Starts (or restarts) playback at `offset` seconds; returns how long until it is audible. */
  start(offset = 0) {
    if (!this.context || !this.gain || !this.buffer) return 0;
    this.source?.stop();
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.gain);
    const delay = 0.06;
    source.start(this.context.currentTime + delay, Math.max(0, offset));
    this.source = source;
    return delay + (this.context.outputLatency || this.context.baseLatency || 0);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.02);
  }

  suspend() { void this.context?.suspend(); }
  resume() { void this.context?.resume(); }

  stop() {
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.05);
    const source = this.source;
    const context = this.context;
    this.source = null;
    this.context = null;
    this.gain = null;
    window.setTimeout(() => { try { source?.stop(); } catch { /* already stopped */ } void context?.close(); }, 400);
  }
}
