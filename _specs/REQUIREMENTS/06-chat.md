# Étape 6 — Chat — Exigences pixel-level

**Date :** 2026-04-13
**Scope :** `app/apps/web/src/app/(dashboard)/chat/page.tsx` (724 lignes) + `api/chat/route.ts` (1700+ lignes) + `api/chat/threads/*` + `api/chat/suggestions`.
**Méthode :** code lu partiel (lignes 280-530 critiques) + capture Lightfield `app-chat-response.png`.

---

## 0. État actuel vérifié (2026-04-13)

### 0.1 Architecture
- Client component avec `useChat` (ai/react).
- Thread ID en URL `?thread={id}`, nouveau thread créé au 1er message.
- Save auto via `POST /api/chat/threads/{id}` après chaque message.
- Streaming SSE via AI SDK.

### 0.2 Empty state
- Icon Compass (pas Sparkle — **garder**, différenciant).
- Greeting time-based (morning/afternoon/evening), first-name aware.
- Sub "Your GTM copilot is ready. Ask about your pipeline, draft outreach, or get deal coaching." → **garder**.
- 6 suggestions (fetched `/api/chat/suggestions` ou defaults).

### 0.3 Message UI
- User message : right-aligned, bg-hover, rounded-[10px], max-w-85%, 15px/22px font-weight 450.
- AI message : left-aligned, no bg, label "Elevay" + Compass icon 13px, Markdown, tool cards.

### 0.4 Tool calls & action cards
- `ToolCallGroup` component avec transparency (in-progress + completed states).
- Action cards pour `createContact` / `createAccount` / `createDeal` / `campaign` — status pending / approved / dismissed.
- **Batch approval :** si ≥2 pending → "Dismiss all" + "Create all N" bar.
- **Sequential workflow :** après approve contact → auto-inject `[Approved: contact "X" created with id Y. Propose linked records.]` → LLM propose account/deal.
- Campaign approval → redirect hard `window.location.href = /sequences/{id}` (perte state).

### 0.5 BUG résiduel trouvé
- **Silent catch ligne 458-459** dans `approveCard` : `} catch { /* Silent fail */ }`. BUGFIX-06 l'a raté. L'utilisateur qui clique Approve voit **rien** si `/api/contacts` répond 500.

### 0.6 Input (lignes 669-688 audit)
- Text input, disabled pendant streaming.
- Voice : SpeechRecognition API, locale en-US hardcodé, fallback `alert()` si non-supporté.
- File upload : `.csv,.txt,.md,.json,.pdf`, max 2MB, **seules 5000 premières chars injectées** dans contexte.
- Multi-file : **non**.
- Drag-drop fichier : **non**.

### 0.7 Thread management
- Liste 5 derniers threads dans sidebar (préchargé layout).
- **Pas de rename thread.**
- **Pas de delete thread.**
- **Pas de search thread.**
- **Pas de pin / favorite thread.**

---

## 1. Exigences pixel-level

### 1.1 Fix silent catch (BUG critique)
- **Exigence immédiate :** remplacer le `catch { }` ligne 458 par :
  ```ts
  } catch (err) {
    toast.error(`Failed to create ${entityType}. ${err instanceof Error ? err.message : "Please try again."}`);
    console.warn("chat: approve card failed", err);
    setCardStatuses((prev) => ({ ...prev, [cardKey]: "pending" })); // let user retry
  }
  ```
- Ajouter un bouton "Retry" visible sur la card si `cardStatuses[cardKey] === "error"`.
- Commit séparé référençant BUGFIX-06 comme "long-tail cleanup".

### 1.2 Approve card endpoints non-ok handling
- Ligne 442 `if (res.ok)` mais **aucun else** → si `/api/contacts` répond 400 (validation), user ne voit rien.
- **Exigence :** en cas de `!res.ok`, lire `res.json().error` et afficher toast + mettre card en status "error" éditable (user peut corriger les fields et re-approve).
- Codes spéciaux :
  - 409 (duplicate) → toast "A contact with this email already exists. [View contact]" + option "Merge" / "Use existing".
  - 422 (missing field) → highlight le field en rouge dans la card.

### 1.3 Campaign redirect — SPA
- Ligne 427 `window.location.href = /sequences/{id}` → full reload.
- **Exigence :** `router.push(/sequences/${seqId})` + afficher toast "Campaign created — opening in Sequences".

### 1.4 Empty state : suggestions dynamiques
- **Actuel :** 6 suggestions static fallback. `/api/chat/suggestions` existe mais le contenu dynamique n'est pas vérifié.
- **Exigence :** suggestions contextuelles basées sur l'état du tenant :
  - Si 0 meetings cette semaine → "Pourquoi mon calendrier est vide ?"
  - Si ≥1 deal stalled → "Quels deals sont à risque ?"
  - Si <10 contacts → "Trouve-moi 20 nouveaux contacts dans [industry]"
  - Si new user (onboarding terminé < 7j) → "Explique-moi ce que tu peux faire"
  - Si user actif → suggestions basées sur historique chat récent.
- Endpoint `/api/chat/suggestions` doit calculer dynamiquement.

### 1.5 Thread management
- **Exigences critiques :**
  - **Rename thread** : click sur title → inline edit + save (`PATCH /api/chat/threads/{id}`).
  - **Delete thread** : menu 3 dots → confirm dialog → `DELETE /api/chat/threads/{id}`.
  - **Search threads** : search icon sidebar → filter sur titre + premier message user.
  - **Pin thread** : important conversations toujours en haut.
  - **Group by date** : "Today", "Yesterday", "Previous 7 days", "Older" (pattern ChatGPT/Claude).
- Sidebar actuelle cap 5 → exigence : "View all threads" → page `/chat/history`.

### 1.6 Message UX
- **Markdown rendering :** vérifier que code blocks, tables, lists, links fonctionnent proprement. Syntax highlighting via `react-syntax-highlighter` ou `shiki`.
- **Copy code block** : chaque `<pre>` doit avoir un copy icon hover.
- **Copy message** : hover sur AI message → copy icon bottom-right (déjà visible dans audit). Garder.
- **Regenerate** : hover → regenerate icon. Re-call `/api/chat` avec les mêmes messages history sauf le dernier AI response.
- **Edit user message :** hover sur user message → edit icon → re-soumet depuis ce point (fork la conversation).
- **Citations inline :** si tool call retourne des rows DB (contacts, emails, deals), le texte AI doit citer `[1]`, `[2]` avec popover qui montre la source (id, extrait). Critique pour trust.

### 1.7 Voice input amélioré
- **Fallback alert() → trop brutal.** Exigence : afficher un toast/banner "Voice input not supported in this browser. Try Chrome or Edge." + hint sur le bouton voice (grisé).
- **Locale en-US hardcodée** → utiliser `settings.profile.language` comme hint (`fr-FR`, `de-DE`, etc.).
- **Indicateur d'écoute** : bouton mic devient rouge + pulse pendant listening. Volume visualizer micro (waveform inline).
- **Auto-stop** : si 2s silence → arrête et envoie le draft en préview (user peut edit avant submit).

### 1.8 File upload enrichi
- **Multi-file :** accepter jusqu'à 5 fichiers max.
- **Drag-drop :** tout l'écran du chat = dropzone.
- **Types additionnels :** `.docx`, `.xlsx`, images `.png/.jpg` (vision-capable si model Claude).
- **Preview avant send :** thumbnail + nom + taille, X pour retirer avant envoi.
- **Parsing serveur :** extraire texte côté backend (pdf-parse, mammoth pour docx, xlsx-parse) au lieu de tronquer client-side à 5000 chars.
- **Cap par type :** PDF 5MB, CSV 10MB, image 4MB.

### 1.9 Erreur streaming
- Banner rouge + retry ✅ déjà présent.
- **Exigence :** afficher l'erreur spécifique (rate limit, model down, tokens exhausted) au lieu de générique.
- **Retry intelligent :** si error = "context too long" → proposer "Summarize thread and continue in new chat".
- **Timeout visible :** si streaming > 60s sans token → afficher "This is taking longer than usual…" + bouton Cancel.

### 1.10 Thread persistence
- **Draft** : si user tape et quitte sans envoyer → persister le draft dans `localStorage.chat_draft_{threadId}`. Restaurer au retour.
- **Scroll position** : restaurer last scroll position par thread.

### 1.11 Contextual actions toolbar
- **Exigence :** au-dessus de l'input, afficher chips d'actions rapides selon la page d'origine :
  - Si user vient de `/opportunities/X` → chip "Focus on Opportunity X" (inject dans contexte système).
  - Si user vient de `/contacts/Y` → chip "Focus on Contact Y".
  - Chip removable avec X.

### 1.12 Streaming UI
- **Typing indicator** dans l'audit déjà flagué comme manquant. Exigence : pendant streaming, afficher 3 dots animated (bouncing) sous le nom "Elevay".
- **Token count** (v2) : petit indicateur "235 / 4000 tokens" pour power users.
- **Partial message** : rendre le texte en streaming (déjà fait via AI SDK), mais aussi **tool calls en cours** avec état "Calling [tool name]…" et `<Loader2>` spinner.

### 1.13 Markdown pour messages AI
- Headings, lists, tables, bold, italic, code inline, code blocks, links — tous doivent rendre proprement.
- **Liens internes Elevay :** si AI génère `[Sarah Chen](/contacts/uuid)` → `Link` Next.js avec hover preview (fetch contact avatar + company).
- **Mentions :** `@sarah` doit résoudre vers le contact si existe.

### 1.14 Keyboard shortcuts
- `Cmd+K` : global command palette (déjà présent layout) → ouvrir search / create / chat.
- `/` : focus input.
- `Esc` : stop streaming si in progress, sinon close panels.
- `Cmd+Enter` : submit message (actuel Enter submit — à vérifier).
- `Shift+Enter` : newline dans input.
- `Cmd+Shift+O` : new chat.
- `Cmd+Shift+F` : search threads.
- `R` (hover sur message) : regenerate.
- `C` (hover) : copy.

### 1.15 A11y
- Role `log` ou `feed` sur la zone messages.
- `aria-live="polite"` pour nouveaux messages (screen readers lisent auto).
- Focus management : après submit, focus revient sur input.
- Labels sur tous les boutons (voice, file, submit, retry, copy).

### 1.16 Analytics PostHog
- `chat_opened` (source = nav | home_cta | deep_link)
- `chat_suggestion_used` (suggestion_text, index)
- `chat_message_sent` (message_length, has_attachment, is_voice)
- `chat_tool_call` (tool_name, entity_type)
- `chat_action_approved` (action_type, has_edits, batch_size)
- `chat_action_dismissed` (action_type)
- `chat_action_failed` (action_type, error_code)
- `chat_message_regenerated` (original_length)
- `chat_message_copied`
- `chat_thread_renamed` / `chat_thread_deleted` / `chat_thread_pinned`
- `chat_voice_used` (success, duration_s)
- `chat_file_uploaded` (file_type, file_size_kb)

### 1.17 Copy / tone
- Pitch "Your GTM copilot is ready" → **trop jargon**. Alternative : "Ask me anything about your customers, pipeline, or next move."
- "Elevay" label AI → OK (cohérent brand).
- Suggestions : garder ton direct, sans "the AI" ou clichés (déjà purgés commit `f2d8a14`).

### 1.18 Contextual summarization si thread long
- Si thread > 50 messages → le modèle backend doit summariser l'early context (garder last 20 messages raw + summary du reste).
- **Exigence UX :** badge "Long conversation — earlier context summarized" au-dessus des messages tronqués, avec CTA "Show full history".

### 1.19 Export thread
- **Exigence :** menu 3 dots du thread → "Export as Markdown" / "Export as PDF". Utile pour partage équipe / sauvegarde.

### 1.20 Feedback (thumbs up/down)
- Hover AI message → thumbs up / thumbs down icons.
- Down → textarea "What went wrong?" (optional).
- Stocké en `chat_feedback` table → alimente evals + fine-tuning training data.

---

## 2. Comparaison concurrents

### 2.1 Lightfield (capture app-chat-response.png)
**Forces :**
- Empty state lisible : greeting + question "What can I help you with?".
- AI réponse introductive structurée (bulleted list par type d'entité : Accounts / Opportunities / Contacts / Meetings / Tasks / Notes / Emails).
- Section "Analysis & Insights" séparée.
- Chat pris en charge par UI principale (pas tab), avec sidebar visible.
- Thread listing sidebar (à vérifier — capture montre "New chat").

**Faiblesses (inférées) :**
- Pas de tool calls / action cards visibles dans la capture (peut-être absent).
- Pas de batch approval (Elevay advantage).
- Pas de sequential workflow (Elevay advantage).

**Ce qu'on copie :**
- Onboarding message structuré "Here's what I can help you with" pour nouveau user → garder suggestions Elevay mais ajouter optionally une intro riche.

**Ce qu'on ne copie pas :**
- Approche "list your capabilities" peut se sentir scolaire. Elevay préfère "pose ta question, je m'adapte".

### 2.2 Monaco
- "Ask Monaco" visible dans screenshot 6-ask-monaco.png — Monaco a un chat similaire. Mais détails inconnus.

### 2.3 Gap synthèse
| Dimension | Elevay actuel | Lightfield | Gap |
|---|---|---|---|
| Silent catch error cards | ❌ BUG présent | N/A | **CRITIQUE** |
| SPA redirect campaign | ❌ full reload | ✅ | **HAUTE** |
| Thread rename/delete/search | ❌ | ✅ | **HAUTE** |
| Markdown rendu complet + citations | ⚠️ à vérifier | ✅ | HAUTE |
| Copy code block + copy message | ⚠️ copy msg OK, code à vérif | ✅ | MOYENNE |
| Regenerate | ❌ | ✅ | HAUTE |
| Edit user message / fork | ❌ | ✅ | MOYENNE |
| Typing indicator | ❌ | ✅ | MOYENNE |
| Draft persist | ❌ | ? | MOYENNE |
| Action cards + batch approve | ✅ | ❌ | **+ Elevay** |
| Sequential workflow | ✅ | ❌ | **+ Elevay** |
| Voice input | ⚠️ buggy (alert) | ❌ | MOYENNE |
| File upload multi + drag | ⚠️ single, pas de DnD | ❌ (probablement) | MOYENNE |
| Feedback thumbs | ❌ | ? | MOYENNE |
| Export thread | ❌ | ? | BASSE |
| Keyboard shortcuts | ⚠️ command palette OK, reste ? | ? | MOYENNE |

---

## 3. Gaps priorisés

| # | Gap | Criticité | Effort (h) | Bloquant pour ? |
|---|---|---|---|---|
| C1 | Fix silent catch approveCard (BUG) | **CRITIQUE** | 1 | BUGFIX-06 completeness |
| C2 | Handling !res.ok in approveCard (409/422/etc.) | **CRITIQUE** | 2 | Error UX |
| C3 | `router.push` campaign redirect | **CRITIQUE** | 0.5 | SPA integrity |
| C4 | Thread rename / delete / search | HAUTE | 8 | Thread management mature |
| C5 | Markdown complet + citations + code copy + hover preview links | HAUTE | 8 | Chat quality |
| C6 | Regenerate + edit-and-fork user message | HAUTE | 4 | Conversational UX standard |
| C7 | Typing indicator + tool call in-progress label | HAUTE | 2 | Perception perf |
| C8 | Suggestions dynamiques contextuelles | HAUTE | 4 | Empty state value |
| C9 | Multi-file upload + drag-drop + server-side parsing | HAUTE | 8 | File-context mature |
| C10 | Voice input fallback propre (toast + hint) + locale dynamique | HAUTE | 2 | UX non-supported browsers |
| C11 | Draft persist localStorage + scroll restore | MOYENNE | 3 | Quality of life |
| C12 | Error streaming spécifique + retry intelligent | MOYENNE | 4 | Resilience |
| C13 | Contextual action chips au-dessus input | MOYENNE | 3 | Efficacité power users |
| C14 | Keyboard shortcuts (/`, Esc, Cmd+Enter, R, C, Cmd+Shift+O/F) | MOYENNE | 3 | Power users |
| C15 | Feedback thumbs up/down + reason | MOYENNE | 3 | Evals data collection |
| C16 | Context summarization sur long threads | MOYENNE | 6 | Long conversations scale |
| C17 | Analytics PostHog (12+ events) | MOYENNE | 4 | Optim data-driven |
| C18 | A11y : role=log, aria-live, focus management | MOYENNE | 3 | WCAG AA |
| C19 | Export thread (Markdown + PDF) | BASSE | 3 | Partage team |
| C20 | Copy refresh (éviter "copilot" jargon) | BASSE | 0.5 | Polish |
| C21 | Thread group by date (Today / Yesterday / …) | BASSE | 2 | Polish sidebar |

**Total effort v1 (C1-C10) :** ~40h
**Total effort v2 (C11-C21) :** ~31h

---

## 4. Décisions à prendre

1. **Citations inline [1][2] : on implémente dès v1 ou v2 ?** — V1 recommandé pour parité Lightfield "95 % recall with citations". C'est un différenciant produit.
2. **Edit user message = fork conversation (nouvelle branche) ou overwrite ?** — Fork (préserve historique pour audit).
3. **Voice locale : auto-detect from user profile OR browser ?** — Profile user primary, fallback browser.
4. **Feedback thumbs : visible par défaut ou hover-only ?** — Hover-only (moins invasif).
5. **Export thread : inclure attachments (CSV, PDF originaux) ou text only ?** — Text only v1 (simplifie).
6. **Context summarization threshold : 50 messages ou tokens count ?** — Tokens count (plus précis, seuil 60% du max context window).
7. **Action cards : garder current behavior (approve inline) ou ouvrir modal pour edit large ?** — Inline v1 + "Expand" button pour modal si fields > 6.

---

## 5. Prochaines actions

1. Martin : répond aux 7 décisions §4.
2. Fix C1 + C2 + C3 immédiats (~3.5h) → résout BUG + UX cards.
3. Sprint : C4 + C5 + C6 + C7 (~22h) → mature thread + message UX.
4. Sprint : C8 + C9 + C10 (~14h) → input + suggestions + voice.
5. Puis C11-C17 (power users + resilience + data).
6. v2 : C18-C21 (polish).
