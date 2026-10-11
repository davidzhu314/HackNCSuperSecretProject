// The Identity Hub's light/dark preference. A plain module (not "use client") so the root layout,
// a server component, can inline the script as a string.

export const HUB_THEME_KEY = "personify-hub-theme";

/** Runs before first paint: applies the stored choice, or the system setting if there is none. */
export const HUB_THEME_SCRIPT = `try{var t=localStorage.getItem("${HUB_THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.hubTheme=t}catch(e){}`;
