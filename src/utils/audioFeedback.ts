/**
 * Low-latency audio synthesizer and haptic feedback
 * Uses Web Audio API without any external asset dependencies
 */

class AudioFeedbackManager {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  /**
   * Authentic DSLR Mechanical Camera Shutter Click ("تشك 📸")
   * High-Loudness, punchy audio with zero latency and hardware compression
   */
  public playCameraShutter() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const t = ctx.currentTime;

      // Dynamics Compressor + Master Gain for maximum perceived loudness on phone speakers without clipping
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-16, t);
      compressor.knee.setValueAtTime(8, t);
      compressor.ratio.setValueAtTime(12, t);
      compressor.attack.setValueAtTime(0.001, t);
      compressor.release.setValueAtTime(0.04, t);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(1.35, t); // High volume boost

      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);

      // 1. First click: Shutter curtain opens (punchy mechanical snap at t = 0)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(2200, t);
      osc1.frequency.exponentialRampToValueAtTime(380, t + 0.025);
      gain1.gain.setValueAtTime(1.0, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.028);
      osc1.connect(gain1);
      gain1.connect(compressor);
      osc1.start(t);
      osc1.stop(t + 0.03);

      // White noise transient for realistic mechanical shutter body texture
      const bufferSize = Math.floor(ctx.sampleRate * 0.035);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(2400, t);
      noiseFilter.Q.setValueAtTime(2.5, t);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.9, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(compressor);
      whiteNoise.start(t);

      // 2. Second click: Shutter curtain closes (snappy metallic snap at t + 38ms)
      const t2 = t + 0.038;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1600, t2);
      osc2.frequency.exponentialRampToValueAtTime(300, t2 + 0.03);
      gain2.gain.setValueAtTime(1.0, t2);
      gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.035);
      osc2.connect(gain2);
      gain2.connect(compressor);
      osc2.start(t2);
      osc2.stop(t2 + 0.04);
    } catch {
      // AudioContext might be blocked until gesture
    }

    // Double crisp mechanical haptic tap
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([45, 25, 60]);
      } catch {
        // Ignored
      }
    }
  }

  /**
   * Backward-compatible capture audio trigger
   */
  public playCaptureBeep() {
    this.playCameraShutter();
  }

  /**
   * Subtle tick for countdown (600Hz, 35ms)
   */
  public playCountdownTick() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, ctx.currentTime);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.045);
    } catch {
      // Ignored
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(25);
      } catch {
        // Ignored
      }
    }
  }

  /**
   * Warning buzz if hand is in frame or motion detected
   */
  public playMotionWarning() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Ignored
    }
  }
}

export const audioFeedback = new AudioFeedbackManager();
