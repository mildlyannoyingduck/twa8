import { SoundscapePresetId } from '../types';

class AmbientSoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private stopNodes: Array<() => void> = [];
  private activePreset: SoundscapePresetId | null = null;

  public getActivePreset(): SoundscapePresetId | null {
    return this.activePreset;
  }

  public stop(): void {
    this.stopNodes.forEach((fn) => {
      try {
        fn();
      } catch {
        // Ignore cleanup errors
      }
    });
    this.stopNodes = [];
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
      } catch {
        // Ignore
      }
    }
    this.activePreset = null;
  }

  public play(preset: SoundscapePresetId): void {
    if (this.activePreset === preset) {
      this.stop();
      return;
    }
    this.stop();

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const ctx = this.ctx;
    const master = ctx.createGain();
    master.gain.value = 0.001;
    master.gain.setTargetAtTime(0.16, ctx.currentTime, 0.25);
    master.connect(ctx.destination);
    this.masterGain = master;

    if (preset === 'hum') {
      // Deep 40Hz gamma focus harmonic + soft sapphire sub drone
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 140;
      osc2.type = 'sine';
      osc2.frequency.value = 180; // 40Hz binaural beat warmth
      gain1.gain.value = 0.28;
      gain2.gain.value = 0.24;
      osc1.connect(gain1).connect(master);
      osc2.connect(gain2).connect(master);
      osc1.start();
      osc2.start();
      this.stopNodes.push(() => {
        osc1.stop();
        osc2.stop();
        osc1.disconnect();
        osc2.disconnect();
      });
    } else {
      // Procedural filtered pink/brown noise buffer for Rain / Ocean
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.04 * white) / 1.04;
        lastOut = data[i];
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      if (preset === 'rain') {
        filter.type = 'bandpass';
        filter.frequency.value = 980;
        filter.Q.value = 0.45;
      } else {
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        filter.Q.value = 0.7;
      }

      const noiseGain = ctx.createGain();
      noiseGain.gain.value = preset === 'rain' ? 0.95 : 1.1;

      source.connect(filter).connect(noiseGain).connect(master);
      source.start();
      this.stopNodes.push(() => {
        source.stop();
        source.disconnect();
        filter.disconnect();
      });
    }

    this.activePreset = preset;
  }
}

export const soundscapeEngine = new AmbientSoundscapeEngine();
