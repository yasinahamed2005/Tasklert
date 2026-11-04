/**
 * Tasklert Web Audio Alarm Synthesizer & Sound Manager
 * 
 * Generates 100% offline, zero-asset, high-fidelity alarm tones using the Web Audio API.
 * Supports:
 * - Silent AudioContext keep-alive during active timers to prevent background tab audio suspension
 * - OS audio hardware pre-scheduling (immune to browser background tab throttling)
 * - Looping alarm playback, previewing, volume gain control, and clean instant stop
 * - Custom audio track playback (HTML5 Audio + Web Audio fallback)
 */

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.activeNodes = [];
    this.loopInterval = null;
    this.isPlaying = false;
    this.currentSound = null;
    this.customAudio = null;
    this.masterGain = null;
    this.keepAliveNode = null;
  }

  /**
   * Initializes or resumes the AudioContext from a user interaction gesture
   */
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch((err) => {
        console.warn("AudioContext resume attempted:", err);
      });
    }
    return this.audioCtx;
  }

  /**
   * Silent Keep-Alive Audio Node
   * 
   * When a timer starts, modern browsers (Chrome/Edge/Firefox) can suspend the AudioContext
   * if it remains silent for more than 30 seconds, and later refuse to resume it from a background tab.
   * By looping an inaudible buffer, the browser recognizes the audio stream as active and keeps
   * the audio hardware pipeline open and ready for immediate, loud playback when the timer completes.
   */
  startKeepAlive() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      if (this.keepAliveNode) return;

      const buffer = ctx.createBuffer(1, Math.max(1, ctx.sampleRate), ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const silentGain = ctx.createGain();
      // Near-zero gain: 100% inaudible to human ear, but keeps the OS audio thread alive
      silentGain.gain.setValueAtTime(0.00001, ctx.currentTime);

      source.connect(silentGain);
      silentGain.connect(ctx.destination);
      source.start(0);

      this.keepAliveNode = { source, silentGain };
    } catch (err) {
      console.warn("Could not start audio keep-alive:", err);
    }
  }

  /**
   * Stops the silent keepalive node
   */
  stopKeepAlive() {
    if (this.keepAliveNode) {
      try {
        this.keepAliveNode.source.stop();
        this.keepAliveNode.source.disconnect();
        this.keepAliveNode.silentGain.disconnect();
      } catch (_) {}
      this.keepAliveNode = null;
    }
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
    if (!ctx || !masterGain || !this.isPlaying) return;
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
   * Play continuous looping alarm until explicitly stopped.
   * Supports built-in synthesizer sounds OR custom user audio URLs.
   */
  playAlarm(soundName = "digital", volume = 80, customAudioUrl = null) {
    this.stop(); // Stop any existing playback

    // A. Custom User Audio Track
    if (customAudioUrl || soundName === "custom") {
      const src = customAudioUrl || this.customAudioUrl;
      if (src) {
        try {
          const audio = new Audio(src);
          audio.loop = true;
          audio.volume = Math.max(0.01, Math.min(1, Number(volume || 80) / 100));
          this.customAudio = audio;
          this.isPlaying = true;
          this.currentSound = "custom";
          
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.warn("Custom audio autoplay restricted, falling back to synthesizer alarm:", err);
              this.playSynthAlarm("chime", volume);
            });
          }
          return;
        } catch (e) {
          console.warn("Could not load custom audio:", e);
        }
      }
    }

    // B. Built-in Synthesizer
    this.playSynthAlarm(soundName, volume);
  }

  /**
   * Plays built-in alarm using Web Audio with OS clock pre-scheduling
   * Ensures alarms fire continuously even when the tab is in the background or minimized.
   */
  playSynthAlarm(soundName = "digital", volume = 80) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.isPlaying = true;
    this.currentSound = soundName;

    const masterGain = ctx.createGain();
    const normalizedVol = Math.max(0.01, Math.min(1, Number(volume || 80) / 100));
    masterGain.gain.setValueAtTime(normalizedVol, ctx.currentTime);
    masterGain.connect(ctx.destination);
    this.masterGain = masterGain;

    // Cadence intervals in seconds
    const intervals = {
      digital: 0.9,
      classic: 0.85,
      chime: 1.8,
      bell: 2.0,
      soft: 1.2,
    };
    const repeatSec = intervals[soundName] || 1.0;

    // Schedule 30 iterations ahead on Web Audio's hardware clock (ctx.currentTime + i * repeatSec)
    // Audio hardware processes this independently of JS setInterval background throttling!
    const preScheduleCount = 35;
    for (let i = 0; i < preScheduleCount; i++) {
      this.triggerSoundPattern(soundName, ctx, masterGain, ctx.currentTime + i * repeatSec);
    }

    // Background replenishment interval (every 10 seconds, schedule the next batch)
    this.loopInterval = setInterval(() => {
      if (!this.isPlaying || !this.audioCtx || !this.masterGain) return;
      const curTime = this.audioCtx.currentTime;
      for (let i = 0; i < 20; i++) {
        this.triggerSoundPattern(soundName, this.audioCtx, this.masterGain, curTime + (i + 1) * repeatSec);
      }
    }, 10000);
  }

  /**
   * Preview custom user audio
   */
  previewCustomAudio(url, volume = 80, onEnd = null) {
    this.stop();
    if (!url) return;

    try {
      const audio = new Audio(url);
      audio.volume = Math.max(0.01, Math.min(1, Number(volume || 80) / 100));
      this.customAudio = audio;
      this.isPlaying = true;
      this.currentSound = "custom_preview";

      audio.onended = () => {
        this.stop();
        if (onEnd) onEnd();
      };

      const p = audio.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.warn("Preview audio play failed:", err);
        });
      }
    } catch (e) {
      console.warn("Could not preview custom audio:", e);
    }
  }

  previewSound(soundName = "digital", volume = 80) {
    this.preview(soundName, volume);
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

    if (["digital", "classic"].includes(soundName)) {
      setTimeout(() => {
        this.triggerSoundPattern(soundName, ctx, masterGain, ctx.currentTime);
      }, 700);
    }
  }

  /**
   * Immediately stop all active audio playback (synth & custom files)
   * Instantly mutes all scheduled future Web Audio hardware nodes.
   */
  stop() {
    this.isPlaying = false;
    this.currentSound = null;

    if (this.masterGain && this.audioCtx) {
      try {
        // Cancel all scheduled future audio bursts and mute instantly
        this.masterGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
        this.masterGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        this.masterGain.disconnect();
      } catch (_) {}
      this.masterGain = null;
    }

    if (this.customAudio) {
      try {
        this.customAudio.pause();
        this.customAudio.currentTime = 0;
      } catch (_) {}
      this.customAudio = null;
    }

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
  }
}

export const soundManager = new SoundManager();
export default soundManager;
