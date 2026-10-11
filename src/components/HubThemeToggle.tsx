"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Light/dark switch for the Identity Hub only. The choice is a non-sensitive preference kept in
// localStorage; HUB_THEME_SCRIPT applies it before first paint so a dark Hub doesn't flash white.
// With no stored choice, the Hub follows the system setting.

const KEY = "personify-hub-theme";

export const HUB_THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.hubTheme=t}catch(e){}`;

export function HubThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.hubTheme === "dark");
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.hubTheme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked (private mode): the switch still works for this visit.
    }
    setDark(!dark);
  }

  return (
    <Button variant="tour" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dark}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
