import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

export default function SecurityActionPage() {
  const [params] = useSearchParams(); const token = params.get("token");
  const [details, setDetails] = useState(null); const [error, setError] = useState(""); const [done, setDone] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; axios.post(`${API_BASE_URL}/api/devices/security/action/inspect`, { token }).then(({ data }) => { if (active) setDetails(data); }).catch(e => { if (active) setError(e.response?.data?.message || "This link could not be verified."); }); return () => { active = false; }; }, [token]);
  const confirm = async () => { setBusy(true); try { const { data } = await axios.post(`${API_BASE_URL}/api/devices/security/action/confirm`, { token }); setDone(data.message); setDetails(null); } catch (e) { setError(e.response?.data?.message || "Could not apply this security action."); } finally { setBusy(false); } };
  const report = details?.action === "report";
  return <main className="min-h-screen bg-purple-50 flex items-center justify-center p-5"><section className="w-full max-w-lg rounded-3xl border border-purple-100 bg-white p-7 shadow-xl"><h1 className="text-xl font-black text-purple-800">Tasklert sign-in confirmation</h1>{details && <><p className="mt-4 text-sm text-gray-700">{report ? "Confirm that you do not recognize this sign-in. Tasklert will revoke that device session." : "Confirm that this sign-in was yours. The device will remain active."}</p><div className="mt-4 rounded-xl bg-purple-50 p-4 text-sm text-gray-700">{details.device?.deviceName} · {details.device?.deviceType}<br />{details.device?.browser} · {details.device?.operatingSystem}</div><button disabled={busy} onClick={confirm} className={`mt-5 rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50 ${report ? "bg-rose-600" : "bg-purple-600"}`}>{busy ? "Confirming…" : report ? "Confirm and revoke session" : "Yes, it was me"}</button></>}{error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}{done && <p className="mt-4 text-sm font-semibold text-emerald-700">{done}</p>}</section></main>;
}
