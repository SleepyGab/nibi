import { useRef, useState } from "react";
import { usePermissionFlow } from "@/hooks/usePermissionFlow";
import { commands } from "@/bindings";
import { withPermissionTimeout } from "@/lib/permissions";

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
}

/** The upstream screens share nibi's bounded permission recovery flow. */
export const usePermissions = (preview: boolean): Permissions => {
  const flow = usePermissionFlow(() => {}, preview);
  const [microphoneAsked, setMicrophoneAsked] = useState(false);
  const checked = flow.permissions.microphone !== "checking" &&
    flow.permissions.accessibility !== "checking";
  const needed = useRef<boolean | null>(null);
  if (checked && needed.current === null) {
    needed.current = flow.permissions.microphone !== "granted" ||
      flow.permissions.accessibility !== "granted";
  }
  return {
    platform: flow.isMacOS ? "macos" : flow.isWindows ? "windows" : "other",
    microphone: flow.permissions.microphone,
    accessibility: flow.permissions.accessibility,
    checked,
    needed: needed.current ?? false,
    allGranted: flow.ready || (!flow.isMacOS && !flow.isWindows),
    microphoneAsked,
    requestAccessibility: () => flow.request("accessibility"),
    requestMicrophone: async () => {
      if (preview) return;
      if (flow.isMacOS && microphoneAsked) {
        const result = await withPermissionTimeout(commands.openMicrophonePrivacySettings());
        if (result.status === "error") throw new Error(result.error);
        flow.recheck();
        return;
      }
      setMicrophoneAsked(true);
      await flow.request("microphone");
    },
  };
};
