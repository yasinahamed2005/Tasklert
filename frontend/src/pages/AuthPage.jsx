import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import AuthShell from "../components/AuthShell";
import Login from "../components/Login";
import SignUp from "../components/SignUp";

/**
 * Unified AuthPage Controller
 * Strictly ensures only ONE authentication card is rendered at any time.
 * Smoothly toggles between Login and Sign Up using React state without full page reloads.
 */
const AuthPage = ({ initialMode = "login", onAuthSubmit }) => {
  const location = useLocation();

  const [mode, setMode] = useState(() => {
    if (location.pathname === "/signup") return "signup";
    return initialMode || "login";
  });

  // Keep state in sync if browser history changes (e.g., back / forward button)
  useEffect(() => {
    if (location.pathname === "/signup") {
      setMode("signup");
    } else if (location.pathname === "/login") {
      setMode("login");
    }
  }, [location.pathname]);

  const handleSwitchMode = (nextMode) => {
    if (mode === nextMode) return;
    setMode(nextMode);
    // Smoothly update URL without triggering unnecessary route unmounts
    window.history.replaceState(null, "", nextMode === "signup" ? "/signup" : "/login");
  };

  return (
    <AuthShell
      mode={mode}
      onSwitchToLogin={() => handleSwitchMode("login")}
      onSwitchToSignup={() => handleSwitchMode("signup")}
    >
      <div
        key={mode}
        className="w-full flex justify-center animate-fadeIn transition-all duration-300 ease-out"
      >
        {mode === "login" ? (
          <Login
            onSubmit={onAuthSubmit}
            onSwitchMode={() => handleSwitchMode("signup")}
            showSwitchLink={true}
          />
        ) : (
          <SignUp
            onSubmit={onAuthSubmit}
            onSwitchMode={() => handleSwitchMode("login")}
            showSwitchLink={true}
          />
        )}
      </div>
    </AuthShell>
  );
};

export default AuthPage;

