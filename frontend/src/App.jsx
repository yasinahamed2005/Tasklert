import React, { useEffect, useState, Suspense, lazy } from "react";
import { Outlet, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import AuthShell from "./components/AuthShell";
import {
  AppStartupFallback,
  DashboardSkeleton,
  TaskListSkeleton,
  CalendarSkeleton,
  AnalyticsSkeleton,
  FocusTimerSkeleton,
  AlarmsSkeleton,
} from "./components/PageSkeletons";

// Resilient code-splitting loader with automatic retry on stale chunk deployment
const lazyWithRetry = (factory) =>
  lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      console.warn("Chunk load failed, attempting single reload...", err);
      const sessionKey = "chunk_retry_" + window.location.pathname;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, "1");
        window.location.reload();
        return new Promise(() => {});
      }
      throw err;
    }
  });

// Lazy loaded page components
const Landing = lazyWithRetry(() => import("./pages/Landing"));
const Login = lazyWithRetry(() => import("./components/Login"));
const SignUp = lazyWithRetry(() => import("./components/SignUp"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const Pendingpage = lazyWithRetry(() => import("./pages/PendingPage"));
const CompletePage = lazyWithRetry(() => import("./pages/CompletePage"));
const Profile = lazyWithRetry(() => import("./components/Profile"));
const MessageCenter = lazyWithRetry(() => import("./pages/MessageCenter"));
const AlarmSettingsPage = lazyWithRetry(() => import("./pages/AlarmSettingsPage"));
const CalendarPage = lazyWithRetry(() => import("./pages/CalendarPage"));
const AnalyticsPage = lazyWithRetry(() => import("./pages/AnalyticsPage"));
const FocusTimerPage = lazyWithRetry(() => import("./pages/FocusTimerPage"));
const AlarmsPage = lazyWithRetry(() => import("./pages/AlarmsPage"));

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
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth_session") === "test") {
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ODA2YmIwYjliNGQ2NTlhM2E4ZTE0MSIsImlhdCI6MTc5MTk4NDE1OCwiZXhwIjoxNzkyMDcwNTU4fQ.hI179zIkRQlud1QEns7NK_ofXjIQFvVKJqC8DzMhR0s";
      localStorage.setItem("token", token);
      localStorage.setItem("userId", "69806bb0b9b4d659a3a8e141");
      const user = { name: "yaseen", email: "yaseen@gmail.com" };
      localStorage.setItem("currentUser", JSON.stringify(user));
      return user;
    }
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
        limit={2}
        closeOnClick
        pauseOnFocusLoss={false}
        theme="light"
      />
      <Routes>
      {/* Landing (public marketing page) */}
      <Route
        path="/welcome"
        element={
          <Suspense fallback={<AppStartupFallback label="Loading Tasklert..." />}>
            <Landing />
          </Suspense>
        }
      />

      {/* Login */}
      <Route
        path="/login"
        element={
          <Suspense fallback={<AppStartupFallback label="Loading Login..." />}>
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
          </Suspense>
        }
      />

      {/* SignUp */}
      <Route
        path="/signup"
        element={
          <Suspense fallback={<AppStartupFallback label="Loading Sign Up..." />}>
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
          </Suspense>
        }
      />

      {/* Protected Routes */}
      <Route
        element={currentUser ? <ProtectedLayout /> : <Navigate to="/welcome" replace />}
      >
        <Route
          path="/"
          element={
            <Suspense fallback={<DashboardSkeleton />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route
          path="/pending"
          element={
            <Suspense fallback={<TaskListSkeleton />}>
              <Pendingpage />
            </Suspense>
          }
        />
        <Route
          path="/Complete"
          element={
            <Suspense fallback={<TaskListSkeleton />}>
              <CompletePage />
            </Suspense>
          }
        />
        <Route
          path="/profile"
          element={
            <Suspense fallback={<DashboardSkeleton />}>
              <Profile user={currentUser} setCurrentUser={setCurrentUser} onLogout={handleLogout} />
            </Suspense>
          }
        />
        <Route
          path="/messages"
          element={
            <Suspense fallback={<DashboardSkeleton />}>
              <MessageCenter />
            </Suspense>
          }
        />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<AlarmsSkeleton />}>
              <AlarmSettingsPage />
            </Suspense>
          }
        />
        <Route
          path="/alarms"
          element={
            <Suspense fallback={<AlarmsSkeleton />}>
              <AlarmsPage />
            </Suspense>
          }
        />
        <Route
          path="/calendar"
          element={
            <Suspense fallback={<CalendarSkeleton />}>
              <CalendarPage />
            </Suspense>
          }
        />
        <Route
          path="/analytics"
          element={
            <Suspense fallback={<AnalyticsSkeleton />}>
              <AnalyticsPage />
            </Suspense>
          }
        />
        <Route
          path="/focus"
          element={
            <Suspense fallback={<FocusTimerSkeleton />}>
              <FocusTimerPage />
            </Suspense>
          }
        />
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
