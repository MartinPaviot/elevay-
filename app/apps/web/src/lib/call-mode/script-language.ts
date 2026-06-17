/**
 * Script generation language — the language the rep chooses to generate the
 * call script in ("la langue voulue par le prospect"). Pure + client-safe (no
 * server deps) so BOTH the cockpit selector (client) and the generator (server)
 * import it. Distinct from the i18n UI locale (fr|en): the chrome can be English
 * while the script the rep reads aloud is in the prospect's language. Default FR.
 */

export const SCRIPT_LANGUAGES = ["fr", "en", "de", "it"] as const;
export type ScriptLanguage = (typeof SCRIPT_LANGUAGES)[number];

/** Full language name injected into the LLM prompt so the output reads native. */
export const SCRIPT_LANGUAGE_NAME: Record<ScriptLanguage, string> = {
  fr: "French (Suisse romande)",
  en: "English",
  de: "German (Swiss High German — Hochdeutsch, not Schwyzerdütsch)",
  it: "Italian (Swiss)",
};

/** Short code shown in the cockpit language selector. */
export const SCRIPT_LANGUAGE_SHORT: Record<ScriptLanguage, string> = {
  fr: "FR",
  en: "EN",
  de: "DE",
  it: "IT",
};

/** Narrow an arbitrary value to a ScriptLanguage, defaulting to FR. */
export function asScriptLanguage(v: unknown): ScriptLanguage {
  return (SCRIPT_LANGUAGES as readonly string[]).includes(v as string) ? (v as ScriptLanguage) : "fr";
}
