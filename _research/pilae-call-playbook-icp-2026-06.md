# Playbook cold call Pilae — ICP « Suisse romande — large » (v1 — 2026-06-12)

Le playbook d'appel pour TOUT l'ICP vivant, pas seulement les fondations. Grounding :
dump live du tenant Pilae du 2026-06-12 (`_research/raw/pilae-icp-dump-2026-06-12.json`),
méthodo [[cold-call-methodology-kb]] (`cold-call-prep-playbook-2026-06.md` + `cold-call-exchange-top01-2026-06.md`),
déroulé canon Martin 2026-06-08 (`pilae-call-playbook-fondations-2026-06.md`),
défauts produit shipped (`app/apps/web/src/lib/call-mode/call-scripts.ts`).

---

## 0. L'état réel (2026-06-12) — sur quoi ce playbook s'appuie

**ICP actifs en base** (le reste est soft-deleted) :
- **« Suisse romande — large »** (priorité 0) — le cœur, couvert par ce playbook. Tout le tissu romand 1-1000 FTE (VD, GE, NE, FR, VS, JU), 58 industries, 13 titres décideurs.
- « France — prospection initiale » (priorité 2) — legacy, « majoritairement hors cœur de cible ». Mêmes 5 temps si on l'appelle ; conformité FR au §8.
- Supprimés les 10-11 juin : « Scale-up Tech / SaaS B2B », « Finance suisse tech-native », « Coeur romand — fondations, santé & parapublic » (absorbé par le filet large).

**Les 13 titres cibles** (vocabulaire exact `person_titles`, deux familles) :
direction générale — CEO, Founder, Owner, Managing Director, General Manager, President, Executive Director, Secretary General ; filière IT — CTO, CIO, IT Director, Head of IT, IT Manager.

**Le stock vivant** : 889 comptes, 212 contacts (210 avec persona résolue), **2 contacts avec téléphone**. C'est le bloquant n°1 — §9.

**Réglages tenant** : salesMotion « Founder-led sales », ton « Direct », posture script `consultative` par défaut (le bon réglage pour ce tissu). `productDescription` est **vide** en base → la banque d'objections personnalisée et le script tenant LLM ne se génèrent pas (fallbacks neutres) — §9.

---

## 1. L'offre (l'ancre du naturel) — et ce qu'on ne dit jamais

**Pilae installe et opère le meilleur open-source à la place des SaaS payés cher.** Service niveau éditeur (vous ne touchez à rien), données hébergées en Suisse / Europe (réversibles, hors Cloud Act), facture bien plus légère (on rend la marge de l'éditeur). Outils du quotidien : IA interne privée (OpenWebUI), automatisation (n8n), bases/applis internes (NocoDB), transcription de réunions, collaboration, BI, signature électronique.

Jamais :
- une certification que Pilae n'a pas (ISO 27001, SOC 2, SecNumCloud…) ; le vrai : hébergement Suisse/UE, capital européen, réversibilité, hors Cloud Act ;
- la peur réglementaire — « conforme ≠ souverain », on éclaire sans dramatiser ; s'ils sont déjà souverains, le reconnaître et lâcher ;
- « IA 100 % souveraine » si la brique repose sur un modèle US — préciser Mistral (EU) ou opt-in explicite ;
- un chiffre d'économie inventé : l'ordre de grandeur sort du cas du prospect, en rendez-vous.

---

## 2. Le déroulé canon — 5 temps, invariant sur tout l'ICP

Ce sont les défauts shipped dans Call Mode (`call-scripts.ts`), éditables par secteur. Verbatims exacts :

**1. Ouverture (permission gate, pas de pitch)**
> « Bonjour [Madame/Monsieur Nom], Martin Paviot, co-fondateur de Pilae. Est-ce que vous avez deux minutes ? »

Adresse formelle par défaut (Suisse romande, interlocuteurs seniors) ; prénom si scène tech, interlocuteur jeune ou anglophone genevois. Variante à A/B tester (watch-out du doc fondations) : coller quatre mots de raison — « …co-fondateur de Pilae. C'est au sujet de vos outils logiciels — vous avez deux minutes ? »

**Si non** (réponse lue, défaut produit) :
> « Aucun souci, c'est vous qui voyez. Juste pour comprendre — c'est le timing, ou le sujet ne vous parle pas du tout ? Si c'est le timing, je vous recontacte dans quelques mois ; sinon je ne vous embête pas, et merci d'avoir pris l'appel. »

**2. Enjeux sectoriels, UN par UN (≤ 3)** — hypothèse à valider, jamais une liste :
> « Merci. Je vous appelle parce qu'on croit comprendre que, dans votre secteur, [ENJEU n°1]. Est-ce que c'est un sujet chez vous en ce moment ? »

Si non → enjeu n°2, puis n°3, maximum. Si oui → réagir 10-15 s avec du concret, puis temps 3. Quand Call Mode a détecté un outil remplaçable chez eux, l'enjeu `{tool}` passe en premier (« Détecté chez eux ») — c'est l'accroche la plus forte : nommer un déclencheur double les chances de RDV (KB).

**3. Qualification légère (2-3 points, pas de la découverte)** — en une respiration, en réagissant :
> « Pour bien situer : aujourd'hui c'est géré en interne ou par un prestataire ? … Et ces outils, ça représente un budget annuel qui compte ? »

**4. Proposer la rencontre (~45 min, livrable annoncé)**
> « Très bien. Honnêtement, dans ce cas je pense qu'on a intérêt à se rencontrer : je viendrais avec une première lecture de ce que vous pourriez remplacer et l'écart de coût, et on aurait le temps d'approfondir — comptez 45 minutes. Vous seriez disponible plutôt en début ou en fin de semaine prochaine ? Rien à préparer de votre côté. »

**5. Booker en live**
> « Parfait, je vous envoie l'invitation tout de suite, vous me confirmez que vous l'avez reçue ? »

**Posture (rappels KB, pas lus en appel)** : l'appel vend le RDV, pas le produit ni la découverte — sur un cold call réussi le rep parle ~55 % ; UN enjeu vivide à la fois ; jamais « je vous prends à un mauvais moment ? » ; ton lent, posé, descendant (la seule phrase qui monte = la demande de permission) ; co-fondateur = niveau dirigeant, pas commercial ; décideur d'abord — être redirigé vers l'IT ou le métier, c'est gagné (demander l'intro nominative) ; ne pas chasser : moins on pousse, moins il résiste.

---

## 3. La matrice segments — tout le tissu romand réel

Mix réel des 889 comptes vivants, regroupé en 10 familles appelables. « Script produit » = ce que Call Mode sert AUJOURD'HUI via `pickCallScript` (les trous de matching → §9).

| # | Famille | Comptes | Script produit servi |
|---|---------|---------|----------------------|
| 1 | Éducation & recherche | ~88 | `generic` (aucune clé éducation) |
| 2 | Fondations & social | ~87 | `fondations` (nonprofit, philanthropie) ; civic/social et family services tombent en `generic` |
| 3 | Industrie & fabrication | ~79 | `low-tech` partiel (manufacturing) ; machinery, automotive, food → `generic` ; medical devices → `sante` (mauvais angle) |
| 4 | Négoce, retail & hospitality | ~77 | `low-tech` (retail) ; le reste → `generic` |
| 5 | IT & services | 75 | `generic` |
| 6 | Finance & assurance | ~74 | `generic` |
| 7 | Services professionnels | ~72 | `generic` |
| 8 | Construction & immobilier | ~57 | `low-tech` (construction) ; immobilier/architecture → `generic` |
| 9 | Santé & médico-social | ~45 | `sante` |
| 10 | Parapublic & administration | ~43 | `parapublic` (gov admin) ; utilities/transport → `generic` |

Pour chaque famille : enjeux rangés du plus probable au moins probable, validés UN par UN ; 2-3 points à qualifier ; une note. Les enjeux des familles fondations / santé / parapublic / industrie reprennent mot pour mot les défauts shipped.

### 3.1 Fondations & social (nonprofit 42, individual & family services 26, civic & social 19)
**Enjeux** :
1. le budget logiciels rogne sur des moyens qui devraient aller à la mission
2. vos données donateurs ou bénéficiaires vivent sur des outils américains dont vous ne maîtrisez pas l'hébergement
3. des abonnements comme {tool}, accumulés au fil du temps, qu'on pourrait remplacer à l'identique pour bien moins cher
**À qualifier** : combien d'outils en abonnement ? · qui gère l'IT (interne, prestataire, personne) ? · une échéance de contrat bientôt ?
**Note** : les 6 sous-secteurs (santé/médico-social, social/insertion, internationale/ONG-EN, philanthropique, recherche/bourses, culturelles) sont détaillés dans `pilae-call-playbook-fondations-2026-06.md` — c'est la version fine à utiliser quand le sous-secteur est connu.

### 3.2 Éducation & recherche (higher education 48, research 25, primary/secondary 15)
**Enjeux** :
1. les données élèves, étudiants ou candidats vivent sur des outils américains, au moment où la nLPD se durcit et où parents et conseils y sont sensibles
2. la facture licences par poste grimpe à chaque rentrée, sur une pile d'outils (admin, pédagogie, communication) qui ne se parlent pas
3. {tool} est en place par habitude, remplaçable à l'identique pour bien moins cher
**À qualifier** : qui gère l'IT (souvent une personne ou un prestataire) ? · budget licences annuel qui compte ? · une échéance ou une rentrée qui approche ?
**Note** : instituts de recherche → ajouter l'angle données de recherche et exigences des bailleurs sur la gestion des données ; écoles privées → la confidentialité vis-à-vis des parents pèse plus que le coût.

### 3.3 Industrie & fabrication (machinery 19, medical devices 19, automotive 13, electrical/electronic 12, food production 9, mechanical engineering 7)
**Enjeux** (défauts `low-tech`) :
1. un outil comme {tool} en place, qui ne suit plus vos besoins mais que c'est lourd de remplacer
2. des données dispersées entre plusieurs outils qui ne se parlent pas (production, qualité, Excel partout)
3. une facture logicielle qui grimpe à chaque renouvellement sans que personne ne pilote
**À qualifier** : combien d'outils en abonnement ? · qui gère l'IT en interne ? · une échéance de contrat proche ?
**Note** : appeler tôt le matin, avant la production (KB : ces acheteurs valorisent l'appel direct). Medical devices = des FABRICANTS : angle industrie (traçabilité, qualité), pas l'angle « données patients » que le produit sert aujourd'hui par erreur de matching.

### 3.4 Négoce, retail & hospitality (consumer goods 23, retail 14, hospitality 14, logistics 14, wholesale 12)
**Enjeux** :
1. des marges fines et une pile de petits SaaS (caisse, stock, planning, réservation) qui, mis bout à bout, pèsent lourd
2. {tool} reconduit chaque année sans remise en question, parce que personne n'a le temps de comparer
3. des données clients et fidélité sur des outils dont vous ne maîtrisez pas l'hébergement
**À qualifier** : combien d'outils en abonnement ? · qui gère ? · une échéance proche ?
**Note** : éviter les heures de service (midi, soir, week-end pour l'hôtellerie-restauration ; ouverture magasin pour le retail).

### 3.5 IT & services (75 comptes — le plus gros bloc, le moins cœur)
Les profils tech dédiés ont été supprimés le 10 juin : ce tissu reste dans le filet large, priorité basse. Deux angles honnêtes seulement :
1. leurs propres outils internes — eux aussi paient une pile de SaaS (CRM, support, gestion) remplaçable à l'identique
2. leurs clients à eux demandent de plus en plus d'hébergement suisse : un socle open-source opéré peut se revendre en marque blanche
**À qualifier** : éditeur ou intégrateur ? · des clients avec exigences de souveraineté ? · stack interne payée ou open-source déjà ?
**Note** : une partie de ce segment est concurrente (intégrateurs). Appeler seulement sur signal fort ({tool} détecté) ; sinon, dernier de la pile.

### 3.6 Finance & assurance (financial services 24, banking 21, investment management 13, capital markets 10, insurance 6)
**Enjeux** :
1. des données clients couvertes par le secret bancaire ou la LPD qui transitent par des outils collaboratifs américains
2. vos équipes utilisent déjà des IA publiques avec des données clients — une IA interne privée règle l'usage au lieu de l'interdire
3. une facture licences par poste reconduite chaque année sans point de comparaison
**À qualifier** : vos contraintes de conformité internes permettent-elles le cloud US ? · qui gère l'IT ? · budget par poste qui compte ?
**Note** : ton sobre, références, zéro sur-promesse — ne JAMAIS revendiquer une conformité FINMA ou bancaire. Si l'établissement est trop régulé pour bouger, qualifier vite et lâcher.

### 3.7 Services professionnels (management consulting 28, formation 18, marketing 10, staffing 9, legal 7)
**Enjeux** :
1. chaque heure passée en ressaisie entre outils est une heure non facturée — et la transcription de réunions, l'IA interne, l'automatisation rendent exactement ces heures-là
2. des dossiers clients confidentiels sur des outils américains (avocats, fiduciaires : le secret professionnel rend l'hébergement suisse concret)
3. une pile d'abonnements par collaborateur qui grossit à chaque embauche
**À qualifier** : combien d'outils par collaborateur ? · la confidentialité des dossiers, un sujet ? · qui gère l'IT ?
**Note** : cabinets d'avocats et fiduciaires = la porte d'entrée la plus naturelle du segment (secret professionnel).

### 3.8 Construction & immobilier (real estate 23, construction 19, architecture & planning 15)
**Enjeux** :
1. des outils métier (suivi de chantier, gérance, plans) facturés au poste, gardés par inertie alors que la facture grimpe
2. des données locataires ou clients et des documents éclatés entre mails, Excel et serveurs
3. une pression à digitaliser sans équipe interne pour le faire
**À qualifier** : qui gère l'IT ? · budget licences annuel ? · une échéance de contrat ?
**Note** : gérances → données locataires sensibles (nLPD) ; entreprises de chantier → joindre tôt le matin.

### 3.9 Santé & médico-social (hospital & health care 36, health/wellness 9)
**Enjeux** (défauts `sante`) :
1. vos données résidents ou patients transitent par des outils du quotidien hébergés aux États-Unis, au moment où la nLPD se durcit
2. vous payez {tool} et d'autres logiciels dont la facture grimpe à chaque renouvellement
3. peu de ressources internes pour remplacer un outil vieillissant sans risquer de tout casser
**À qualifier** : géré en interne ou par un prestataire IT ? · un budget logiciels annuel qui compte ? · des données sensibles dessus ?
**Note** : honnêteté — « conforme » ≠ « souverain » (Cloud Act), sans dramatiser. Déjà hébergés en Suisse en propre → le reconnaître et lâcher.

### 3.10 Parapublic & administration (government administration 18, international affairs 10, transport 9, utilities 6)
**Enjeux** (défauts `parapublic`) :
1. des systèmes comme {tool}, coûteux à maintenir et difficiles à faire évoluer
2. des données publiques ou citoyens hébergées hors de Suisse, alors que la pression à la souveraineté monte
3. une pression à digitaliser sans équipe projet dédiée en interne
**À qualifier** : géré en interne ou par un prestataire ? · budget licences annuel qui compte ? · des contraintes de souveraineté ou de marchés publics ?
**Note** : culture de procédures — cadrer la rencontre comme un diagnostic structuré, pas un call commercial. Respecter les règles d'achat ; en dessous des seuils, le gré à gré reste leur affaire, pas un argument à nous.

---

## 4. La couche persona — qui décroche, quel angle

Distribution réelle des 212 contacts vivants (un contact peut porter plusieurs labels) :

| Famille | Labels (volume) | L'angle qui porte |
|---|---|---|
| Direction générale (~150) | CEO 48 · Managing Director 37 · President 26 · Owner 21 · Executive Director 8 · Secretary General 7 · General Manager 2 · Founder 1 | Coût, risque, simplicité. Zéro vocabulaire technique. La décision est chez lui : la rencontre = « une lecture chiffrée de ce que vous payez et de l'écart ». |
| Filière IT (41) | CTO 16 · Head of IT 10 · CIO 5 · IT Director 5 · IT Manager 5 | Maîtrise, réversibilité, hébergement, charge d'exploitation. Sa crainte n°1 : « encore un truc à opérer » → la réponse vraie : Pilae opère, service niveau éditeur. |

Réglages fins :
- **Owner / President de PME** : registre patron — coût direct, bon sens, « on rend la marge de l'éditeur ».
- **Executive Director / Secretary General** : registre fondations — budget vs mission, confidentialité donateurs/bénéficiaires (voir doc fondations).
- **IT** : ne JAMAIS by-passer — s'il existe, il sera dans la boucle, et l'avoir contre soi tue le deal. On le traite en pair technique (réversibilité, stack, exploitation), pas en obstacle. À l'inverse, un DG qui redirige vers son IT = gagné : demander l'intro nominative.
- **Adresse** : « Madame/Monsieur [Nom] » par défaut ; prénom en scène tech ou anglophone genevoise (l'appel passe alors en anglais, cf. doc fondations).

---

## 5. Objections — ce que le cockpit chuchote, et les variantes Pilae à coller

Le coaching live couvre 10 classes (`coaching-playbook.ts`) : trop cher, pas le bon moment, déjà un fournisseur, pas de budget, pas décideur, pas le bon problème, envoyez un mail, content du setup, besoin d'infos, voyez avec quelqu'un d'autre. Tant que `productDescription` est vide, c'est le fallback NEUTRE qui est chuchoté — correct mais générique. Variantes ancrées Pilae, une respiration chacune, à coller dans Product & Voice (elles seedent la génération) :

- **« On a déjà un prestataire IT »** (la plus fréquente en romandie) : « Très bien, gardez-le — lui gère votre infrastructure, nous on remplace les licences qu'elle fait tourner. L'un n'empêche pas l'autre : côté licences, vous payez quoi aujourd'hui ? »
- **« On a déjà Microsoft / Google, ça nous va »** : « Beaucoup les gardent pour le mail et la bureautique — c'est tout ce qui s'empile autour qu'on remplace : l'IA interne, l'automatisation, les petites applis métier. Sur ces postes-là, vous payez quoi ? »
- **« Pas de budget »** (fondations surtout) : « C'est justement le point : on ne demande pas un budget en plus, on réduit celui qui existe déjà. La rencontre chiffre ce que vous payez — vous repartez avec la lecture, même sans suite. »
- **« C'est quoi le prix ? »** : « Ça dépend de ce qu'on remplace — c'est exactement ce que la première lecture met à plat. Pour un chiffre qui veut dire quelque chose : votre facture logicielle annuelle, vous la connaissez de tête ? »
- **« Envoyez-moi un mail »** : « Avec plaisir, je vous l'envoie. Pour qu'il ne finisse pas dans la pile : qu'est-ce qui vous ferait dire, en le lisant, que ça mérite un échange ? »
- **« Le cloud américain ne nous pose pas de problème »** : ne pas argumenter — « Très bien, alors la question est purement financière : à service égal, si l'écart de coût est significatif, ça vaut une lecture ? » S'ils sont à l'aise ET contents du coût, lâcher proprement.
- **« Je ne suis pas la bonne personne »** : « Merci, c'est précieux. Qui porte ce sujet chez vous ? … Vous préférez me mettre en relation, ou que je l'appelle en mentionnant notre échange ? »

Règle KB : tôt dans l'appel, ~90 % des objections sont des réflexes à l'interruption, pas des objections réelles — on accuse réception, une question facile, jamais un argumentaire.

---

## 6. Messagerie vocale & standard

**Voicemail** (8-14 s, maximum 2 par prospect ; sert surtout d'amorce multicanale — il booste la réponse email, KB) :
> « Bonjour [Madame/Monsieur Nom], Martin Paviot, co-fondateur de Pilae. Je vous appelle au sujet de vos outils logiciels — je vous envoie un mail, et je retenterai [moment]. Bonne journée. »

Le produit a les `voicemail_templates` (MP3 pré-enregistrés, variables `{{first_name}}` / `{{company}}`) : enregistrer cette version une fois, en français posé.

**Standard / secrétariat** (ne jamais pitcher le gatekeeper ; bref, calme, statut haut) :
> « Bonjour, vous pourriez m'aider ? Je cherche à joindre [Prénom Nom], c'est au sujet de leurs outils logiciels. Vous me le/la passez ? »

Puis silence — la brièveté assurée signale un appel attendu ; le transfert est la réponse par défaut.

---

## 7. Cadence & timing

- **Cadence produit** : 8 tentatives sur 15 jours (le moteur de campagne existant), dans la fourchette KB (6-8 touches dont 3-5 appels, resserrées au début puis espacées). Voicemail à partir du 2e sans-réponse, jamais plus de 2.
- **Double-dial** (Tier A seulement) : rappeler une fois dans la minute si pas de réponse — le décroché grimpe fortement au 2e appel rapproché (KB).
- **Créneaux romands** : 8h30-11h30 et 14h00-17h00. Éviter 12h00-13h30 (déjeuner tôt en Suisse), le lundi matin et le vendredi après-midi. Industrie et chantiers : encore plus tôt le matin. À re-mesurer sur nos propres dispositions après 2-3 semaines.
- **Priorité d'appel** : signal {tool} détecté > fit ICP haut > le reste. Ne jamais composer une liste non triée (KB).

---

## 8. Conformité (CH d'abord, FR pour le legacy)

**Suisse** : la prospection B2B est tolérée ; respecter la clause de l'astérisque de l'annuaire (LCD art. 3 — ne pas démarcher qui s'y est opposé) et la nLPD : source de chaque contact documentée (le produit trace la provenance d'enrichissement), lien entre l'offre et la fonction de la personne. Toute demande de ne plus être appelé → opt-out immédiat dans la `do_not_call_list` (couches tenant + global ; l'extraction automatique depuis le transcript — « retirez-moi de votre liste » — existe déjà).

**Enregistrement d'appel** : désactivé par défaut dans le produit — le laisser ainsi. En Suisse, enregistrer une conversation sans l'accord des participants est pénalement répréhensible (CP art. 179ter) : n'activer qu'avec consentement annoncé en début d'appel.

**France (ICP legacy)** : B2B sans opt-in possible, sur intérêt légitime, à trois conditions — intérêt proportionné, lien offre/fonction, source + base légale tracées. Pour mémoire : bascule B2C en opt-in strict au 11 août 2026 — sans impact B2B direct, mais prudence avec les indépendants en nom propre.

---

## 9. Pré-flight opérationnel — les bloquants réels au 2026-06-12

| # | Bloquant | État réel | Action |
|---|----------|-----------|--------|
| 1 | **Téléphones** | 2 contacts sur 212 ont un numéro | Vagues d'enrichissement Lusha (clé free = 100 appels/jour, seule source mobile CH ; Kaspr = FR only) : le stock actuel se traite en ~3 jours de vagues ; mesurer le hit-rate mobile CH. FullEnrich (bulk EU, webhook par `crm_contact_id`) est intégré mais attend clé prod + crédits. |
| 2 | **Appels vers la Suisse** | Twilio CH dialing OFF (geo-permissions) | `app/apps/web/scripts/_voice-enable-ch.ts` (creds Twilio + `NODE_EXTRA_CA_CERTS`) — active le low-risk CH en un run. |
| 3 | **Caller ID** | +33 6 38 34 52 31 (mobile FR vérifié) | Acheter un +41 via le From-number picker (le pool gère le local-presence par pays/indicatif). Un numéro local améliore le décroché (KB) ; un +33 qui appelle des fixes romands part avec un handicap. |
| 4 | **Product & Voice vide** | `productDescription` = "" en base | Remplir Settings → ICP → Product & Voice avec le §1 de ce doc. Déverrouille : banque d'objections personnalisée (`tenant-playbook.ts`) + script tenant LLM (`tenant-script.ts`). Posture : laisser `consultative`. |
| 5 | **Matching scripts par secteur** | Pas de clé éducation ; machinery / automotive / food / real estate / finance / services pro → `generic` ; medical devices → `sante` à tort | Backlog produit : étendre la résolution secteur→script en LLM sur les vrais labels (pattern `industry-match`, jamais de liste en dur). En attendant, les enjeux du §3 se collent à la main dans l'éditeur de script par secteur. |
| 6 | **Mesure** | Disposition modal + qualification post-call (MEDDPICC) déjà en place | Suivre : connects/dial, RDV/connect, présence au RDV. Attente honnête de départ (KB, scénario data mobile vérifiée) : ~70 dials par RDV tenu ; top performers 15-20. Re-caler après 200 dials. |

---

## 10. Branchement produit

- `call-scripts.ts` = les défauts par secteur (fondations, santé, parapublic, low-tech + générique) ; éditables par le rep dans Call Mode ; ce doc fournit les 6 familles manquantes (§3.2, 3.4-3.8) prêtes à coller.
- `tenant-script.ts` régénère les scripts depuis le produit + l'ICP du tenant via LLM — inerte tant que Product & Voice est vide (§9.4).
- La fiche Call Mode fournit déjà : Signaux en tête, brief prospect (parcours + résumé d'entreprise), avertissement collision pré-appel, contexte géo parlable. Le playbook suppose que le rep a la fiche sous les yeux : la préparation par compte est DANS le produit, pas dans un doc.
- Cadence : moteur de campagne 8x/15j ; dispositions et MEDDPICC post-call alimentent le CRM.

Méthodo complète : [[cold-call-methodology-kb]]. Sous-secteurs fondations : `pilae-call-playbook-fondations-2026-06.md`. Offre/ICP : [[project_pilae-icp-precise]]. Registre : [[outbound-natural-not-engineered]]. Infra voix : [[voice-cold-call]] · [[call-campaign-engine]].
