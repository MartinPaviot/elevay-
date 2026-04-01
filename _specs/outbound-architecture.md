# Architecture Outbound — LeadSens

## Philosophie

Founder-led sales = les emails partent du vrai Gmail du fondateur.
Pas de domaine cold outbound dédié. Pas de warm-up artificiel.
L'email arrive de martin@company.com, les réponses atterrissent dans
son inbox, il peut reprendre la main manuellement à tout moment.

C'est ce que font Lightfield, Instantly (mode connected inbox), et
les meilleurs outils founder-led.

## Flow complet

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   1. TARGETING          2. ENRICHMENT        3. SEQUENCE    │
│   ┌──────────┐          ┌──────────┐         ┌──────────┐  │
│   │ Apollo   │─────────▶│ Apollo   │────────▶│ Sequence │  │
│   │ Search   │ ICP →    │ Enrich   │ real    │ Builder  │  │
│   │ (réel)   │ real co. │ (réel)   │ data    │ (existe) │  │
│   └──────────┘          └──────────┘         └──────────┘  │
│                                                     │       │
│   4. PERSONALIZATION                                ▼       │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ Claude prend: template + enrichment + historique     │  │
│   │ Claude sort: email personnalisé prêt à envoyer      │  │
│   │ (INTERPRÈTE des vraies données, N'INVENTE RIEN)     │  │
│   └──────────────────────────────┬───────────────────────┘  │
│                                  │                          │
│   5. REVIEW (human-in-the-loop)  │                          │
│   ┌──────────────────────────────▼───────────────────────┐  │
│   │ Mode REVIEW : email dans queue → user approve/edit   │  │
│   │ Mode AUTOPILOT : envoi auto si score > threshold     │  │
│   └──────────────────────────────┬───────────────────────┘  │
│                                  │                          │
│   6. SENDING                     ▼                          │
│   ┌──────────────────────────────────────────────────────┐  │
│   │                  Gmail Send API                       │  │
│   │ • OAuth token du user → gmail.users.messages.send    │  │
│   │ • Email part du vrai Gmail du fondateur              │  │
│   │ • Thread management (follow-up = même thread)        │  │
│   │ • Rate limit : 50/jour (configurable)                │  │
│   │ • Enregistre message_id + thread_id en DB            │  │
│   └──────────────────────────────┬───────────────────────┘  │
│                                  │                          │
│   7. TRACKING                    ▼                          │
│   ┌──────────────────────────────────────────────────────┐  │
│   │              Gmail Sync (déjà existant)               │  │
│   │ • Sync inbox toutes les 5 min (Inngest cron)         │  │
│   │ • Match reply par thread_id → enrollment trouvé      │  │
│   │ • Bounce detecté par Gmail bounce notification        │  │
│   │ • Open tracking : PAS DE PIXEL (tue deliverability)  │  │
│   └──────────────────────────────┬───────────────────────┘  │
│                                  │                          │
│   8. REPLY CLASSIFICATION        ▼                          │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ Claude classifie la réponse :                         │  │
│   │ • positive → PAUSE sequence, notifier user, créer    │  │
│   │   activité "reply_positive", update deal stage        │  │
│   │ • negative → STOP sequence, marquer contact           │  │
│   │ • OOO → PAUSE, reschedule step +7 jours              │  │
│   │ • unsubscribe → STOP, opt-out permanent               │  │
│   │ • question → PAUSE, notifier pour réponse manuelle   │  │
│   └──────────────────────────────┬───────────────────────┘  │
│                                  │                          │
│   9. FEEDBACK LOOP               ▼                          │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ • Engagement data → re-score le contact/account      │  │
│   │ • Reply rate par sequence → optimiser templates       │  │
│   │ • Deliverability réelle (bounces, replies) → health  │  │
│   │ • Analytics : sent, replied, meetings booked          │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Composants à construire

### C1. Gmail Send Service (`lib/gmail-send.ts`)

```typescript
// Interface
interface SendEmailParams {
  accessToken: string;        // OAuth token du user
  to: string;                 // email destinataire
  subject: string;
  body: string;               // HTML body
  threadId?: string;          // pour follow-up dans même thread
  inReplyTo?: string;         // message-id du précédent
}

interface SendResult {
  messageId: string;          // Gmail message ID
  threadId: string;           // Gmail thread ID
  labelIds: string[];
}
```

Utilise `gmail.users.messages.send` avec un raw RFC 2822 message.
L'OAuth token vient de la table `auth_accounts` (déjà stocké par
NextAuth quand le user connecte Google).

**Contraintes :**
- Max 50 emails/jour par mailbox (configurable en settings)
- Min 60s entre chaque envoi (éviter le burst)
- Pas d'envoi le weekend (configurable)
- Pas d'envoi si le contact a déjà répondu
- Pas d'envoi si le contact est opt-out

### C2. Outbound Emails Table (`db/schema.ts`)

```sql
CREATE TABLE outbound_emails (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT NOT NULL,
  enrollment_id UUID REFERENCES sequence_enrollments(id),
  contact_id    UUID REFERENCES contacts(id),
  step_number   INTEGER NOT NULL,
  
  -- Content
  subject       TEXT NOT NULL,
  body_html     TEXT NOT NULL,
  body_text     TEXT,
  
  -- Gmail tracking
  gmail_message_id  TEXT,        -- après envoi
  gmail_thread_id   TEXT,        -- pour follow-ups
  
  -- Status
  status        TEXT NOT NULL DEFAULT 'draft',
  -- draft → queued → sending → sent → bounced → replied
  
  -- Events
  sent_at       TIMESTAMPTZ,
  opened_at     TIMESTAMPTZ,     -- si on track (optionnel)
  replied_at    TIMESTAMPTZ,
  bounced_at    TIMESTAMPTZ,
  
  -- Reply data
  reply_classification TEXT,     -- positive/negative/ooo/unsubscribe
  reply_message_id     TEXT,
  
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outbound_status ON outbound_emails(status);
CREATE INDEX idx_outbound_thread ON outbound_emails(gmail_thread_id);
CREATE INDEX idx_outbound_enrollment ON outbound_emails(enrollment_id);
```

### C3. Sequence Executor (Inngest)

```typescript
// Cron job : toutes les 5 minutes
inngest.createFunction(
  { id: "execute-sequence-steps" },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    // 1. Trouver les enrollments dont next_step_at <= NOW
    //    ET status = 'active'
    
    // 2. Pour chaque enrollment :
    //    a. Charger le step template
    //    b. Charger le contact + company enrichment (Apollo data)
    //    c. Charger l'historique d'interactions (Gmail sync data)
    //    d. Appeler Claude pour personnaliser
    //    e. Créer outbound_email en status = 'draft' ou 'queued'
    
    // 3. Si mode REVIEW → status = 'draft' (user approuve)
    //    Si mode AUTOPILOT → status = 'queued' (envoi auto)
    
    // 4. Traiter la queue d'envoi :
    //    a. Vérifier rate limit (< 50/jour)
    //    b. Vérifier délai depuis dernier envoi (> 60s)
    //    c. Appeler Gmail Send API
    //    d. Stocker message_id + thread_id
    //    e. Mettre à jour enrollment (currentStep++, nextStepAt)
    //    f. Créer activity record
  }
);
```

### C4. Reply Matcher (Inngest)

```typescript
// Se greffe sur le Gmail Sync existant
// Quand un email entrant est détecté :

inngest.createFunction(
  { id: "match-reply-to-sequence" },
  { event: "email/received" },
  async ({ event, step }) => {
    const { threadId, from, subject, body } = event.data;
    
    // 1. Chercher un outbound_email avec ce thread_id
    const outbound = await db.select()
      .from(outboundEmails)
      .where(eq(outboundEmails.gmailThreadId, threadId))
      .limit(1);
    
    if (!outbound) return; // pas une réponse à une séquence
    
    // 2. Classifier la réponse avec Claude
    const classification = await classifyReply(body);
    // → positive | negative | ooo | unsubscribe | question
    
    // 3. Mettre à jour l'outbound email
    await db.update(outboundEmails).set({
      repliedAt: new Date(),
      replyClassification: classification,
      replyMessageId: event.data.messageId,
    });
    
    // 4. Agir selon la classification
    switch (classification) {
      case "positive":
        await pauseEnrollment(outbound.enrollmentId);
        await createActivity("reply_positive", ...);
        // → Notification au user : "Sarah Chen a répondu positivement !"
        break;
      case "negative":
      case "unsubscribe":
        await stopEnrollment(outbound.enrollmentId);
        await markContactOptOut(outbound.contactId);
        break;
      case "ooo":
        await rescheduleEnrollment(outbound.enrollmentId, 7);
        break;
      case "question":
        await pauseEnrollment(outbound.enrollmentId);
        // → Notification : "Sarah Chen a une question, réponds manuellement"
        break;
    }
  }
);
```

### C5. Review Queue (UI)

Page `/sequences/[id]/review` :

```
┌─────────────────────────────────────────────────┐
│ Review Queue — "Enterprise Outreach" sequence    │
│ 12 emails pending review                         │
├─────────────────────────────────────────────────┤
│                                                  │
│ ┌─ Email 1 ──────────────────────────────────┐  │
│ │ To: sarah@meridianlabs.io                   │  │
│ │ Subject: Quick question about your API...   │  │
│ │ ┌───────────────────────────────────────┐   │  │
│ │ │ Hi Sarah,                              │   │  │
│ │ │                                        │   │  │
│ │ │ Saw Meridian Labs raised their Series  │   │  │
│ │ │ A — congrats! Given your CTO role...   │   │  │
│ │ │ [editable rich text]                   │   │  │
│ │ └───────────────────────────────────────┘   │  │
│ │                                              │  │
│ │ [✓ Approve & Send]  [✏️ Edit]  [✗ Skip]     │  │
│ └──────────────────────────────────────────────┘  │
│                                                  │
│ ┌─ Email 2 ──────────────────────────────────┐  │
│ │ To: james@novatech.dev                      │  │
│ │ ...                                         │  │
│ └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### C6. Deliverability Dashboard (réel)

Remplacer les métriques fake par des vraies :

```
Sent     = COUNT outbound_emails WHERE status = 'sent'
Replied  = COUNT outbound_emails WHERE replied_at IS NOT NULL
Bounced  = COUNT outbound_emails WHERE status = 'bounced'
Reply Rate = replied / sent
Bounce Rate = bounced / sent

Health Score = 
  - Base 100
  - Bounce rate > 5% → -30
  - Reply rate < 2% → -20
  - Sent > daily_limit × 0.9 → -10 (pushing limits)
  - 0 bounces this week → +10
```

## Dépendances externes

| Service | Rôle | Status | Action |
|---------|------|--------|--------|
| **Gmail API** (send) | Envoyer les emails | OAuth existe, send pas implémenté | Implémenter `gmail.users.messages.send` |
| **Gmail API** (read) | Détecter les réponses | ✅ FONCTIONNE | Ajouter thread matching |
| **Apollo.io** | Enrichissement réel | MCP dispo, pas connecté | Authentifier + intégrer |
| **Inngest** | Job scheduler | ✅ FONCTIONNE | Ajouter cron séquence |
| **Claude** | Personnalisation + classification | ✅ FONCTIONNE | Garder pour rédaction uniquement |

## Ce qui N'EST PAS nécessaire

- ❌ Resend / SendGrid / SES — on envoie via le Gmail du user
- ❌ SPF/DKIM/DMARC setup — c'est le Gmail du user, déjà configuré
- ❌ Warm-up — mailbox existante, déjà warm
- ❌ Mailbox rotation — founder-led = 1 mailbox
- ❌ Open tracking pixel — tue la deliverability, pas nécessaire
- ❌ Domaine dédié — on utilise le domaine du user

## Rate Limits & Safety

```
HARD LIMITS (non configurable) :
- Max 100 emails / jour / mailbox (Gmail limit ~500 mais on reste safe)
- Min 45 secondes entre chaque envoi
- Max 3 follow-ups par contact par séquence
- Stop immédiat si bounce rate > 10% sur les 24h
- Jamais d'envoi à un contact qui a répondu
- Jamais d'envoi à un contact opt-out

SOFT LIMITS (configurable en Settings > Agent) :
- Max emails/jour : défaut 50
- Heures d'envoi : défaut 8h-18h fuseau du user
- Jours d'envoi : défaut Lun-Ven
- Mode : Review (défaut) ou Autopilot
- Autopilot min score : défaut 70
```

## Schema des statuts

```
Enrollment:
  enrolled → active → paused → completed
                   → stopped (reply/unsubscribe/manual)

Outbound Email:
  draft → queued → sending → sent → replied
                           → bounced
       → skipped (user skip dans review queue)

Contact:
  active → opted_out (unsubscribe)
        → bounced (email invalid)
```

## Ordre d'implémentation

1. **Table outbound_emails** — migration DB
2. **Gmail Send Service** — lib/gmail-send.ts
3. **Rewire sendSequenceStep** — remplacer le log→DB par Gmail Send
4. **Reply Matcher** — greffer sur Gmail Sync
5. **Review Queue UI** — page /sequences/[id]/review
6. **Rate Limiter** — middleware avant chaque envoi
7. **Real Deliverability** — dashboard basé sur outbound_emails
8. **Safety stops** — bounce spike, opt-out, compliance
