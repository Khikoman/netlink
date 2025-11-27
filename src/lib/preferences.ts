// User preferences stored in localStorage for field technician convenience

const STORAGE_KEY = "netlink_preferences";

export interface UserPreferences {
  technicianName: string;
  lastProjectId: number | null;
  defaultSpliceType: "fusion" | "mechanical";
  defaultCableCount: number;
  showHelpTooltips: boolean;
}

const defaultPreferences: UserPreferences = {
  technicianName: "",
  lastProjectId: null,
  defaultSpliceType: "fusion",
  defaultCableCount: 144,
  showHelpTooltips: true,
};

export function getPreferences(): UserPreferences {
  if (typeof window === "undefined") return defaultPreferences;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...defaultPreferences, ...JSON.parse(stored) };
    }
  } catch {
    console.warn("Failed to load preferences from localStorage");
  }

  return defaultPreferences;
}

export function savePreferences(prefs: Partial<UserPreferences>): void {
  if (typeof window === "undefined") return;

  try {
    const current = getPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    console.warn("Failed to save preferences to localStorage");
  }
}

export function getTechnicianName(): string {
  return getPreferences().technicianName;
}

export function setTechnicianName(name: string): void {
  savePreferences({ technicianName: name });
}

export function getLastProjectId(): number | null {
  return getPreferences().lastProjectId;
}

export function setLastProjectId(id: number | null): void {
  savePreferences({ lastProjectId: id });
}

export function getDefaultSpliceType(): "fusion" | "mechanical" {
  return getPreferences().defaultSpliceType;
}

export function setDefaultSpliceType(type: "fusion" | "mechanical"): void {
  savePreferences({ defaultSpliceType: type });
}

export function getDefaultCableCount(): number {
  return getPreferences().defaultCableCount;
}

export function setDefaultCableCount(count: number): void {
  savePreferences({ defaultCableCount: count });
}

export function shouldShowHelpTooltips(): boolean {
  return getPreferences().showHelpTooltips;
}

export function setShowHelpTooltips(show: boolean): void {
  savePreferences({ showHelpTooltips: show });
}
