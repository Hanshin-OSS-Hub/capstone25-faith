import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "faith-theme";

/** @typedef {"light" | "dark" | "system"} ThemeMode */

const ThemeContext = createContext(
  /** @type {{ theme: ThemeMode, setTheme: (t: ThemeMode) => void, resolved: "light" | "dark" }} */ ({
    theme: "system",
    setTheme: () => {},
    resolved: "light",
  }),
);

function readStored() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** @param {ThemeMode} theme */
function resolveTheme(theme) {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return systemPrefersDark() ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    /** @type {ThemeMode} */ () => readStored(),
  );

  const resolved = useMemo(() => resolveTheme(theme), [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const apply = () => {
      const r = resolveTheme(theme);
      document.documentElement.classList.toggle("dark", r === "dark");
      document.documentElement.style.colorScheme = r === "dark" ? "dark" : "light";
    };
    apply();
    if (theme !== "system") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const value = useMemo(
    () => ({ theme, setTheme, resolved }),
    [theme, setTheme, resolved],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
