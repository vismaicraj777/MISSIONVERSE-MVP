// Procedural Web Audio Synthesizer for rocket propulsion, countdown, RCS thrusters,
// staging pyrotechnics, warnings, Quindar telemetry tones, and optional voice callouts.
// Zero external audio assets required.

export class MissionAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private rumbleOsc: OscillatorNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private rcsFilter: BiquadFilterNode | null = null;
  private rcsGain: GainNode | null = null;
  private isMuted = false;
  private volume = 0.65;
  private speechEnabled = false;
  private started = false;

  public init(): void {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume * 0.65;
      this.masterGain.connect(this.ctx.destination);

      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.04 * white) / 1.04;
        lastOut = output[i];
        output[i] *= 3.2;
      }

      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = noiseBuffer;
      this.noiseNode.loop = true;

      this.noiseFilter = this.ctx.createBiquadFilter();
      this.noiseFilter.type = 'lowpass';
      this.noiseFilter.frequency.value = 180;
      this.noiseFilter.Q.value = 1.2;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;

      this.rumbleOsc = this.ctx.createOscillator();
      this.rumbleOsc.type = 'triangle';
      this.rumbleOsc.frequency.value = 42;
      const rumbleGain = this.ctx.createGain();
      rumbleGain.gain.value = 0.25;

      this.noiseNode.connect(this.noiseFilter);
      this.noiseFilter.connect(this.engineGain);
      this.rumbleOsc.connect(rumbleGain);
      rumbleGain.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      // Separate high-passed cold-gas RCS hiss channel
      this.rcsFilter = this.ctx.createBiquadFilter();
      this.rcsFilter.type = 'bandpass';
      this.rcsFilter.frequency.value = 2600;
      this.rcsFilter.Q.value = 0.8;
      this.rcsGain = this.ctx.createGain();
      this.rcsGain.gain.value = 0;
      this.noiseNode.connect(this.rcsFilter);
      this.rcsFilter.connect(this.rcsGain);
      this.rcsGain.connect(this.masterGain);

      this.noiseNode.start();
      this.rumbleOsc.start();
      this.started = true;
    } catch {
      // Ignore if audio context blocked
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume * 0.65, this.ctx.currentTime, 0.05);
    }
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume * 0.65, this.ctx.currentTime, 0.05);
    }
  }

  public setSpeechEnabled(enabled: boolean): void {
    this.speechEnabled = enabled;
    if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  public speakCallout(text: string): void {
    if (!this.speechEnabled || this.isMuted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.04;
      utter.pitch = 0.96;
      utter.volume = Math.min(1, this.volume);
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      window.speechSynthesis.speak(utter);
    } catch {
      // ignore unsupported browser TTS environments
    }
  }

  public updateThrust(throttle: number, atmosphericDensity: number): void {
    if (!this.ctx || !this.engineGain || !this.noiseFilter || !this.rumbleOsc) return;
    const now = this.ctx.currentTime;
    const targetGain = throttle > 0.01 ? throttle * (0.15 + 0.65 * atmosphericDensity) : 0;
    const targetFreq = 75 + atmosphericDensity * 420 + throttle * 160;
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
    this.noiseFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.rumbleOsc.frequency.setTargetAtTime(34 + throttle * 24, now, 0.08);
  }

  public updateRcsHiss(active: boolean): void {
    if (!this.ctx || !this.rcsGain) return;
    const now = this.ctx.currentTime;
    this.rcsGain.gain.setTargetAtTime(active ? 0.09 : 0, now, 0.03);
  }

  public playCountdownBeep(isZero = false): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = isZero ? 1320 : 880;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isZero ? 0.32 : 0.11));
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (isZero ? 0.35 : 0.13));
  }

  public playWarningChime(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = i === 0 ? 740 : 620;
      const start = now + i * 0.16;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.11, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.15);
    }
  }

  public playStageSeparation(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.35);

    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  public playQuindarBeep(isEnd = false): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = isEnd ? 2475 : 2524;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
    gain.gain.setValueAtTime(0.08, now + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playTouchdown(hard = false): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(hard ? 140 : 85, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + (hard ? 0.5 : 0.28));
    gain.gain.setValueAtTime(hard ? 0.6 : 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (hard ? 0.55 : 0.3));
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.58);
  }

  public playMissionComplete(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + idx * 0.11;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.42);
    });
  }

  public dispose(): void {
    try {
      this.noiseNode?.stop();
      this.rumbleOsc?.stop();
      this.ctx?.close();
    } catch {
      // ignore
    }
    this.started = false;
    this.ctx = null;
  }
}
