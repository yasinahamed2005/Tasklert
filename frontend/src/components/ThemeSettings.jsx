import React from "react";

const themes = [
  { name: "theme-blue", color: "#1e88e5" },
  { name: "theme-peach", color: "#d4a373" },
  { name: "theme-green", color: "#a3d977" },
  { name: "theme-lavender", color: "#a78bfa" },
  { name: "theme-dark", color: "#1f2937" },
  { name: "theme-pink", color: "#c026d3" },
];

const ThemeSettings = ({ onClose }) => {
  const applyTheme = (theme) => {
    document.documentElement.classList.remove(
      "theme-blue",
      "theme-peach",
      "theme-green",
      "theme-lavender",
      "theme-dark",
      "theme-pink"
    );
    document.documentElement.classList.add(theme);
    localStorage.setItem("theme", theme);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-72 shadow-lg">
        
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 bg-[var(--primary)] text-white rounded-t-lg">
          <h3 className="text-sm font-semibold">THEME SETTINGS</h3>
          <button onClick={onClose} className="text-lg">×</button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="text-sm mb-3">Choose Theme Color</p>
          <div className="grid grid-cols-4 gap-3">
            {themes.map((t) => (
              <div
                key={t.name}
                onClick={() => applyTheme(t.name)}
                className="w-10 h-10 rounded cursor-pointer border hover:scale-105 transition"
                style={{ backgroundColor: t.color }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;
