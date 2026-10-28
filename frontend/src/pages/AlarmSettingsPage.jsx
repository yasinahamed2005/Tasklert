import React from "react";
import { Navigate } from "react-router-dom";

/**
 * Legacy route redirect wrapper.
 * Automatically forwards to unified Settings Hub notifications tab.
 */
const AlarmSettingsPage = () => {
  return <Navigate to="/settings?tab=notifications" replace />;
};

export default AlarmSettingsPage;
