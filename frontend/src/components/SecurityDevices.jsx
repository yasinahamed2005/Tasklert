import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { notify } from "../utils/toastManager";

const SecurityDevices = () => {
  const [sessions, setSessions] = useState([]); const [events, setEvents] = useState([]);
  const [capacity, setCapacity] = useState({}); const [selected, setSelected] = useState("");
  const [maskedEmail, setMaskedEmail] = useState(""); const [otp, setOtp] = useState(""); const [busy, setBusy] = useState(false);
  const token = () => localStorage.getItem("token");
  const headers = () => ({ Authorization: `Bearer ${token()}` });
  const refresh = useCallback(async () => {
    try { const [s, a] = await Promise.all([axios.get(`${API_BASE_URL}/api/devices/security/sessions`, { headers: headers() }), axios.get(`${API_BASE_URL}/api/devices/security/activity`, { headers: headers() })]); setSessions(s.data.sessions); setCapacity(s.data.capacity); setEvents(a.data.events); }
    catch (e) { notify.error(e.response?.data?.message || "Could not load account security details."); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const request = async (action, deviceSessionId) => {
    if (!navigator.onLine) { notify.error("Connect to the internet to request a security code."); return; }
    if (!window.confirm(action === "others" ? "Send an email code to log out all other active devices?" : "Send an email code to log out this device? The device is revoked only after code verification.")) return;
    setBusy(true); try { const { data } = await axios.post(`${API_BASE_URL}/api/devices/security/otp`, { action, deviceSessionId }, { headers: headers() }); setSelected(deviceSessionId || "__others__"); setMaskedEmail(data.maskedEmail); notify.success(`A code was sent to ${data.maskedEmail}.`); } catch (e) { notify.error(e.response?.data?.message || "Could not send the code."); } finally { setBusy(false); }
  };
  const verify = async () => { setBusy(true); try { await axios.post(`${API_BASE_URL}/api/devices/security/otp/verify`, { otp }, { headers: headers() }); setSelected(""); setOtp(""); notify.success("Device session revoked."); await refresh(); } catch (e) { notify.error(e.response?.data?.message || "Code verification failed."); } finally { setBusy(false); } };
  return <section className="space-y-5 border-t border-gray-100 pt-6">
    <div><h3 className="text-base font-bold text-gray-900">Login Devices</h3><p className="text-xs text-gray-500 mt-1">Mobile {capacity.mobile || "0/2"} · Laptop/Desktop {capacity.computer || "0/1"} · Total {capacity.total || "0/3"}</p></div>
    <div className="space-y-3">{sessions.map((s) => <article key={s._id} className="rounded-2xl border border-purple-100 bg-white p-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-gray-800">{s.deviceName} {s.isCurrent && <span className="text-purple-600">· This device</span>}</p><p className="text-xs text-gray-500">{s.deviceType} · {s.browser} · {s.operatingSystem} · {s.location || "Unavailable"}</p><p className="text-[11px] text-gray-400">First login {new Date(s.firstLoginAt).toLocaleString()} · Last active {new Date(s.lastActiveAt).toLocaleString()} · {s.isRevoked ? "Revoked" : s.isActive ? "Active" : "Inactive"}</p></div>{s.isActive && !s.isRevoked && !s.isCurrent && <button disabled={busy || !navigator.onLine} onClick={() => request("single", s._id)} className="rounded-xl bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700 disabled:opacity-40">Logout This Device</button>}</article>)}</div>
    <button disabled={busy || !navigator.onLine || sessions.filter(s => s.isActive && !s.isRevoked && !s.isCurrent).length === 0} onClick={() => request("others")} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 disabled:opacity-40">Log Out All Other Devices</button>
    {!navigator.onLine && <p className="text-xs text-amber-700">Connect to the internet to request OTP. No security action is queued offline.</p>}
    {selected && <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 space-y-3"><p className="text-sm font-semibold">Enter the code sent to {maskedEmail}.</p><div className="flex gap-2"><input aria-label="Email verification code" inputMode="numeric" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} className="min-w-0 rounded-xl border border-purple-200 px-3 py-2" /><button disabled={busy || otp.length !== 6} onClick={verify} className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Verify</button></div></div>}
    <div><h3 className="text-base font-bold text-gray-900">Login Activity</h3><div className="mt-2 space-y-2">{events.map(e => <div key={e._id} className="rounded-xl bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-700">{e.eventType.replaceAll("_", " ")} · {e.deviceName || e.deviceType || "Account"}</p><p className="text-[11px] text-gray-400">{new Date(e.eventTimestamp).toLocaleString()} · {e.securityAction || e.emailNotificationStatus}</p></div>)}</div></div>
  </section>;
};
export default SecurityDevices;
