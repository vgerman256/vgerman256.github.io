// Sounds synthesized with Web Audio (no audio files to load or license), and a short confetti burst.

export type SoundKind = 'move' | 'capture' | 'check' | 'win' | 'lose' | 'draw';

let audio: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let enabled = false;

// The AudioContext is created by the first sound played, normally inside a click or move handler,
// because browsers only let audio start from a user gesture.
export function setSoundEnabled(on: boolean) {
    enabled = on;
}

function context(): AudioContext {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    return audio;
}

export function playSound(kind: SoundKind) {
    if (!enabled) return;
    const ac = context();
    const t = ac.currentTime + 0.01;
    switch (kind) {
        case 'move':
            knock(ac, t, 0.5, 1400);
            break;
        case 'capture':
            knock(ac, t, 0.8, 800);
            knock(ac, t + 0.07, 0.45, 1800);
            break;
        case 'check':
            knock(ac, t, 0.5, 1400);
            tone(ac, t + 0.05, 880, 0.12);
            tone(ac, t + 0.18, 660, 0.2);
            break;
        case 'win':
            [523, 659, 784, 1047].forEach((f, i) => tone(ac, t + i * 0.11, f, i === 3 ? 0.5 : 0.18));
            break;
        case 'lose':
            [392, 330, 262].forEach((f, i) => tone(ac, t + i * 0.16, f, i === 2 ? 0.5 : 0.2));
            break;
        case 'draw':
            [523, 494].forEach((f, i) => tone(ac, t + i * 0.18, f, 0.3));
            break;
    }
}

// A wooden piece set down on a board: a filtered noise click over a quick low thump.
function knock(ac: AudioContext, t: number, gain: number, freq: number) {
    if (!noise) {
        noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.08), ac.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 4;
    }
    const src = ac.createBufferSource();
    src.buffer = noise;
    const filter = new BiquadFilterNode(ac, { type: 'bandpass', frequency: freq, Q: 1.2 });
    src.connect(filter).connect(new GainNode(ac, { gain })).connect(ac.destination);
    src.start(t);

    const osc = new OscillatorNode(ac, { frequency: 180 });
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    const env = new GainNode(ac, { gain: gain * 0.6 });
    env.gain.setValueAtTime(gain * 0.6, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(env).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.12);
}

function tone(ac: AudioContext, t: number, freq: number, duration: number) {
    const osc = new OscillatorNode(ac, { type: 'triangle', frequency: freq });
    const env = new GainNode(ac, { gain: 0 });
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.22, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(env).connect(ac.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
}

const confettiColors = ['#D85A30', '#F2B134', '#4CAF7A', '#3E8ED0', '#B565D8', '#F7F3E8'];

/** Confetti falling over everything, including an open modal dialog (it is shown as a popover). */
export function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const layer = document.createElement('div');
    layer.className = 'confetti';
    layer.setAttribute('aria-hidden', 'true');
    layer.popover = 'manual';
    for (let i = 0; i < 90; i++) {
        const bit = document.createElement('span');
        bit.style.setProperty('--x', `${Math.random() * 100}vw`);
        bit.style.setProperty('--drift', `${(Math.random() - 0.5) * 40}vw`);
        bit.style.setProperty('--rot', `${360 + Math.random() * 900}deg`);
        bit.style.setProperty('--w', `${6 + Math.random() * 6}px`);
        bit.style.setProperty('--delay', `${Math.random() * 0.7}s`);
        bit.style.setProperty('--dur', `${2.4 + Math.random() * 1.6}s`);
        bit.style.setProperty('--c', confettiColors[i % confettiColors.length]);
        layer.append(bit);
    }
    document.querySelector('.chess-app')!.append(layer);
    layer.showPopover?.();
    setTimeout(() => layer.remove(), 5000);
}
