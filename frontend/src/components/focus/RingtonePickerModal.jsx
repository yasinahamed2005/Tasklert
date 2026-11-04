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
} from "lucide-react";
import { soundManager } from "../../utils/soundManager";
import { customRingtoneStorage } from "../../utils/customRingtoneStorage";
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
  const [selectedSound, setSelectedSound] = useState(currentSound);
  const [volume, setVolume] = useState(currentVolume);
  const [isPlaying, setIsPlaying] = useState(false);
  const [customAudioRecord, setCustomAudioRecord] = useState(null);
  const [customAudioUrl, setCustomAudioUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Load custom audio from IndexedDB on modal open
  useEffect(() => {
    if (!isOpen) {
      soundManager.stop();
      setIsPlaying(false);
      return;
    }

    setSelectedSound(currentSound || "chime");
    setVolume(currentVolume || 80);

    const loadCustom = async () => {
      try {
        const record = await customRingtoneStorage.getRingtone(targetSlot);
        if (record) {
          setCustomAudioRecord(record);
          setCustomAudioUrl(record.url);
        } else {
          setCustomAudioRecord(null);
          setCustomAudioUrl(null);
        }
      } catch (e) {
        console.warn("Could not load ringtone:", e);
      }
    };

    loadCustom();

    return () => {
      soundManager.stop();
      setIsPlaying(false);
    };
  }, [isOpen, targetSlot, currentSound, currentVolume]);

  // Handle Play/Stop preview
  const handleTogglePreview = (soundId) => {
    if (isPlaying && selectedSound === soundId) {
      soundManager.stop();
      setIsPlaying(false);
      return;
    }

    soundManager.stop();
    setSelectedSound(soundId);
    setIsPlaying(true);

    if (soundId === "custom" && customAudioUrl) {
      soundManager.previewCustomAudio(customAudioUrl, volume, () => {
        setIsPlaying(false);
      });
    } else {
      soundManager.preview(soundId, volume);
      setTimeout(() => {
        setIsPlaying(false);
      }, 3000);
    }
  };

  // Handle custom audio file upload from device
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.warn("Audio file is too large. Please select an audio track under 15MB.");
      return;
    }

    setIsUploading(true);
    try {
      const record = await customRingtoneStorage.saveRingtone(targetSlot, file);
      if (record) {
        const fullRec = await customRingtoneStorage.getRingtone(targetSlot);
        setCustomAudioRecord(fullRec);
        setCustomAudioUrl(fullRec.url);
        setSelectedSound("custom");
        toast.success(`Loaded "${file.name}" as your ringtone!`);
      }
    } catch (err) {
      console.error("Custom audio error:", err);
      toast.error("Could not load the audio file. Please ensure it's a valid MP3/WAV/M4A file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Remove custom audio
  const handleRemoveCustomAudio = async () => {
    soundManager.stop();
    setIsPlaying(false);
    await customRingtoneStorage.deleteRingtone(targetSlot);
    setCustomAudioRecord(null);
    setCustomAudioUrl(null);
    if (selectedSound === "custom") {
      setSelectedSound("chime");
    }
    toast.info("Custom audio removed. Restored default ringtone.");
  };

  // Save changes
  const handleSave = () => {
    soundManager.stop();
    setIsPlaying(false);

    onSave({
      soundId: selectedSound,
      volume,
      customAudioName: selectedSound === "custom" && customAudioRecord ? customAudioRecord.name : null,
    });
  };

  if (!isOpen) return null;

  const modeDisplayName =
    targetSlot === "short_break"
      ? "Short Break"
      : targetSlot === "long_break"
      ? "Long Break"
      : "Focus Session";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundManager.stop();
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-blue-100 flex flex-col overflow-hidden max-h-[90vh] animate-scaleUp"
      >
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
                Choose sound for {modeDisplayName}
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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Custom Audio Upload Section (User's Own Music) */}
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
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                    🎵
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {customAudioRecord.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {(customAudioRecord.size / (1024 * 1024)).toFixed(1)} MB · Ready for alarms
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTogglePreview("custom")}
                    className="p-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                    title={isPlaying && selectedSound === "custom" ? "Stop Preview" : "Preview Music"}
                  >
                    {isPlaying && selectedSound === "custom" ? (
                      <Square className="w-4 h-4 fill-blue-600" />
                    ) : (
                      <Play className="w-4 h-4 fill-blue-600" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveCustomAudio}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                    title="Remove custom audio"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-blue-300 bg-white text-blue-700 text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? "Loading Audio..." : "Select Music from Device..."}</span>
                </button>
              </div>
            )}
          </div>

          {/* Built-in Synthesizer Alarms */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block px-1">
              Tasklert Preset Tones
            </label>
            <div className="space-y-1.5">
              {BUILT_IN_SOUNDS.map((item) => {
                const isSelected = selectedSound === item.id;
                const isItemPlaying = isPlaying && selectedSound === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedSound(item.id)}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-2 transition cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/70 border-blue-400 shadow-2xs"
                        : "bg-white hover:bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg shrink-0">{item.icon}</span>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isSelected ? "text-blue-900" : "text-slate-800"}`}>
                          {item.name}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePreview(item.id);
                        }}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          isItemPlaying
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                        title={isItemPlaying ? "Stop" : "Preview"}
                      >
                        {isItemPlaying ? (
                          <Square className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Volume Slider */}
          <div className="p-3.5 rounded-2xl border border-blue-100 bg-blue-50/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-blue-600" /> Alarm Volume
              </span>
              <span className="font-mono text-blue-700">{volume}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSelectedSound("chime");
              setVolume(80);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundManager.stop();
                onClose();
              }}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition active:scale-95 cursor-pointer"
            >
              Save Sound
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RingtonePickerModal;