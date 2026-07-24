import React from "react";

interface TrayIndicatorProps {
  isInteractive: boolean;
}

// ==========================================
// Return null across all modes to remove the pill completely as requested.
// ==========================================
export const TrayIndicator: React.FC<TrayIndicatorProps> = () => {
  return null;
};
