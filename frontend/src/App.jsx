import React, { useEffect, useState } from "react";
import { Outlet, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import Login from "./components/Login";
import SignUp from "./components/SignUp";
import AuthShell from "./components/AuthShell";
import Dashboard from "./pages/Dashboard";
import Pendingpage from "./pages/PendingPage";
import CompletePage from "./pages/CompletePage";
import Profile from "./components/Profile";
import Landing from "./pages/Landing";
import MessageCenter from "./pages/MessageCenter";
import AlarmSettingsPage from "./pages/AlarmSettingsPage";
const App = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      document.documentElement.classList.remove(
        "theme-blue",
        "theme-peach",
        "theme-green",
        "theme-lavender",
        "theme-dark",
        "theme-pink"
      );
      document.documentElement.classList.add(savedTheme);
    }
  }, []);

  const [currentUser, setCurrentUser] = useState(() => {
    const stored = localStorage.getItem("currentUser");
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("currentUser");
    }
  }, [currentUser]);

  const handleAuthSubmit = (data) => {
    const user = {
      email: data.email,
      name: data.name || "User",
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(
        data.name || "User"
      )}&background=random`,
    };

    setCurrentUser(user);
    navigate("/", { replace: true });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setCurrentUser(null);
    navigate("/login", { replace: true });
  };

  const ProtectedLayout = () => (
    <Layout user={currentUser} onLogout={handleLogout}>
      <Outlet />
    </Layout>
  );

  return (
    <>
      <ToastContainer
        position="top-right"
        newestOnTop
        closeOnClick
        pauseOnFocusLoss={false}
        theme="light"
      />
      <Routes>
      {/* Landing (public marketing page) */}
      <Route path="/welcome" element={<Landing />} />

      {/* Login */}
      <Route
        path="/login"
        element={
          <AuthShell
            mode="login"
            onSwitchToLogin={() => navigate("/login")}
            onSwitchToSignup={() => navigate("/signup")}
          >
            <Login
              onSubmit={handleAuthSubmit}
              onSwitchMode={() => navigate("/signup")}
              showSwitchLink={false}
            />
          </AuthShell>
        }
      />

      {/* SignUp */}
      <Route
        path="/signup"
        element={
          <AuthShell
            mode="signup"
            onSwitchToLogin={() => navigate("/login")}
            onSwitchToSignup={() => navigate("/signup")}
          >
            <SignUp
              onSubmit={handleAuthSubmit}
              onSwitchMode={() => navigate("/login")}
              showSwitchLink={false}
            />
          </AuthShell>
        }
      />

      {/* Protected Routes */}
      <Route
        element={currentUser ? <ProtectedLayout /> : <Navigate to="/welcome" replace />}
      >
        <Route path="/" element={<Dashboard />} />
        <Route path='/pending' element={<Pendingpage/>}/>
        <Route path='/Complete' element={<CompletePage/>}/>
        <Route path='/profile' element={<Profile user={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout}/>}/>
        <Route path='/messages' element={<MessageCenter/>}/>
        <Route path='/settings' element={<AlarmSettingsPage/>}/>

      </Route>

      {/* Catch-all */}
      <Route
        path="*"
        element={<Navigate to={currentUser ? "/" : "/welcome"} replace />}
      />
      </Routes>
    </>
  );
};

export default App;
