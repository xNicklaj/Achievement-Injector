// Skyrim's languages, read from the game's own `Skyrim - Interface.bsa` (it ships skyrim_<language>.txt for exactly
// these nine; Czech and others are absent). The DLL turns the ini's sLanguage into a locale with
// `substr(0, 2)` uppercased (LocalizationManager.cpp), so the code is NOT the ISO one: German is GE, not DE.

export const LANGUAGES = [
  { code: "EN", name: "English", sLanguage: "ENGLISH" },
  { code: "FR", name: "French", sLanguage: "FRENCH" },
  { code: "GE", name: "German", sLanguage: "GERMAN" },
  { code: "IT", name: "Italian", sLanguage: "ITALIAN" },
  { code: "SP", name: "Spanish", sLanguage: "SPANISH" },
  { code: "PO", name: "Polish", sLanguage: "POLISH" },
  { code: "RU", name: "Russian", sLanguage: "RUSSIAN" },
  { code: "JA", name: "Japanese", sLanguage: "JAPANESE" },
  { code: "CH", name: "Chinese", sLanguage: "CHINESE" },
] as const;

export const languageOf = (code: string) => LANGUAGES.find((l) => l.code === code);

/** Common codes that look right but never match a game language, and the code that does. */
export const LOOKALIKES: Record<string, string> = { DE: "GE", ES: "SP", PL: "PO", ZH: "CH", CN: "CH", JP: "JA" };
