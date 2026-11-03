import { useRef, useState } from "react";
import { usePermissionFlow } from "@/hooks/usePermissionFlow";

type PermissionStatus = "checking" | "needed" | "waiting" | "granted";
type PermissionPlatform = "macos" | "windows" | "other";

export interface Permissions {
  platform: PermissionPlatform;
  microphone: PermissionStatus;
  accessibility: PermissionStatus;
  /** The first check is done. */
  checked: boolean;
  /** Something still needs allowing (decided by the first check). */
  needed: boolean;
  allGranted: boolean;
  /** Asked once already: asking again opens the OS settings instead. */
  microphoneAsked: boolean;
  requestMicrophone: () => Promise<void>;
  requestAccessibility: () => Promise<void>;
  needsRecovery: boolean;
  recheck: () => void;
}

/** The upstream screens share nibi's bounded permission recovery flow. */
export const usePermissions = (preview: boolean): Permissions => {
  const flow = usePermissionFlow(() => {}, preview);
  const [microphoneAsked, setMicrophoneAsked] = useState(false);
  const grantsKnown =
    flow.permissions.microphone !== "checking" &&
    flow.permissions.accessibility !== "checking";
  const allGranted = flow.ready || (!flow.isMacOS && !flow.isWindows);
  const grantsPresent =
    flow.permissions.microphone === "granted" &&
    flow.permissions.accessibility === "granted";
  const checked =
    grantsKnown &&
    (!grantsPresent || allGranted || flow.needsRecovery || preview);
  const needed = useRef<boolean | null>(null);
  if (checked && needed.current === null) {
    needed.current = !allGranted;
  }
  return {
    platform: flow.isMacOS ? "macos" : flow.isWindows ? "windows" : "other",
    microphone: flow.permissions.microphone,
    accessibility: flow.permissions.accessibility,
    checked,
    needed: needed.current ?? false,
    allGranted,
    microphoneAsked,
    needsRecovery: flow.needsRecovery,
    recheck: flow.recheck,
    requestAccessibility: () => flow.request("accessibility"),
    requestMicrophone: async () => {
      if (preview) return;
      setMicrophoneAsked(true);
      await flow.request("microphone", microphoneAsked);
    },
  };
};
