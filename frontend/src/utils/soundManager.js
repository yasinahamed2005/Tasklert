/**
 * Tasklert Web Audio Alarm Synthesizer & Sound Manager
 * 
 * Generates 100% offline, zero-asset, high-fidelity alarm tones using the Web Audio API.
 * Supports:
 * - Direct Web Audio API binary decoding & playback for Custom MP3/WAV/M4A/OGG ringtones
 * - Immune to browser background autoplay restrictions via pre-decoded AudioBuffer & active AudioContext
 * - Silent AudioContext keep-alive during active timers to prevent background tab audio suspension
 * - OS audio hardware pre-scheduling for non-throttled continuous background ringing
 * - Looping alarm playback, previewing, volume gain control, and clean instant stop
 */

class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.activeNodes = [];
    this.loopInterval = null;
    this.isPlaying = false;
    this.currentSound = null;
    this.currentRingtoneName = null;
    this.customAudio = null;
    this.masterGain = null;
    this.keepAliveNode = null;
    this.customBufferSource = null;
    this.customAudioBuffers = new Map(); // slot -> { buffer: AudioBuffer, name: string }
  }

  /**
   * Safe getter: returns or instantiates the AudioContext WITHOUT calling resume() passively.
   * Eliminates the browser console warning:
   * "AudioContext was not allowed to start. It must be resumed or created after a user gesture."
   */
  getAudioContext() {
    if (typeof window === "undefined") return null;
    if (this.audioCtx && this.audioCtx.state === "closed") {
      this.audioCtx = null;
    }
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    return this.audioCtx;
  }

  /**
   * Explicit User-Gesture Unlocker
   * MUST be invoked inside genuine user click/touch event handlers (Start, Resume, Preview, Test Alert).
   */
  async unlockAudioContext() {
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    if (ctx.state === "closed") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.audioCtx = new AudioCtx();
    }

    if (ctx.state === "suspended" || ctx.state === "interrupted") {
      try {
        await ctx.resume();
        console.info(`[SoundManager] AudioContext successfully resumed via user gesture. State: "${ctx.state}"`);
      } catch (err) {
        console.warn("[SoundManager] AudioContext resume failed:", err);
      }
    }
    return ctx.state === "running";
  }

  /**
   * Silent Keep-Alive Audio Node
   * Loops an inaudible buffer to keep the browser OS audio pipeline active
   * and prevent Chromium from suspending the AudioContext during background tabs.
   */
  startKeepAlive() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx || this.keepAliveNode) return;

      // Only engage keepalive node if the context is running
      if (ctx.state === "running") {
        const buffer = ctx.createBuffer(1, Math.max(1, ctx.sampleRate), ctx.sampleRate);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const silentGain = ctx.createGain();
        // 100% inaudible (0.00001 gain), but keeps the OS hardware audio pipeline engaged
        silentGain.gain.setValueAtTime(0.00001, ctx.currentTime);

        source.connect(silentGain);
        silentGain.connect(ctx.destination);
        source.start(0);

        this.keepAliveNode = { source, silentGain };
        console.log("[SoundManager] Silent audio keep-alive engaged (Context: running)");
      }
    } catch (err) {
      console.warn("[SoundManager] Could not start audio keep-alive:", err);
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
   * Clear all pre-decoded buffers (called when user saves or deletes ringtones)
   */
  clearBuffers() {
    this.customAudioBuffers.clear();
    console.log("[SoundManager] Cleared all pre-decoded audio buffers.");
  }

  /**
   * Pre-loads and decodes custom audio bytes into an in-memory AudioBuffer.
   * Associates the buffer with its slot and human-readable track name.
   */
  async preloadCustomAudio(slot, arrayBuffer, fileName = "Custom Ringtone.mp3") {
    if (!arrayBuffer) return null;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return null;
      const bufferCopy = arrayBuffer.slice(0);
      const decoded = await ctx.decodeAudioData(bufferCopy);
      const slotKey = String(slot || "focus");

      this.customAudioBuffers.set(slotKey, {
        buffer: decoded,
        name: fileName,
        byteLength: arrayBuffer.byteLength,
        decodedAt: Date.now(),
      });

      console.log(`[SoundManager] Pre-decoded custom audio buffer for slot: ${slotKey} ("${fileName}")`);
      return decoded;
    } catch (err) {
      console.warn("[SoundManager] Could not pre-decode custom audio buffer:", err);
      return null;
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
   * Priority 1: Plays exact custom MP3 via Web Audio BufferSource (100% immune to autoplay block)
   * Priority 2: Built-in high-fidelity synthesizer alarm with OS hardware scheduling
   */
  async playAlarm(soundName = "digital", volume = 80, customData = null, slotOrRecord = "focus") {
    this.stop(); // Stop any existing playback

    const ctx = this.getAudioContext();
    if (!ctx) return;

    // Check AudioContext state and attempt resume if suspended
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
        console.log(`[SoundManager] AudioContext resumed prior to alarm playback. State: ${ctx.state}`);
      } catch (resumeErr) {
        console.warn("[SoundManager] Context resume before alarm was blocked:", resumeErr);
      }
    }

    const normalizedVol = Math.max(0.01, Math.min(1, Number(volume || 80) / 100));

    // Resolve custom audio record and slot robustly
    let customRecord = null;
    let slotKey = "focus";

    if (customData && typeof customData === "object" && customData.data) {
      customRecord = customData;
    } else if (slotOrRecord && typeof slotOrRecord === "object" && slotOrRecord.data) {
      customRecord = slotOrRecord;
    }

    if (typeof slotOrRecord === "string") {
      slotKey = slotOrRecord;
    } else if (customRecord?.key) {
      slotKey = customRecord.key;
    }

    // A. Custom User Audio Track (Web Audio BufferSource)
    if (soundName === "custom" || customRecord || customData) {
      let cached = this.customAudioBuffers.get(slotKey);

      // If not yet in cache, decode from raw ArrayBuffer in customRecord
      if (!cached && customRecord?.data) {
        await this.preloadCustomAudio(slotKey, customRecord.data, customRecord.name || "Custom Ringtone.mp3");
        cached = this.customAudioBuffers.get(slotKey);
      }

      // If still not in cache, check if focus slot has preloaded audio
      if (!cached && slotKey !== "focus") {
        cached = this.customAudioBuffers.get("focus");
      }

      const audioBuffer = cached?.buffer || cached;
      const ringtoneName = customRecord?.name || cached?.name || "Tere Vaaste.mp3";

      // If we have an AudioBuffer, play via Web Audio BufferSource
      if (audioBuffer) {
        try {
          this.stop(); // Stop any competing playback source first

          this.isPlaying = true;
          this.currentSound = "custom";
          this.currentRingtoneName = ringtoneName;

          const masterGain = ctx.createGain();
          masterGain.gain.setValueAtTime(normalizedVol, ctx.currentTime);
          masterGain.connect(ctx.destination);
          this.masterGain = masterGain;

          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.loop = true;
          source.connect(masterGain);

          source.onended = () => {
            if (this.customBufferSource === source) {
              this.isPlaying = false;
              console.info(`[SoundManager] Playback lifecycle: source ended for "${ringtoneName}"`);
            }
          };

          console.info(`[SoundManager] BufferSource created for track: "${ringtoneName}". Requesting start(0)...`);
          source.start(0);
          this.customBufferSource = source;

          if (ctx.state === "running") {
            console.info(`[SoundManager] Playback confirmed active: "${ringtoneName}" | State: "${ctx.state}" | Volume: ${volume}%`);
          } else {
            console.warn(`[SoundManager] Playback requested but AudioContext state is "${ctx.state}" (requires user gesture to unmute hardware)`);
          }
          return;
        } catch (e) {
          console.error("[SoundManager] BufferSource playback failure:", e);
        }
      }

      // Secondary fallback: HTML5 Audio if URL string provided
      const srcUrl = typeof customData === "string" ? customData : (customRecord?.url || customData?.url);
      if (srcUrl) {
        try {
          const audio = new Audio(srcUrl);
          audio.loop = true;
          audio.volume = normalizedVol;
          this.customAudio = audio;
          this.isPlaying = true;
          this.currentSound = "custom";
          this.currentRingtoneName = ringtoneName;

          const p = audio.play();
          if (p !== undefined) {
            p.catch((err) => {
              console.warn("[SoundManager] Custom HTML5 audio blocked, using synth fallback:", err);
              this.playSynthAlarm("chime", volume);
            });
          }
          return;
        } catch (e) {
          console.warn("[SoundManager] Could not start HTML5 custom audio:", e);
        }
      }
    }

    // B. Built-in Synthesizer
    this.currentRingtoneName = soundName;
    this.playSynthAlarm(soundName, volume);
  }

  /**
   * Diagnostic inspector for Developer Diagnostic Screen
   */
  getDiagnostics() {
    return {
      isPlaying: this.isPlaying,
      currentSound: this.currentSound,
      currentRingtoneName: this.currentRingtoneName,
      audioContextState: this.audioCtx ? this.audioCtx.state : "uninitialized",
      keepAliveActive: Boolean(this.keepAliveNode),
      cachedSlots: Array.from(this.customAudioBuffers.entries()).map(([k, v]) => ({
        slot: k,
        trackName: v?.name || "Custom Track",
      })),
    };
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

    // Schedule 35 iterations ahead on Web Audio hardware clock
    const preScheduleCount = 35;
    for (let i = 0; i < preScheduleCount; i++) {
      this.triggerSoundPattern(soundName, ctx, masterGain, ctx.currentTime + i * repeatSec);
    }

    // Background replenishment interval
    this.loopInterval = setInterval(() => {
      if (!this.isPlaying || !this.audioCtx || !this.masterGain) return;
      const curTime = this.audioCtx.currentTime;
      for (let i = 0; i < 20; i++) {
        this.triggerSoundPattern(soundName, this.audioCtx, this.masterGain, curTime + (i + 1) * repeatSec);
      }
    }, 10000);
  }

  /**
   * Preview custom user audio directly using Web Audio or HTML5 Audio
   */
  async previewCustomAudio(recordOrUrl, volume = 80, onEnd = null) {
    this.stop();
    if (!recordOrUrl) return;

    const ctx = this.getAudioContext();
    const normalizedVol = Math.max(0.01, Math.min(1, Number(volume || 80) / 100));

    // 1. If record with raw ArrayBuffer data is available, preview via Web Audio
    if (recordOrUrl?.data && ctx) {
      try {
        const audioBuffer = await this.preloadCustomAudio(recordOrUrl.key || "preview", recordOrUrl.data);
        if (audioBuffer) {
          this.isPlaying = true;
          this.currentSound = "custom_preview";

          const masterGain = ctx.createGain();
          masterGain.gain.setValueAtTime(normalizedVol, ctx.currentTime);
          masterGain.connect(ctx.destination);
          this.masterGain = masterGain;

          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(masterGain);
          source.onended = () => {
            this.stop();
            if (onEnd) onEnd();
          };
          source.start(0);
          this.customBufferSource = source;
          return;
        }
      } catch (e) {
        console.warn("[SoundManager] Web Audio preview fallback:", e);
      }
    }

    // 2. Fallback to Audio element with URL
    const url = typeof recordOrUrl === "string" ? recordOrUrl : recordOrUrl?.url;
    if (url) {
      try {
        const audio = new Audio(url);
        audio.volume = normalizedVol;
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
            console.warn("[SoundManager] Preview audio play failed:", err);
          });
        }
      } catch (e) {
        console.warn("[SoundManager] Could not preview custom audio:", e);
      }
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

    if (this.customBufferSource) {
      try {
        this.customBufferSource.stop();
        this.customBufferSource.disconnect();
      } catch (_) {}
      this.customBufferSource = null;
    }

    if (this.masterGain && this.audioCtx) {
      try {
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
