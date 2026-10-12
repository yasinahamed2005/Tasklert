/**
 * Tasklert Web Audio Alarm Synthesizer & Sound Manager
 * 
 * Generates 100% offline, zero-asset, high-fidelity alarm tones using the Web Audio API.
 * Supports looping alarm playback, previewing, volume gain control, and clean stop.
 */

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.activeNodes = [];
    this.loopInterval = null;
    this.isPlaying = false;
    this.currentSound = null;
  }

  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Sound 1: Digital Beep (Classic electronic wristwatch / digital alarm)
   */
  playDigitalPulse(ctx, masterGain, startTime) {
    const tones = [880, 880, 1760, 1760];
    const duration = 0.08;

    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(freq, startTime + i * 0.12);

      noteGain.gain.setValueAtTime(0, startTime + i * 0.12);
      noteGain.gain.linearRampToValueAtTime(0.35, startTime + i * 0.12 + 0.01);
      noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + i * 0.12 + duration);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(startTime + i * 0.12);
      osc.stop(startTime + i * 0.12 + duration + 0.02);
      this.activeNodes.push(osc);
    });
  }

  /**
   * Sound 2: Classic Alarm (Resonant twin-bell mechanical ringing)
   */
  playClassicBell(ctx, masterGain, startTime) {
    const freqs = [659, 784, 880];
    const duration = 0.45;

    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const tremolo = ctx.createOscillator();
      const tremoloGain = ctx.createGain();
      const noteGain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, startTime);

      // Rapid tremolo oscillation (simulates vibrating bell clapper)
      tremolo.type = "sine";
      tremolo.frequency.setValueAtTime(14, startTime);
      tremoloGain.gain.setValueAtTime(25, startTime);

      tremolo.connect(osc.frequency);
      tremolo.start(startTime);
      tremolo.stop(startTime + duration);

      noteGain.gain.setValueAtTime(0, startTime);
      noteGain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
      this.activeNodes.push(osc, tremolo);
    });
  }

  /**
   * Sound 3: Gentle Chime (Sweet crystal bell cascade)
   */
  playGentleChime(ctx, masterGain, startTime) {
    const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const delayStep = 0.14;

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime + idx * delayStep);

      const noteStart = startTime + idx * delayStep;
      noteGain.gain.setValueAtTime(0, noteStart);
      noteGain.gain.linearRampToValueAtTime(0.3, noteStart + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 1.2);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(noteStart);
      osc.stop(noteStart + 1.25);
      this.activeNodes.push(osc);
    });
  }

  /**
   * Sound 4: Morning Bell (Warm, resonant chime with harmonic depth)
   */
  playMorningBell(ctx, masterGain, startTime) {
    const baseFreq = 440;
    const harmonics = [
      { ratio: 1, gain: 0.35, decay: 1.6 },
      { ratio: 2.02, gain: 0.2, decay: 1.2 },
      { ratio: 3.01, gain: 0.1, decay: 0.8 },
      { ratio: 4.05, gain: 0.05, decay: 0.5 },
    ];

    harmonics.forEach(({ ratio, gain, decay }) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq * ratio, startTime);

      noteGain.gain.setValueAtTime(0, startTime);
      noteGain.gain.linearRampToValueAtTime(gain, startTime + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + decay + 0.05);
      this.activeNodes.push(osc);
    });
  }

  /**
   * Sound 5: Soft Reminder (Subtle two-note ascending notification)
   */
  playSoftReminder(ctx, masterGain, startTime) {
    const notes = [
      { freq: 587.33, start: 0, dur: 0.28 }, // D5
      { freq: 880.00, start: 0.18, dur: 0.5 }, // A5
    ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, startTime + start);

      const noteStart = startTime + start;
      noteGain.gain.setValueAtTime(0, noteStart);
      noteGain.gain.linearRampToValueAtTime(0.3, noteStart + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + dur);

      osc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(noteStart);
      osc.stop(noteStart + dur + 0.05);
      this.activeNodes.push(osc);
    });
  }

  /**
   * Render single sound iteration
   */
  triggerSoundPattern(soundName, ctx, masterGain, time) {
    switch (soundName) {
      case "classic":
        this.playClassicBell(ctx, masterGain, time);
        break;
      case "chime":
        this.playGentleChime(ctx, masterGain, time);
        break;
      case "bell":
        this.playMorningBell(ctx, masterGain, time);
        break;
      case "soft":
        this.playSoftReminder(ctx, masterGain, time);
        break;
      case "digital":
      default:
        this.playDigitalPulse(ctx, masterGain, time);
        break;
    }
  }

  /**
   * Play continuous looping alarm until explicitly stopped
   */
  playAlarm(soundName = "digital", volume = 80) {
    this.stop(); // Stop any existing playback

    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.isPlaying = true;
    this.currentSound = soundName;

    const masterGain = ctx.createGain();
    const normalizedVol = Math.max(0.01, Math.min(1, Number(volume || 80) / 100));
    masterGain.gain.setValueAtTime(normalizedVol, ctx.currentTime);
    masterGain.connect(ctx.destination);
    this.masterGain = masterGain;

    // Determine loop cadence based on sound type
    const intervals = {
      digital: 900,
      classic: 850,
      chime: 1800,
      bell: 2000,
      soft: 1200,
    };
    const repeatMs = intervals[soundName] || 1000;

    // Trigger initial sound
    this.triggerSoundPattern(soundName, ctx, masterGain, ctx.currentTime);

    // Setup rhythmic loop
    this.loopInterval = setInterval(() => {
      if (!this.isPlaying) return;
      this.triggerSoundPattern(soundName, ctx, masterGain, ctx.currentTime);
    }, repeatMs);
  }

  /**
   * Play a short single preview (2.5 seconds)
   */
  preview(soundName = "digital", volume = 80) {
    this.stop();

    const ctx = this.getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    const normalizedVol = Math.max(0.01, Math.min(1, Number(volume || 80) / 100));
    masterGain.gain.setValueAtTime(normalizedVol, ctx.currentTime);
    masterGain.connect(ctx.destination);

    this.triggerSoundPattern(soundName, ctx, masterGain, ctx.currentTime);

    // If fast pattern, do one second repeat for realistic preview
    if (["digital", "classic"].includes(soundName)) {
      setTimeout(() => {
        this.triggerSoundPattern(soundName, ctx, masterGain, ctx.currentTime);
      }, 700);
    }
  }

  /**
   * Immediately stop all active audio playback
   */
  stop() {
    this.isPlaying = false;
    this.currentSound = null;

    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }

    if (this.activeNodes.length > 0) {
      this.activeNodes.forEach((node) => {
        try {
          node.stop();
          node.disconnect();
        } catch (_) {}
      });
      this.activeNodes = [];
    }

    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch (_) {}
      this.masterGain = null;
    }
  }
}

export const soundManager = new SoundManager();
export default soundManager;
