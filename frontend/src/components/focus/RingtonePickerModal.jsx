import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Music,
  Upload,
  Play,
  Square,
  Volume2,
  Check,
  RotateCcw,
  Trash2,
  FileAudio,
  CheckCheck,
  Sparkles,
} from "lucide-react";
import { soundManager } from "../../utils/soundManager";
import { customRingtoneStorage } from "../../utils/customRingtoneStorage";
import { centralAlarmEngine } from "../../utils/centralAlarmEngine";
import { toast } from "react-toastify";

const BUILT_IN_SOUNDS = [
  { id: "chime", name: "Gentle Chime", desc: "Sweet crystal cascade chime", icon: "✨" },
  { id: "classic", name: "Classic Twin Bell", desc: "Resonant mechanical alarm bell", icon: "🔔" },
  { id: "digital", name: "Digital Pulse", desc: "Crisp electronic timer beep", icon: "⏰" },
  { id: "bell", name: "Zen Singing Bowl", desc: "Deep peaceful brass gong resonance", icon: "🧘" },
  { id: "soft", name: "Warm Marimba", desc: "Subtle organic acoustic tones", icon: "🎵" },
];

export const RingtonePickerModal = ({
  isOpen = false,
  onClose,
  targetSlot = "focus",
  currentSound = "chime",
  currentVolume = 80,
  onSave,
}) => {
  const [selectedSound, setSelectedSound] = useState(currentSound);
  const [volume, setVolume] = useState(currentVolume);
  const [isPlaying, setIsPlaying] = useState(false);
  const [customAudioRecord, setCustomAudioRecord] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      const globalInfo = centralAlarmEngine.getGlobalRingtone();
      setSelectedSound(globalInfo.id || currentSound || "chime");
      setVolume(centralAlarmEngine.getGlobalVolume() || currentVolume || 80);
      loadGlobalData();
    } else {
      soundManager.stop();
      setIsPlaying(false);
    }
  }, [isOpen, currentSound, currentVolume]);

  const loadGlobalData = async () => {
    try {
      const record = await customRingtoneStorage.getRingtone("global_ringtone");
      if (record) {
        setCustomAudioRecord(record);
        if (record.data) {
          soundManager.preloadCustomAudio("global_ringtone", record.data, record.name);
          soundManager.preloadCustomAudio("focus", record.data, record.name);
        }
      } else {
        // Fallback to legacy focus slot if present
        const legacy = await customRingtoneStorage.getRingtone("focus");
        if (legacy) {
          setCustomAudioRecord(legacy);
          if (legacy.data) {
            soundManager.preloadCustomAudio("global_ringtone", legacy.data, legacy.name);
          }
        } else {
          setCustomAudioRecord(null);
        }
      }
    } catch (e) {
      console.warn("Could not load global ringtone data:", e);
    }
  };

  // Play / Stop preview with explicit user-gesture AudioContext unlock
  const handleTogglePreview = async (soundId) => {
    if (isPlaying && selectedSound === soundId) {
      soundManager.stop();
      setIsPlaying(false);
      return;
    }

    soundManager.stop();
    await soundManager.unlockAudioContext();

    setSelectedSound(soundId);
    setIsPlaying(true);

    if (soundId === "custom") {
      let record = customAudioRecord;
      if (!record) {
        record = await customRingtoneStorage.getRingtone("global_ringtone");
        if (record) setCustomAudioRecord(record);
      }
      if (record) {
        soundManager.previewCustomAudio(record, volume, () => {
          setIsPlaying(false);
        });
      } else {
        setIsPlaying(false);
      }
    } else {
      soundManager.preview(soundId, volume);
      setTimeout(() => {
        setIsPlaying(false);
      }, 3500);
    }
  };

  // Upload custom audio file (MP3 / WAV / M4A)
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.warn("Audio file is too large. Please select an audio track under 25MB.");
      return;
    }

    setIsUploading(true);
    await soundManager.unlockAudioContext();

    try {
      const record = await centralAlarmEngine.uploadGlobalCustomRingtone(file);
      setCustomAudioRecord(record);
      setSelectedSound("custom");
      toast.success(`"${file.name}" set as One Global Ringtone across all features! 🎵`);
    } catch (err) {
      console.error("Custom audio upload error:", err);
      toast.error("Could not load audio file. Ensure it is a valid MP3, WAV, M4A, or OGG file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Remove custom audio
  const handleRemoveCustomAudio = async () => {
    soundManager.stop();
    setIsPlaying(false);
    await customRingtoneStorage.deleteRingtone("global_ringtone");
    await customRingtoneStorage.deleteRingtone("focus");
    soundManager.customAudioBuffers.delete("global_ringtone");
    soundManager.customAudioBuffers.delete("focus");
    setCustomAudioRecord(null);
    setSelectedSound("chime");
    centralAlarmEngine.setGlobalRingtonePreset("chime");
    toast.info("Custom ringtone removed. Defaulting to Gentle Chime.");
  };

  // Save changes
  const handleSave = () => {
    soundManager.stop();
    setIsPlaying(false);

    if (selectedSound === "custom") {
      // already registered
    } else {
      centralAlarmEngine.setGlobalRingtonePreset(selectedSound);
    }
    centralAlarmEngine.setGlobalVolume(volume);

    if (onSave) {
      onSave({
        soundId: selectedSound,
        volume,
        slot: targetSlot,
        customAudioRecord: selectedSound === "custom" ? customAudioRecord : null,
        customAudioName: selectedSound === "custom" && customAudioRecord ? customAudioRecord.name : null,
        applyToAll: true,
      });
    }

    toast.success("Global ringtone preference saved!");
    onClose();
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn select-none overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundManager.stop();
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-purple-100 flex flex-col overflow-hidden max-h-[calc(100vh-2.5rem)] my-auto animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-purple-50 bg-purple-50/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-600 text-white shadow-xs">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Tasklert Unified Ringtone
              </h3>
              <p className="text-xs text-slate-500">
                One global audio track for Focus, Clock Alarms &amp; Smart Reminders
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              soundManager.stop();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unified Banner */}
        <div className="px-5 py-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-900">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
            <span>Active ringtone applies automatically across every module</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 min-h-0">
          {/* Custom Audio Upload Card */}
          <div className="p-3.5 rounded-2xl border border-purple-200 bg-purple-50/50 space-y-2.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <FileAudio className="w-4 h-4 text-purple-600" />
                Custom Uploaded Music (MP3)
              </span>
              <span className="text-[10px] text-slate-500 font-medium">MP3, WAV, M4A, OGG</span>
            </div>

            {customAudioRecord ? (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 bg-white transition ${
                  selectedSound === "custom"
                    ? "ring-2 ring-purple-500 border-purple-400"
                    : "border-slate-200"
                }`}
              >
                <div
                  className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                  onClick={() => setSelectedSound("custom")}
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs shrink-0">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 truncate">
                      {customAudioRecord.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {(customAudioRecord.size / (1024 * 1024)).toFixed(1)} MB • Global Tasklert Ringtone
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTogglePreview("custom")}
                    className="p-2 rounded-xl border border-purple-200 text-purple-700 hover:bg-purple-50 transition cursor-pointer"
                    title={isPlaying && selectedSound === "custom" ? "Stop Preview" : "Play Preview"}
                  >
                    {isPlaying && selectedSound === "custom" ? (
                      <Square className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveCustomAudio}
                    className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Remove this file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-2.5 text-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? "Reading Audio..." : "Select Audio File (e.g. Tere Vaaste.mp3)"}</span>
                </button>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Preset Sounds */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Tasklert Built-In Tones
            </span>

            <div className="space-y-1.5">
              {BUILT_IN_SOUNDS.map((sound) => {
                const isSelected = selectedSound === sound.id;
                return (
                  <div
                    key={sound.id}
                    onClick={() => setSelectedSound(sound.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? "bg-purple-50/70 border-purple-400 ring-1 ring-purple-400"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">{sound.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {sound.name}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {sound.desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePreview(sound.id);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                      >
                        {isPlaying && selectedSound === sound.id ? (
                          <Square className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>

                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? "border-purple-600 bg-purple-600 text-white"
                            : "border-slate-300"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Volume Slider */}
          <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-purple-600" />
                Global Ringtone Volume
              </span>
              <span className="font-extrabold text-purple-600">{volume}%</span>
            </div>

            <input
              type="range"
              min="10"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2 shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              soundManager.stop();
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            Save Global Ringtone
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RingtonePickerModal;
