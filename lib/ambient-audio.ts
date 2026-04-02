/**
 * Ambient Audio Engine — Web Audio API synthesized sounds
 * No external audio files needed. All sounds generated in-browser.
 *
 * Modes: night (crickets), moonlight (deep hum), rain (pink noise),
 *        snow (wind), sunny (silence), day (silence)
 */

let audioCtx: AudioContext | null = null;
let activeNodes: AudioBufferSourceNode[] = [];
let activeGains: GainNode[] = [];
let enabled = true;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

export function stopAllAudio() {
  activeNodes.forEach(n => { try { n.stop(); } catch {} });
  activeNodes = [];
  activeGains = [];
}

export function setAudioEnabled(v: boolean) { enabled = v; if (!v) stopAllAudio(); }
export function isAudioEnabled() { return enabled; }

export function playAmbientForMode(mode: string) {
  stopAllAudio();
  if (!enabled) return;

  switch (mode) {
    case 'night': playNightCrickets(); break;
    case 'moonlight': playMoonlightHum(); break;
    case 'rainy': playRainSound(); break;
    case 'snowy': playSnowWind(); break;
    // day + sunny = silence
  }
}

function playNightCrickets() {
  const ctx = getCtx();
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.015;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 4200;
  bp.Q.value = 18;
  const gain = ctx.createGain();
  gain.gain.value = 0.25;
  src.connect(bp).connect(gain).connect(ctx.destination);
  src.start();
  activeNodes.push(src);
  activeGains.push(gain);
}

function playMoonlightHum() {
  const ctx = getCtx();
  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let smooth = 0;
  for (let i = 0; i < len; i++) {
    const white = (Math.random() * 2 - 1) * 0.008;
    smooth = smooth * 0.995 + white * 0.005;
    data[i] = smooth + Math.sin(i / ctx.sampleRate * 2 * Math.PI * 60) * 0.003;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 200;
  const gain = ctx.createGain();
  gain.gain.value = 0.2;
  src.connect(lp).connect(gain).connect(ctx.destination);
  src.start();
  activeNodes.push(src);
  activeGains.push(gain);
}

function playRainSound() {
  const ctx = getCtx();
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  // Pink noise generation
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886*b0 + w*0.0555179;
      b1 = 0.99332*b1 + w*0.0750759;
      b2 = 0.96900*b2 + w*0.1538520;
      b3 = 0.86650*b3 + w*0.3104856;
      b4 = 0.55000*b4 + w*0.5329522;
      b5 = -0.7616*b5 - w*0.0168980;
      d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.012;
      b6 = w * 0.115926;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 800;
  bp.Q.value = 0.5;
  const gain = ctx.createGain();
  gain.gain.value = 0.35;
  src.connect(bp).connect(gain).connect(ctx.destination);
  src.start();
  activeNodes.push(src);
  activeGains.push(gain);

  // Rain drops — sparse high-freq clicks
  const dropLen = ctx.sampleRate * 3;
  const dropBuf = ctx.createBuffer(1, dropLen, ctx.sampleRate);
  const dropData = dropBuf.getChannelData(0);
  for (let i = 0; i < dropLen; i++) {
    dropData[i] = Math.random() < 0.001 ? (Math.random() * 2 - 1) * 0.15 : 0;
  }
  const dropSrc = ctx.createBufferSource();
  dropSrc.buffer = dropBuf;
  dropSrc.loop = true;
  const dropHp = ctx.createBiquadFilter();
  dropHp.type = 'highpass';
  dropHp.frequency.value = 2000;
  const dropGain = ctx.createGain();
  dropGain.gain.value = 0.2;
  dropSrc.connect(dropHp).connect(dropGain).connect(ctx.destination);
  dropSrc.start();
  activeNodes.push(dropSrc);
  activeGains.push(dropGain);
}

function playSnowWind() {
  const ctx = getCtx();
  const len = Math.ceil(ctx.sampleRate * 4.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let smooth = 0;
  for (let i = 0; i < len; i++) {
    const white = (Math.random() * 2 - 1) * 0.025;
    smooth = smooth * 0.985 + white * 0.16;
    data[i] = smooth;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 120;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200;
  const gain = ctx.createGain();
  gain.gain.value = 0.2;
  src.connect(hp).connect(lp).connect(gain).connect(ctx.destination);
  src.start();
  activeNodes.push(src);
  activeGains.push(gain);
}
