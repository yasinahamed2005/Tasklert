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
    this.activeBufferSources = new Set();
    this.activeAudioElements = new Set();
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
   * Unlocks both Web Audio and HTML5 Audio on mobile browsers (Android & iOS).
   */
  async unlockAudioContext() {
    const ctx = this.getAudioContext();

    if (ctx) {
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
    }

    // Prime HTML5 Audio element permissions on mobile
    if (typeof window !== "undefined") {
      try {
        const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
        const p = silentAudio.play();
        if (p !== undefined) {
          p.then(() => silentAudio.pause()).catch(() => {});
        }
      } catch (_) {}
    }

    return ctx ? ctx.state === "running" : true;
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
   * Priority 1: Plays exact custom MP3 via HTML5 Audio / Web Audio BufferSource (100% immune to mobile latency & memory limits)
   * Priority 2: Built-in high-fidelity synthesizer alarm with OS hardware scheduling
   */
  async playAlarm(soundName = "digital", volume = 80, customData = null, slotOrRecord = "focus") {
    this.stop(); // Stop any existing playback

    const ctx = this.getAudioContext();
    if (ctx && ctx.state === "suspended") {
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

    if (customData && typeof customData === "object" && (customData.data || customData.url || customData.blob)) {
      customRecord = customData;
    } else if (slotOrRecord && typeof slotOrRecord === "object" && (slotOrRecord.data || slotOrRecord.url || slotOrRecord.blob)) {
      customRecord = slotOrRecord;
    }

    if (typeof slotOrRecord === "string") {
      slotKey = slotOrRecord;
    } else if (customRecord?.key) {
      slotKey = customRecord.key;
    }

    // A. Custom User Audio Track
    if (soundName === "custom" || customRecord || customData) {
      const ringtoneName = customRecord?.name || "Custom Ringtone.mp3";

      // 1. Resolve direct playable URL (blob: or http:)
      let playUrl = null;
      if (typeof customData === "string" && customData.length > 0) {
        playUrl = customData;
      } else if (customRecord?.url) {
        playUrl = customRecord.url;
      } else if (customRecord?.blob) {
        try {
          playUrl = URL.createObjectURL(customRecord.blob);
        } catch (_) {}
      } else if (customRecord?.data) {
        try {
          const blob = customRecord.data instanceof Blob
            ? customRecord.data
            : new Blob([customRecord.data], { type: customRecord.type || "audio/mpeg" });
          playUrl = URL.createObjectURL(blob);
        } catch (_) {}
      }

      // Fast-path for mobile & desktop: Stream custom MP3 via HTML5 Audio element
      if (playUrl) {
        try {
          const audio = new Audio(playUrl);
          audio.loop = true;
          audio.volume = normalizedVol;
          this.customAudio = audio;
          this.activeAudioElements.add(audio);
          this.isPlaying = true;
          this.currentSound = "custom";
          this.currentRingtoneName = ringtoneName;

          audio.onended = () => {
            this.activeAudioElements.delete(audio);
          };

          const p = audio.play();
          if (p !== undefined) {
            p.then(() => {
              console.info(`[SoundManager] Custom audio active via HTML5 streaming: "${ringtoneName}" | Volume: ${volume}%`);
            }).catch(async (playErr) => {
              console.warn("[SoundManager] HTML5 play failed or blocked, trying Web Audio BufferSource fallback:", playErr);
              await this.playCustomBufferSource(customRecord, slotKey, normalizedVol, ringtoneName, volume);
            });
          }
          return;
        } catch (e) {
          console.warn("[SoundManager] Could not start HTML5 custom audio:", e);
        }
      }

      // Fallback: Web Audio BufferSource
      if (ctx) {
        const played = await this.playCustomBufferSource(customRecord, slotKey, normalizedVol, ringtoneName, volume);
        if (played) return;
      }
    }

    // B. Built-in Synthesizer
    this.currentRingtoneName = soundName;
    this.playSynthAlarm(soundName, volume);
  }

  /**
   * Helper to play custom audio via Web Audio BufferSource
   */
  async playCustomBufferSource(customRecord, slotKey, normalizedVol, ringtoneName, volume, onEnd = null) {
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    try {
      let cached = this.customAudioBuffers.get(slotKey);

      // If not in cache, decode from raw data
      if (!cached && customRecord?.data) {
        await this.preloadCustomAudio(slotKey, customRecord.data, ringtoneName);
        cached = this.customAudioBuffers.get(slotKey);
      }

      if (!cached && slotKey !== "focus") {
        cached = this.customAudioBuffers.get("focus");
      }

      const audioBuffer = cached?.buffer || cached;
      if (!audioBuffer) return false;

      this.stop(); // Stop any other nodes

      this.isPlaying = true;
      this.currentSound = "custom";
      this.currentRingtoneName = ringtoneName;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(normalizedVol, ctx.currentTime);
      masterGain.connect(ctx.destination);
      this.masterGain = masterGain;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = !onEnd; // Loop if alarm, single play if preview
      source.connect(masterGain);

      this.activeBufferSources.add(source);
      source.onended = () => {
        this.activeBufferSources.delete(source);
        if (this.customBufferSource === source) {
          this.isPlaying = false;
          console.info(`[SoundManager] BufferSource ended for "${ringtoneName}"`);
        }
        if (onEnd) onEnd();
      };

      source.start(0);
      this.customBufferSource = source;
      console.info(`[SoundManager] BufferSource playback confirmed active: "${ringtoneName}" | Volume: ${volume}%`);
      return true;
    } catch (err) {
      console.error("[SoundManager] playCustomBufferSource failure:", err);
      return false;
    }
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
   * Preview custom user audio directly using HTML5 Audio (instant playback on mobile)
   * with fallback to Web Audio BufferSource.
   */
  async previewCustomAudio(recordOrUrl, volume = 80, onEnd = null) {
    this.stop();
    if (!recordOrUrl) return;

    const normalizedVol = Math.max(0.01, Math.min(1, Number(volume || 80) / 100));

    // Resolve direct playable URL (blob: or http:)
    let playUrl = null;
    if (typeof recordOrUrl === "string") {
      playUrl = recordOrUrl;
    } else if (recordOrUrl?.url) {
      playUrl = recordOrUrl.url;
    } else if (recordOrUrl?.blob) {
      try {
        playUrl = URL.createObjectURL(recordOrUrl.blob);
      } catch (_) {}
    } else if (recordOrUrl?.data) {
      try {
        const blob = recordOrUrl.data instanceof Blob
          ? recordOrUrl.data
          : new Blob([recordOrUrl.data], { type: recordOrUrl.type || "audio/mpeg" });
        playUrl = URL.createObjectURL(blob);
      } catch (_) {}
    }

    // Fast-path for mobile: HTML5 Audio streams instantly within user tap gesture window
    if (playUrl) {
      try {
        const audio = new Audio(playUrl);
        audio.volume = normalizedVol;
        this.customAudio = audio;
        this.activeAudioElements.add(audio);
        this.isPlaying = true;
        this.currentSound = "custom_preview";
        this.currentRingtoneName = recordOrUrl?.name || "Custom Track";

        audio.onended = () => {
          this.activeAudioElements.delete(audio);
          this.stop();
          if (onEnd) onEnd();
        };

        const p = audio.play();
        if (p !== undefined) {
          p.then(() => {
            console.info(`[SoundManager] Previewing custom audio via HTML5: "${this.currentRingtoneName}"`);
          }).catch(async (err) => {
            console.warn("[SoundManager] HTML5 preview blocked, trying Web Audio fallback:", err);
            await this.playCustomBufferSource(recordOrUrl, recordOrUrl?.key || "preview", normalizedVol, this.currentRingtoneName, volume, onEnd);
          });
        }
        return;
      } catch (e) {
        console.warn("[SoundManager] Could not preview custom audio via HTML5:", e);
      }
    }

    // Secondary fallback: Web Audio BufferSource
    await this.playCustomBufferSource(recordOrUrl, recordOrUrl?.key || "preview", normalizedVol, recordOrUrl?.name || "Custom Track", volume, onEnd);
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

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    this.isPlaying = true;
    this.currentSound = soundName;

    const masterGain = ctx.createGain();
    const normalizedVol = Math.max(0.01, Math.min(1, Number(volume || 80) / 100));
    masterGain.gain.setValueAtTime(normalizedVol, ctx.currentTime);
    masterGain.connect(ctx.destination);
    this.masterGain = masterGain;

    this.triggerSoundPattern(soundName, ctx, masterGain, ctx.currentTime);

    if (["digital", "classic"].includes(soundName)) {
      setTimeout(() => {
        if (this.isPlaying && this.masterGain && this.audioCtx) {
          this.triggerSoundPattern(soundName, this.audioCtx, this.masterGain, this.audioCtx.currentTime);
        }
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

    // 1. Stop all registered AudioBufferSource nodes
    if (this.activeBufferSources && this.activeBufferSources.size > 0) {
      this.activeBufferSources.forEach((src) => {
        try {
          src.stop(0);
          src.disconnect();
        } catch (_) {}
      });
      this.activeBufferSources.clear();
    }

    if (this.customBufferSource) {
      try {
        this.customBufferSource.stop(0);
        this.customBufferSource.disconnect();
      } catch (_) {}
      this.customBufferSource = null;
    }

    // 2. Cancel and mute master gain immediately
    if (this.masterGain && this.audioCtx) {
      try {
        this.masterGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
        this.masterGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        this.masterGain.disconnect();
      } catch (_) {}
      this.masterGain = null;
    }

    // 3. Stop and mute all HTML5 audio elements
    if (this.activeAudioElements && this.activeAudioElements.size > 0) {
      this.activeAudioElements.forEach((aud) => {
        try {
          aud.pause();
          aud.currentTime = 0;
          aud.src = "";
        } catch (_) {}
      });
      this.activeAudioElements.clear();
    }

    if (this.customAudio) {
      try {
        this.customAudio.pause();
        this.customAudio.currentTime = 0;
        this.customAudio.src = "";
      } catch (_) {}
      this.customAudio = null;
    }

    // 4. Cancel background interval replenishment
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }

    // 5. Stop all synth oscillators
    if (this.activeNodes.length > 0) {
      this.activeNodes.forEach((node) => {
        try {
          node.stop(0);
          node.disconnect();
        } catch (_) {}
      });
      this.activeNodes = [];
    }

    // NOTE: AudioContext is NOT suspended here to prevent freezing the hardware audio clock
    // on mobile browsers (Android Chrome & iOS Safari). Muting the gain and stopping sources
    // provides 100% immediate silence while keeping the context eligible for background alarms.

    console.info("[SoundManager] All audio sources completely stopped and muted.");
  }
}

export const soundManager = new SoundManager();

if (typeof window !== "undefined") {
  window.tasklertStopAllAudio = () => soundManager.stop();
}

export default soundManager;
