import { Capacitor, registerPlugin } from "@capacitor/core";

let SystemBars;
try {
  SystemBars =
    (typeof window !== "undefined" && window.Capacitor?.Plugins?.SystemBars) ||
    registerPlugin("SystemBars");
} catch (_) {
  SystemBars = (typeof window !== "undefined" && window.Capacitor?.Plugins?.SystemBars) || null;
}

export function syncSystemNavigationBar() {
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) return;
  const styles = getComputedStyle(document.documentElement);
  const rawColor = styles.getPropertyValue("--system-navigation-background").trim() || "#faf5ff";
  let color = rawColor;
  if (!/^#[\da-f]{6}$/i.test(color)) {
    const probe = document.createElement("span");
    probe.style.color = rawColor;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
    probe.remove();
    color = resolved?.length === 3
      ? `#${resolved.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`
      : "#faf5ff";
  }
  const hex = color.match(/^#([\da-f]{6})$/i)?.[1];
  let lightIcons = false;
  if (hex) {
    const channels = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
    const luminance = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    lightIcons = 0.2126 * luminance[0] + 0.7152 * luminance[1] + 0.0722 * luminance[2] < 0.45;
  }
  SystemBars?.setNavigationBar?.({ color, lightIcons })?.catch?.((error) => {
    console.warn("Could not update native navigation bar appearance:", error);
  });
}
