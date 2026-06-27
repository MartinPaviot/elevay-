/**
 * Pure builder for the inbox Cmd/Ctrl+K command palette (B6).
 *
 * The page used to assemble these commands inline in a useMemo, which made the
 * exact command set (gated by selection / lane / mailbox-connected) impossible
 * to unit-test. This module is the canonical, side-effect-free assembler: it
 * takes a snapshot of the palette-relevant state (`PaletteData`) plus the action
 * callbacks the page wires (`PaletteActions`) and returns the ordered command
 * list. Every `run()` delegates to ONE action callback — there is no second
 * triage/reply/book/stop/label code path (B6 R2.11).
 */

export interface PaletteCommand {
  id: string;
  label: string;
  /** Right-aligned secondary text, e.g. "Lane" / "Action" / "Open". */
  hint?: string;
  /**
   * Single-key shortcut for this verb (e.g. "e", "r", "s"), shown as a `kbd`
   * glyph so the palette doubles as the shortcuts cheat-sheet (B6 R1.5/R4.1).
   * Display-only — the actual key binding lives in the page keydown listener.
   */
  shortcut?: string;
  run: () => void;
}

/** Built-in lanes, in display order. Mirrors page.tsx `TABS`. */
export const PALETTE_LANES = ["attention", "snoozed", "done", "handled", "outbound"] as const;
export type PaletteLane = (typeof PALETTE_LANES)[number];

export interface PaletteData {
  /** The active lane id (a built-in lane, "bundles", or a custom lane). */
  tab: string;
  /** The focused conversation, or null. Gates the per-conversation actions. */
  selectedKey: string | null;
  conversations: { key: string; displayName: string; subject: string }[];
  customLanes: { id: string; name: string }[];
  /** Total messages bundled — the "Go to Bundles" command shows when > 0. */
  bundleTotal: number;
  mailboxes: { id: string; label: string; address: string }[];
  /** Intention splits on the attention lane (B3). Empty off-attention. */
  splits: { id: string; name: string; count: number }[];
  /** False once a lane load confirms the user has no mailbox of their own. */
  mailboxConnected: boolean;
  /** Human lane labels (page.tsx TAB_LABELS). */
  tabLabels: Record<string, string>;
}

export interface PaletteActions {
  /** Jump to a built-in lane (clears any custom lane). */
  goToLane: (tab: PaletteLane) => void;
  goToBundles: () => void;
  goToCustomLane: (id: string) => void;
  /** Switch the focused mailbox; null = "All inboxes". */
  switchMailbox: (id: string | null) => void;
  openConversation: (key: string) => void;
  markDone: (key: string) => void;
  snooze1Day: (key: string) => void;
  /** Open the reply composer on the selected thread (never sends). */
  reply: () => void;
  /** Open the meeting scheduler via the pane handler. */
  book: () => void;
  /** Stop the active sequence on the selected thread (reports if none). */
  stop: () => void;
  /** Open the thread add-label input, focused. */
  label: () => void;
  /** Switch the attention lane to an intention split. */
  goToSplit: (id: string) => void;
  /** Route to /settings/mail-calendar to connect a mailbox. */
  connectMailbox: () => void;
}

/** i18n key for each built-in split name; custom splits keep their own name. */
const BUILTIN_SPLIT_LABEL_KEY: Record<string, string> = {
  other: "inbox.split.primary",
  needs_reply: "inbox.split.needsReply",
  follow_ups: "inbox.split.followUps",
  promotions: "inbox.split.promotions",
  social: "inbox.split.social",
};

/**
 * Assemble the palette command list. Order: lanes -> bundles -> custom lanes ->
 * mailbox switch -> attention splits -> per-conversation actions -> connect ->
 * open-by-name. Pure: no React, no refs, no router — every effect is a callback.
 * `t` is the locale translator (passed in from the page, which holds the hook).
 */
export function buildInboxPaletteCommands(
  data: PaletteData,
  actions: PaletteActions,
  t: (key: string, vars?: Record<string, string | number>) => string,
): PaletteCommand[] {
  const cmds: PaletteCommand[] = [];
  const { tab, selectedKey, tabLabels } = data;
  const laneHint = t("inbox.palette.hint.lane");
  const actionHint = t("inbox.palette.hint.action");

  // Built-in lanes.
  for (const lane of PALETTE_LANES) {
    cmds.push({ id: `lane:${lane}`, label: t("inbox.palette.goTo", { name: tabLabels[lane] ?? lane }), hint: laneHint, run: () => actions.goToLane(lane) });
  }
  if (data.bundleTotal > 0) {
    cmds.push({ id: "lane:bundles", label: t("inbox.palette.goTo", { name: t("inbox.folder.bundles") }), hint: laneHint, run: actions.goToBundles });
  }
  for (const l of data.customLanes) {
    cmds.push({ id: `lane:${l.id}`, label: t("inbox.palette.goTo", { name: l.name }), hint: laneHint, run: () => actions.goToCustomLane(l.id) });
  }

  // Mailbox quick-switch — only with a chooser (2+ connected boxes).
  if (data.mailboxes.length >= 2) {
    const mailboxHint = t("inbox.palette.hint.mailbox");
    cmds.push({ id: "mailbox:all", label: t("inbox.palette.switchTo", { name: t("inbox.folder.allInboxes") }), hint: mailboxHint, run: () => actions.switchMailbox(null) });
    for (const m of data.mailboxes) {
      cmds.push({
        id: `mailbox:${m.id}`,
        label: t("inbox.palette.switchTo", { name: m.label || m.address }),
        hint: mailboxHint,
        run: () => actions.switchMailbox(m.id),
      });
    }
  }

  // Intention splits — only on the attention lane, when splits exist (B6.6).
  if (tab === "attention" && data.splits.length > 0) {
    const splitHint = t("inbox.palette.hint.split");
    for (const s of data.splits) {
      const name = BUILTIN_SPLIT_LABEL_KEY[s.id] ? t(BUILTIN_SPLIT_LABEL_KEY[s.id]) : s.name;
      cmds.push({ id: `split:${s.id}`, label: t("inbox.palette.goTo", { name }), hint: splitHint, run: () => actions.goToSplit(s.id) });
    }
  }

  // Per-conversation actions — require a selection.
  if (selectedKey) {
    // Triage verbs only make sense on the attention/snoozed lanes.
    if (tab === "attention" || tab === "snoozed") {
      cmds.push({ id: "act:done", label: t("inbox.palette.cmd.markDone"), hint: actionHint, shortcut: "e", run: () => actions.markDone(selectedKey) });
      cmds.push({ id: "act:snooze", label: t("inbox.palette.cmd.snooze"), hint: actionHint, shortcut: "s", run: () => actions.snooze1Day(selectedKey) });
    }
    // Reply / book / label / stop work on the open thread from any lane (B6.5).
    cmds.push({ id: "act:reply", label: t("inbox.palette.cmd.reply"), hint: actionHint, shortcut: "r", run: actions.reply });
    cmds.push({ id: "act:book", label: t("inbox.palette.cmd.book"), hint: actionHint, shortcut: "b", run: actions.book });
    cmds.push({ id: "act:label", label: t("inbox.palette.cmd.label"), hint: actionHint, shortcut: "l", run: actions.label });
    cmds.push({ id: "act:stop", label: t("inbox.palette.cmd.stop"), hint: actionHint, run: actions.stop });
  }

  // Connect a mailbox — only when the user has none of their own (B6.6).
  if (!data.mailboxConnected) {
    cmds.push({ id: "connect:mailbox", label: t("inbox.palette.cmd.connectMailbox"), hint: t("inbox.palette.hint.setup"), run: actions.connectMailbox });
  }

  // Open any loaded conversation by fuzzy name/subject.
  const openHint = t("inbox.palette.hint.open");
  for (const c of data.conversations) {
    cmds.push({ id: `conv:${c.key}`, label: `${c.displayName} — ${c.subject}`, hint: openHint, run: () => actions.openConversation(c.key) });
  }

  return cmds;
}
