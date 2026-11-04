import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { soundManager } from "../../utils/soundManager";
import { customRingtoneStorage } from "../../utils/customRingtoneStorage";
import { deviceAlarmManager } from "../../utils/deviceAlarmManager";
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
  targetSlot = "focus", // 'focus' | 'short_break' | 'long_break'
  currentSound = "chime",
  currentVolume = 80,
  onSave,
}) => {
  const [activeSlot, setActiveSlot] = useState(targetSlot || "focus");
  const [selectedSound, setSelectedSound] = useState(currentSound);
  const [volume, setVolume] = useState(currentVolume);
  const [isPlaying, setIsPlaying] = useState(false);
  const [customAudioRecord, setCustomAudioRecord] = useState(null);
  const [allSlotsMeta, setAllSlotsMeta] = useState({});
  const [useSameForAll, setUseSameForAll] = useState(() => customRingtoneStorage.getUseSameRingtoneForAll());
  const [applyToAll, setApplyToAll] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Sync active slot with targetSlot on open
  useEffect(() => {
    if (isOpen) {
      setActiveSlot(targetSlot || "focus");
      setSelectedSound(currentSound || "chime");
      setVolume(currentVolume || 80);
      setUseSameForAll(customRingtoneStorage.getUseSameRingtoneForAll());
      loadSlotData(targetSlot || "focus");
    } else {
      soundManager.stop();
      setIsPlaying(false);
    }
  }, [isOpen, targetSlot, currentSound, currentVolume]);

  const handleToggleUseSameForAll = async (enabled) => {
    setUseSameForAll(enabled);
    customRingtoneStorage.setUseSameRingtoneForAll(enabled);
    if (enabled && customAudioRecord) {
      // Mirror to all slots
      await customRingtoneStorage.saveRingtoneToAll(customAudioRecord);
    }
    await loadSlotData(activeSlot);
  };

  const loadSlotData = async (slot) => {
    try {
      const allMeta = await customRingtoneStorage.getAllSlotsMetadata();
      setAllSlotsMeta(allMeta);

      const record = await customRingtoneStorage.getRingtone(slot);
      if (record) {
        setCustomAudioRecord(record);
        if (record.data) {
          soundManager.preloadCustomAudio(slot, record.data, record.name);
        }
      } else {
        setCustomAudioRecord(null);
      }
    } catch (e) {
      console.warn("Could not load ringtone data:", e);
    }
  };

  const handleSwitchSlot = (slot) => {
    soundManager.stop();
    setIsPlaying(false);
    setActiveSlot(slot);
    loadSlotData(slot);
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
        record = await customRingtoneStorage.getRingtone(activeSlot);
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

  // Upload audio file with option to apply to all modes
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
      if (applyToAll) {
        // Save to focus, short_break, and long_break
        await customRingtoneStorage.saveRingtone("focus", file, true);

        // Save natively for all slots
        deviceAlarmManager.saveCustomRingtoneNative("focus", file).catch(() => {});
        deviceAlarmManager.saveCustomRingtoneNative("short_break", file).catch(() => {});
        deviceAlarmManager.saveCustomRingtoneNative("long_break", file).catch(() => {});

        // Preload for all slots
        const buffer = await file.arrayBuffer();
        soundManager.preloadCustomAudio("focus", buffer, file.name);
        soundManager.preloadCustomAudio("short_break", buffer, file.name);
        soundManager.preloadCustomAudio("long_break", buffer, file.name);
      } else {
        await customRingtoneStorage.saveRingtone(activeSlot, file, false);
        deviceAlarmManager.saveCustomRingtoneNative(activeSlot, file).catch(() => {});

        const buffer = await file.arrayBuffer();
        soundManager.preloadCustomAudio(activeSlot, buffer, file.name);
      }

      await loadSlotData(activeSlot);
      setSelectedSound("custom");

    } catch (err) {
      console.error("Custom audio upload error:", err);
      toast.error("Could not load audio file. Ensure it is a valid MP3, WAV, M4A, or OGG file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Remove custom audio for current slot
  const handleRemoveCustomAudio = async () => {
    soundManager.stop();
    setIsPlaying(false);
    await customRingtoneStorage.deleteRingtone(activeSlot);
    soundManager.customAudioBuffers.delete(activeSlot);
    await loadSlotData(activeSlot);
    if (selectedSound === "custom") {
      setSelectedSound("chime");
    }
  };

  // Wipe all custom ringtones across all slots
  const handleClearAllCustom = async () => {
    soundManager.stop();
    setIsPlaying(false);
    await customRingtoneStorage.clearAllRingtones();
    soundManager.clearBuffers();
    await loadSlotData(activeSlot);
    if (selectedSound === "custom") {
      setSelectedSound("chime");
    }
  };

  // Save changes
  const handleSave = () => {
    soundManager.stop();
    setIsPlaying(false);

    onSave({
      soundId: selectedSound,
      volume,
      slot: activeSlot,
      customAudioRecord: selectedSound === "custom" ? customAudioRecord : null,
      customAudioName: selectedSound === "custom" && customAudioRecord ? customAudioRecord.name : null,
      applyToAll,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundManager.stop();
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-blue-100 flex flex-col overflow-hidden max-h-[90vh] animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-blue-50 bg-blue-50/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Alarm & Ringtone
              </h3>
              <p className="text-xs text-slate-500">
                Configure audio for Focus and Break intervals
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

        {/* Mode Selector Tabs (Focus, Short Break, Long Break) */}
        <div className="px-5 pt-3 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => handleSwitchSlot("focus")}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                activeSlot === "focus"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🍅</span>
              <span>Focus</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchSlot("short_break")}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                activeSlot === "short_break"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>☕</span>
              <span>Short Break</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchSlot("long_break")}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                activeSlot === "long_break"
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🛋️</span>
              <span>Long Break</span>
            </button>
          </div>
          <div className="py-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Configuring: <strong className="text-slate-800 uppercase">{activeSlot.replace("_", " ")}</strong></span>
            {customAudioRecord && (
              <span className="text-blue-600 font-bold truncate max-w-[180px]">
                {customAudioRecord.name}
              </span>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Custom Audio Upload Card */}
          <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/50 space-y-2.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <FileAudio className="w-4 h-4 text-blue-600" />
                Custom Device Audio
              </span>
              <span className="text-[10px] text-slate-500 font-medium">MP3, WAV, M4A, OGG</span>
            </div>

            {customAudioRecord ? (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 bg-white transition ${
                  selectedSound === "custom"
                    ? "ring-2 ring-blue-500 border-blue-400"
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
                      {(customAudioRecord.size / (1024 * 1024)).toFixed(1)} MB • {activeSlot.replace("_", " ")} slot
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTogglePreview("custom")}
                    className="p-2 rounded-xl border border-blue-200 text-blue-700 hover:bg-blue-50 transition cursor-pointer"
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
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? "Reading Audio..." : "Select Music File (Tere Vaaste.mp3)"}</span>
                </button>
              </div>
            )}

            {/* Global vs Independent Ringtone Selection Preference */}
            <div className="pt-2 border-t border-blue-100/70 space-y-1.5">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="text-xs text-slate-800 font-bold">
                  Use the same ringtone for all sessions
                </span>
                <input
                  type="checkbox"
                  checked={useSameForAll}
                  onChange={(e) => handleToggleUseSameForAll(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </label>
              <p className="text-[11px] text-blue-700 font-medium">
                {useSameForAll
                  ? "✓ Active: Tere Vaaste.mp3 applies to Focus, Short Break, and Long Break"
                  : `✓ Mode specific: Configured independently for ${activeSlot.replace("_", " ")}`}
              </p>
            </div>

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
              Tasklert Preset Tones
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
                        ? "bg-blue-50/70 border-blue-400 ring-1 ring-blue-400"
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
                            ? "border-blue-600 bg-blue-600 text-white"
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
                <Volume2 className="w-4 h-4 text-slate-600" />
                Alarm Volume
              </span>
              <span className="font-extrabold text-blue-600">{volume}%</span>
            </div>

            <input
              type="range"
              min="10"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          {/* Stale Ringtone Cache Cleanup */}
          <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>Slots: Focus ({allSlotsMeta.focus?.name ? "✓" : "—"}), Short Break ({allSlotsMeta.short_break?.name ? "✓" : "—"}), Long Break ({allSlotsMeta.long_break?.name ? "✓" : "—"})</span>
            <button
              type="button"
              onClick={handleClearAllCustom}
              className="text-rose-600 hover:underline font-bold transition cursor-pointer"
            >
              Clear All Slots
            </button>
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
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
          >
            Save Ringtone
          </button>
        </div>
      </div>
    </div>
  );
};

export default RingtonePickerModal;
