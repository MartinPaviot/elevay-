# N27 — `/chat` (le "copilot universel" — surface centrale du produit chat-first)

Live PROD. Preuves : `screenshots/024-chat-N27-empty.png` (empty), `screenshots/025-chat-N27-response.png` (erreur).

## Empty state
Soigné : "Good evening — Your GTM copilot is ready. Ask about your pipeline, draft outreach, or get deal coaching." + 4 amorces (Give me a pipeline summary / What should I focus on today? / Research my accounts to determine my ICP / Summarize my active opportunities) + input "Ask Elevay…" (pièce-jointe + micro).

## TEST LIVE — CASSÉ (S0)
Query **lecture seule** : "How many accounts, contacts, and active sequences do I have right now?"
→ Réponse : **"Something went wrong. Please try again."** + bouton Retry. Aucune réponse générée.
→ Réseau : **`POST /api/chat => 500`** (preuve `browser_network_requests`).

## Analyse
- Cause quasi certaine : **LLM non configuré en prod** (cf. C1 : "LLM not configured/unavailable" affiché sur la fiche compte). Le 500 est le symptôme côté chat.
- La baseline statique (`ai-chat.md`) montrait que le chat est la surface la **plus capable** (~126 outils, peut agir). En prod, elle est **totalement non fonctionnelle**.
- Conséquence : la promesse "chat-first" et **toutes** les surfaces génératives dépendantes du LLM sont mortes en prod (input chat du Home, smart search NL, reports IA, ICP fit, competitive landscape, playbook extractor).
- Coutures X2 (chat agit) / X3 (chat → knowledge retrieval) : **non testables** — le chat ne répond pas.

## Gaps
- G-N27-1 [S0] `/api/chat` 500 — le chat (cœur du produit) est cassé en prod (LLM off). Bloque tout test des coutures chat.
- G-N27-2 [robustesse] l'erreur user "Something went wrong" est générique (pas de cause/aide) — mais au moins gérée (pas de crash).
