import { useCallback, useEffect, useRef, useState } from 'react';

const AudioContextClass = () => window.AudioContext || window.webkitAudioContext;

export function useRainWiperAudio({ leftSweep = 0.5, rightSweep = 0.5 }) {
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const audioRef = useRef(null);
  const motionRef = useRef({
    leftSweep,
    rightSweep,
    leftDirection: 0,
    rightDirection: 0,
    lastSwishAt: 0,
  });

  const toggleSound = useCallback(() => {
    if (audioRef.current) {
      stopAudio(audioRef);
      setIsSoundEnabled(false);
      return;
    }

    if (typeof window === 'undefined' || !AudioContextClass()) return;

    audioRef.current = startRainAmbience();
    audioRef.current.context.resume();
    setIsSoundEnabled(true);
  }, []);

  useEffect(() => () => stopAudio(audioRef), []);

  useEffect(() => {
    if (!isSoundEnabled || !audioRef.current) return;

    const now = performance.now();
    const previous = motionRef.current;
    const leftDelta = leftSweep - previous.leftSweep;
    const rightDelta = rightSweep - previous.rightSweep;
    const strongestMove = Math.max(Math.abs(leftDelta), Math.abs(rightDelta));
    const leftDirection = Math.sign(leftDelta);
    const rightDirection = Math.sign(rightDelta);
    const reversed =
      (leftDirection && previous.leftDirection && leftDirection !== previous.leftDirection) ||
      (rightDirection && previous.rightDirection && rightDirection !== previous.rightDirection);

    if (strongestMove > 0.012 && now - previous.lastSwishAt > 95) {
      playWiperSwish(audioRef.current, strongestMove, reversed);
      previous.lastSwishAt = now;
    }

    motionRef.current = {
      leftSweep,
      rightSweep,
      leftDirection: leftDirection || previous.leftDirection,
      rightDirection: rightDirection || previous.rightDirection,
      lastSwishAt: previous.lastSwishAt,
    };
  }, [isSoundEnabled, leftSweep, rightSweep]);

  return {
    isSoundEnabled,
    toggleSound,
  };
}

function startRainAmbience() {
  const Context = AudioContextClass();
  const context = new Context();
  const master = context.createGain();
  master.gain.value = 0.58;
  master.connect(context.destination);

  const rainSource = context.createBufferSource();
  rainSource.buffer = createRainNoiseBuffer(context, 2.4);
  rainSource.loop = true;

  const rainFilter = context.createBiquadFilter();
  rainFilter.type = 'lowpass';
  rainFilter.frequency.value = 2200;
  rainFilter.Q.value = 0.55;

  const rainGain = context.createGain();
  rainGain.gain.value = 0.22;

  rainSource.connect(rainFilter);
  rainFilter.connect(rainGain);
  rainGain.connect(master);
  rainSource.start();

  const padGain = context.createGain();
  padGain.gain.value = 0.018;
  padGain.connect(master);

  const padOscillators = [196, 246.94].map((frequency) => {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    oscillator.connect(padGain);
    oscillator.start();
    return oscillator;
  });

  return {
    context,
    master,
    nodes: [rainSource, ...padOscillators],
  };
}

function stopAudio(audioRef) {
  const audio = audioRef.current;
  if (!audio) return;

  audio.nodes.forEach((node) => {
    try {
      node.stop();
    } catch {
      // Already stopped.
    }
  });
  audio.context.close();
  audioRef.current = null;
}

function createRainNoiseBuffer(context, seconds) {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let filtered = 0;

  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    filtered = filtered * 0.86 + white * 0.14;
    data[index] = filtered * 0.9 + white * 0.1;
  }

  return buffer;
}

function playWiperSwish(audio, motionAmount, reversed) {
  const { context, master } = audio;
  const duration = reversed ? 0.2 : 0.16;
  const source = context.createBufferSource();
  source.buffer = createSwishBuffer(context, duration);

  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(reversed ? 520 : 680, context.currentTime);
  filter.frequency.exponentialRampToValueAtTime(reversed ? 840 : 1200, context.currentTime + duration);
  filter.Q.value = 0.9;

  const gain = context.createGain();
  const volume = Math.min(0.18, 0.045 + motionAmount * 1.8);
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start();
  source.stop(context.currentTime + duration);
}

function createSwishBuffer(context, seconds) {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < length; index += 1) {
    const t = index / Math.max(1, length - 1);
    const envelope = Math.sin(t * Math.PI);
    data[index] = (Math.random() * 2 - 1) * envelope;
  }

  return buffer;
}
