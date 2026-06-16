/**
 * Minimal i18n — locale type, the message dictionary, and a pure resolver.
 *
 * The app ships FR by default (the current UI is French); EN is the base
 * translation a user can switch on. FR is the source of truth: a missing EN key
 * falls back to FR, then to the key itself, so nothing ever renders blank.
 *
 * This is the FOUNDATION: chrome strings get migrated onto `useT()` incrementally.
 * Pilae business content (call scripts / knowledge) stays FR by design and is NOT
 * keyed here.
 */
export type Locale = "en" | "fr";
export const DEFAULT_LOCALE: Locale = "fr";

export type Messages = Record<string, string>;

export const messages: Record<Locale, Messages> = {
  fr: {
    "common.save": "Enregistrer",
    "common.cancel": "Annuler",
    "common.networkError": "Erreur réseau",
    "common.loading": "Chargement…",
    "common.retry": "Réessayer",
    "common.close": "Fermer",
    "common.confirm": "Confirmer",
    "common.copy": "Copier",
    "common.copied": "Copié",
    "common.done": "Terminé",
    "common.theProspect": "le prospect",
    "language.label": "Langue",
    "language.toEnglish": "English",
    "language.toFrench": "Français",
    // Meeting scheduler
    "meeting.scheduleTitle": "Planifier une réunion de découverte",
    "meeting.bookedTitle": "Visio planifiée",
    "meeting.when": "Quand",
    "meeting.duration": "Durée",
    "meeting.video": "Visio",
    "meeting.booking": "Planification…",
    "meeting.titlePlaceholder": "Titre (optionnel) — ex. Échange {name}",
    "meeting.pickDateTime": "Choisis une date et une heure.",
    "meeting.invalidDateTime": "Cette date et heure ne semblent pas valides.",
    "meeting.bookFailed": "Impossible de planifier la réunion.",
    "meeting.networkError": "Erreur réseau lors de la planification.",
    "meeting.bookedToast": "Visio planifiée avec {name}.",
    "meeting.inviteSent": "Invitation envoyée à {name} avec le lien de visio.",
    "meeting.descSovereign":
      "Ajoute l'événement à votre agenda connecté avec un lien de visio souveraine, et invite le contact.",
    "meeting.descProvider":
      "Crée la réunion (Google Meet / Teams / Zoom) selon votre choix et votre agenda connecté, et invite le contact.",
  },
  en: {
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.networkError": "Network error",
    "common.loading": "Loading…",
    "common.retry": "Retry",
    "common.close": "Close",
    "common.confirm": "Confirm",
    "common.copy": "Copy",
    "common.copied": "Copied",
    "common.done": "Done",
    "common.theProspect": "the prospect",
    "language.label": "Language",
    "language.toEnglish": "English",
    "language.toFrench": "Français",
    // Meeting scheduler
    "meeting.scheduleTitle": "Schedule a discovery meeting",
    "meeting.bookedTitle": "Meeting booked",
    "meeting.when": "When",
    "meeting.duration": "Duration",
    "meeting.video": "Video",
    "meeting.booking": "Booking…",
    "meeting.titlePlaceholder": "Title (optional) — e.g. Chat with {name}",
    "meeting.pickDateTime": "Pick a date and time.",
    "meeting.invalidDateTime": "That date and time doesn't look valid.",
    "meeting.bookFailed": "Couldn't book the meeting.",
    "meeting.networkError": "Network error while booking.",
    "meeting.bookedToast": "Meeting booked with {name}.",
    "meeting.inviteSent": "Invite sent to {name} with the meeting link.",
    "meeting.descSovereign":
      "Adds the event to your connected calendar with a sovereign video link, and invites the contact.",
    "meeting.descProvider":
      "Creates the meeting (Google Meet / Teams / Zoom) per your choice and connected calendar, and invites the contact.",
  },
};

/**
 * Resolve a message for `locale`, falling back to FR then the key itself.
 * `{var}` placeholders are interpolated from `vars`. Pure, unit-tested.
 */
export function translate(
  dict: Record<Locale, Messages>,
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const raw = dict[locale]?.[key] ?? dict.fr?.[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
