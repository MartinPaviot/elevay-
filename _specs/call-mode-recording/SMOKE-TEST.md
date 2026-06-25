# Smoke-test live — enregistrement Call Mode

But : prouver de bout en bout que (1) l'appel s'enregistre, (2) l'annonce est jouée
**au prospect** en zone CH/FR, (3) la lecture marche, (4) on n'enregistre **jamais** sans
annonce. ~10 min, sur l'env déployé (elevay.dev/prod) de préférence — voir note "local".

Cible idéale : un numéro **que tu contrôles** (ton mobile) pour entendre l'annonce côté prospect.

---

## 0. Pré-requis (une fois)

| Quoi | Comment | Vérif |
|------|---------|-------|
| `VOICE_RECORDING_ENABLED=true` | Vercel env (prod) puis redeploy | étape 1 ci-dessous |
| `VOICE_DISCLOSURE_AUDIO_URL` | MP3 ~3-5s "Cet appel est enregistré." hébergé HTTPS (S3/Supabase/R2), joignable par Twilio | étape 1 |
| Twilio déjà OK | `TWILIO_ACCOUNT_SID/AUTH_TOKEN/API_KEY_SID/SECRET/APP_SID`, `VOICE_PUBLIC_BASE_URL` | les appels marchent déjà |
| Un caller-ID provisionné | pool du tenant dans le **même pays** que le numéro testé (sinon `no_pool_number`) | header Call Mode |
| Contact de test | a un téléphone, **pas** sur DNC, **heures ouvrées** (quiet-hours bloque sinon) | — |

L'enregistrement Twilio est **media-region** `ie1` (Dublin) si `TWILIO_REGION=ie1` → fichier en UE.

---

## 1. Pré-flight (utilise mon code, aucune supposition)

Connecté à l'app, ouvre :

    GET /api/calls/config

Attendu dans la réponse :

    "recording": { "available": true, "enabled": <toggle>, "disclosureConfigured": true }

- `available:false` → `VOICE_RECORDING_ENABLED` pas posé/redeployé. **Stop.**
- `disclosureConfigured:false` → `VOICE_DISCLOSURE_AUDIO_URL` absent → en CH/FR **rien ne s'enregistrera** (volontaire). Pose-le.

---

## 2. Le test (UI Call Mode)

1. `/call-mode` → le toggle header doit afficher **"Enregistrement"** en rouge (actif). S'il est gris, clique-le (ou POST `/api/calls/recording-setting {"enabled":true}`). **Pas** de point ambre = annonce configurée.
2. Sélectionne le contact de test → le softphone se charge.
3. **Appeler** → autorise le micro.
4. **Observe la pastille `REC`** rouge sur l'en-tête prospect dès dialing → ça prouve que `start` a renvoyé `recording:true`.
5. Décroche sur le téléphone de test : **tu (prospect) entends l'annonce MP3 AVANT d'être mis en relation** ; le rep ne l'entend pas (whisper `<Number url>`).
6. Parle ~10s, raccroche.
7. **Dans ~60s** (le débrief poll `GET /api/calls/[id]` toutes les 3s, 20×) un bloc **"Enregistrement"** avec un `<audio>` apparaît dans le débrief. Lance-le → tu entends la conversation, **annonce comprise au début** (= preuve de l'annonce).

---

## 3. Vérif backend (faisant autorité)

**DB** (psql sur `DATABASE_URL`/`DATABASE_URL_OWNER`) :

    select id, started_at, ended_at, duration_sec, twilio_call_sid,
           recording_consent, two_party_consent_region,
           (recording_url is not null) as has_recording_url, recording_duration_sec,
           processing_state, outcome
    from calls order by started_at desc limit 3;

Attendu sur la ligne du test (CH/FR) :
- `recording_consent = 'given'`
- `twilio_call_sid` non nul
- `has_recording_url = true`  ← **le point d'intégration clé que je n'ai pas pu tester d'ici**
- `recording_duration_sec > 0`

**Twilio Console** → Monitor → Logs :
- *Recordings* : une recording existe pour l'appel.
- *Calls* → la requête : `/api/calls/recording-status` a renvoyé **200**, et `/api/calls/disclosure-whisper` a renvoyé **200** avec `<Play>` (CH/FR).

---

## 4. Tableau panne → cause (diagnostic, pas dismiss)

| Symptôme | Cause probable | Où regarder |
|----------|----------------|-------------|
| Pas de pastille REC | `start` a renvoyé `recording:false` | `/api/calls/config` → `recording` : `available`? `enabled`? `disclosureConfigured`? (raisons policy : `deployment_disabled`/`workspace_disabled`/`disclosure_missing`) |
| Le **rep** entend l'annonce (pas le prospect) | régression du fix whisper | `buildAgentTwiml` ne doit avoir **aucun** `<Play>` top-level ; l'URL est sur `<Number url>` |
| Le prospect n'entend rien mais REC affiché | MP3 injoignable par Twilio, ou 403 signature | Twilio debugger sur `/api/calls/disclosure-whisper` ; `VOICE_DISCLOSURE_AUDIO_URL` accessible en HTTPS public |
| **Recording chez Twilio mais `recording_url` NULL en DB** | `recording-status` ne matche pas la ligne (`twilio_call_sid` ≠ `CallSid` Twilio) | **LE risque que j'ai signalé.** Compare le `CallSid` de la recording (Twilio) au `twilio_call_sid` (DB). Si ≠ : le webhook arrive avec le SID parent ≠ celui stocké → à corriger dans `recording-status` |
| Player 404 | `recording_url` présent mais proxy KO | creds Twilio absents (503), ou audio purgé (rétention) |
| `quiet_hours`/`dnc`/`no_pool_number` au lancement | gate `start` | message d'erreur exact dans le toast |

---

## 5. Test négatif (fail-safe légal — à faire une fois)

Retire `VOICE_DISCLOSURE_AUDIO_URL` (ou appelle un numéro CH/FR sans annonce configurée) :
- le toggle montre un **point ambre** ;
- l'appel CH/FR → **aucune pastille REC**, **aucune** recording (`decision=disclosure_missing`).

Confirme qu'on **ne capture jamais en silence**.

---

## Notes

- **Local dev** : Twilio exige des webhooks publics → `ngrok` + `VOICE_PUBLIC_BASE_URL=<https ngrok>`. Le `recording_url` est écrit par la **route** `recording-status` (pas Inngest) → le **player marche en local**. Mais le **texte** du débrief (wentWell/toImprove) vient du worker **Inngest**, qui **ne tourne pas sous `pnpm dev`** → normal qu'il reste vide en local. Pour le débrief complet : env déployé.
- **Latence** : la recording Twilio se finalise quelques secondes après le raccrochage → bien dans la fenêtre de poll de 60s.
- **Nettoyage** : la recording de test s'auto-purge à 90j (`recording-retention` cron). Pour la supprimer tout de suite : Twilio Console → Recordings → delete.
