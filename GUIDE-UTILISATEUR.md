# Guide de l'application — Bénef

Ce guide explique ce que veut dire chaque carte, chaque chiffre et chaque écran
de l'application (mobile et web sont pareils dans le fond, juste rangés
différemment). Il part du principe que tu ne connais pas le jargon comptable —
tout est expliqué avec des mots simples et un exemple chiffré.

## Sommaire

1. [Le concept en bref](#1-le-concept-en-bref)
2. [Le glossaire — les mots que tu vois partout](#2-le-glossaire--les-mots-que-tu-vois-partout)
3. [Écran : Mes activités](#3-écran--mes-activités)
4. [Écran : Tableau de bord d'une activité](#4-écran--tableau-de-bord-dune-activité)
5. [Modifier ou annuler une opération](#5-modifier-ou-annuler-une-opération)
6. [Écran : Nouvelle opération (entrée / sortie)](#6-écran--nouvelle-opération-entrée--sortie)
7. [Écran : Nouvelle vente](#7-écran--nouvelle-vente)
8. [Écran : Produits & stock](#8-écran--produits--stock)
9. [Écran : Vue globale (mobile) / Tableau de bord (web)](#9-écran--vue-globale-mobile--tableau-de-bord-web)
10. [Écran : Tiers & dettes](#10-écran--tiers--dettes)
11. [Écran : Rapports / Compte de résultat (web)](#11-écran--rapports--compte-de-résultat-web)
12. [Écran : Paramètres](#12-écran--paramètres)
13. [Questions fréquentes](#13-questions-fréquentes)

---

## 1. Le concept en bref

- Une **activité** = tout ce que tu fais qui touche à l'argent : une boutique,
  un salaire, un taxi, un champ, les dépenses de la maison…
- Chaque activité a ses **entrées d'argent** (ce qui rentre) et ses **sorties
  d'argent** (ce qui sort), et éventuellement des **modules** :
  - **Inventaire** : tu vends des produits, l'app suit ton stock
  - **Crédits & dettes** : tu vends ou achètes « à crédit » (paiement plus tard)
  - **Budget** : tu prévois un montant et tu compares au réel (pas encore d'écran dédié)
- La **vue globale** additionne toutes tes activités pour te dire, en un coup
  d'œil, combien tu as gagné net et ce que tu possèdes réellement.
- **Astuce de saisie** : partout où tu tapes un montant, les chiffres se
  regroupent par milliers pendant que tu écris (`1000` s'affiche `1 000`) pour
  que ce soit plus facile à relire — tu peux toujours saisir une virgule ou
  un point pour les centimes.

---

## 2. Le glossaire — les mots que tu vois partout

### Les mots d'argent qui rentre / sort

| Mot | Ce que ça veut dire |
|---|---|
| **Chiffre d'affaires (CA)** | Tout l'argent que l'activité a fait rentrer sur la période choisie (ventes + entrées simples). C'est du **brut** : avant d'enlever quoi que ce soit. |
| **Coût des ventes** *(si module Inventaire)* | Ce que t'ont **coûté à l'achat** les produits que tu as vendus sur la période. Pas ce qu'ils t'ont rapporté — ce qu'ils t'ont coûté. |
| **Marge brute** | `Chiffre d'affaires − Coût des ventes`. Ce qu'il te reste après avoir « remboursé » la marchandise vendue. |
| **Charges** | Tes **dépenses de fonctionnement** sur la période : loyer, salaires, transport, électricité, etc. ⚠️ Ça **n'inclut pas** l'argent dépensé pour acheter/réapprovisionner ta marchandise — ça, c'est compté à part (voir Coût des ventes et Valeur du stock ci-dessous), pas comme une charge. |
| **Bénéfice net** | `Marge brute − Charges`. C'est **le vrai résultat** : ce que l'activité t'a rapporté sur la période, une fois tout compté. Pour une activité sans inventaire (salaire, ménage…) c'est simplement `Entrées − Sorties`. |
| **Consommé personnellement** *(si module Inventaire)* | La valeur (au coût) de la marchandise que tu as **gardée pour toi** au lieu de la vendre. Affiché à part, **jamais compté dans le Bénéfice net** (ni comme du CA, ni comme une charge) — voir l'écran Produits & stock. |

### Les mots de ce que tu possèdes (pas liés à une période)

Ces chiffres-là **ne changent pas** quand tu changes le sélecteur jour /
semaine / mois / année — contrairement à ceux du dessus, ce sont des soldes
« à l'instant T », pas des totaux sur une période.

| Mot | Ce que ça veut dire |
|---|---|
| **Caisse** | L'argent réellement disponible pour cette activité, **depuis le début** (solde de départ + tout ce qui est vraiment entré − tout ce qui est vraiment sorti). Une vente à crédit pas encore payée n'y est pas encore comptée. |
| **Valeur du stock** *(si module Inventaire)* | Ce que vaut, au prix d'achat, tout ce qu'il te reste en stock aujourd'hui. |
| **Patrimoine** *(vue globale)* | `Caisse + Valeur du stock + Créances − Dettes`. Tout ce que tu possèdes, toutes activités confondues. |

### Les mots liés au crédit

| Mot | Ce que ça veut dire |
|---|---|
| **Vente/opération « à crédit »** | L'argent n'est pas encore payé, mais tu comptes quand même la vente dans ton chiffre d'affaires (c'est déjà « gagné », juste pas encore en poche). |
| **Créances — « on me doit »** | Le total des ventes à crédit que tes clients ne t'ont pas encore payées. |
| **Dettes — « je dois »** | Le total des achats à crédit que tu n'as pas encore payés à tes fournisseurs. |
| **Règlement** | Le moment où une vente/achat à crédit est (au moins en partie) payé — ça fait bouger la caisse, mais ça ne recompte pas dans le chiffre d'affaires ni les charges (déjà comptés au moment de l'opération). Un règlement peut être **partiel**, aussi bien pour une **créance** (un client te doit 100 000, n'en paie que 80 000 maintenant, les 20 000 restants restent en attente) que pour une **dette** (tu dois 100 000 à un fournisseur, tu ne peux lui payer que 80 000 maintenant, le reste attend un prochain règlement). |
| **Solde initial (report)** | Une créance ou une dette qui existait déjà **avant** que tu commences à utiliser l'appli, saisie à la création d'un tiers. Compte dans le solde du tiers dès le départ, mais jamais dans le chiffre d'affaires ni les charges (ce n'est pas une opération de la période) — seul son règlement fait bouger la caisse. |

### Les mots de devise

| Mot | Ce que ça veut dire |
|---|---|
| **Devise principale** | La devise de référence de ton compte (par défaut le GNF). Sert de base pour la vue globale. |
| **Devise d'affichage** | La devise dans laquelle tu choisis de **voir** tes totaux (GNF, XOF, USD, EUR). La conversion se fait toute seule, au taux du jour. |
| **Devise d'une activité** | Chaque activité a sa propre devise (utile si un salaire est payé en XOF et une boutique tenue en GNF, par ex.). |

---

## 3. Écran : Mes activités

La liste de toutes tes activités.

- **Bandeau du haut** : ton bénéfice net total du mois, toutes activités confondues.
- **Chaque carte d'activité** : son nom, son type, les modules actifs
  (badges *Inventaire*, *Dettes*…), et son bénéfice net du mois.
- **+ Nouvelle activité** : crée une activité (nom, type, devise, modules à activer,
  solde de caisse de départ si tu as déjà de l'argent en réserve pour cette activité).
- **Archiver / désarchiver** : depuis le tableau de bord d'une activité, « Archiver
  cette activité » la retire de la liste sans rien effacer (ses données restent
  consultables). Pour la faire réapparaître : Réglages/Paramètres → **Activités
  archivées** → Réactiver.

---

## 4. Écran : Tableau de bord d'une activité

L'écran principal, celui qui a créé la confusion — détail carte par carte.

**Sélecteur de période** (Jour / Semaine / Mois / Année) + flèches ‹ › : change
la période sur laquelle sont calculés le CA, le coût des ventes, la marge, les
charges et le bénéfice net. **Ne change pas** la caisse ni la valeur du stock
(voir plus haut, et la FAQ).

**Les cartes de chiffres**, dans l'ordre où elles apparaissent :

| Carte | Formule | Bouge avec la période ? |
|---|---|---|
| Bénéfice net (grande carte) | Marge brute − Charges | ✅ oui |
| Chiffre d'affaires | somme des entrées (ventes + simples) | ✅ oui |
| Coût des ventes *(si Inventaire)* | quantité vendue × coût d'achat | ✅ oui |
| Marge brute *(si Inventaire)* | Chiffre d'affaires − Coût des ventes | ✅ oui |
| Charges | somme des sorties simples (hors achats de stock) | ✅ oui |
| Consommé personnellement *(si Inventaire)* | quantité gardée pour toi × coût d'achat moyen — hors Bénéfice net | ✅ oui |
| Valeur du stock *(si Inventaire)* | stock actuel × coût d'achat moyen | ❌ non — c'est une photo d'aujourd'hui |
| Caisse | solde de départ + tout l'argent réellement encaissé/décaissé depuis toujours | ❌ non — c'est un solde cumulé |

**Graphique « Évolution du bénéfice »** : le bénéfice net des 6 derniers mois,
en barres — pour voir la tendance d'un coup d'œil.

**Boutons d'action** :
- **+ Vente** *(si Inventaire)* → vend un ou plusieurs produits, le stock baisse tout seul
- **+ Opération** → enregistre une entrée ou une sortie d'argent simple (loyer, transport, une prestation, etc.)
- **+ Réappro** *(si Inventaire, web seulement en direct)* → t'envoie vers Produits & stock

**Dernières opérations** : les mouvements d'argent les plus récents de cette
activité, avec un badge *« à crédit »* si pas encore payé. **Touche une opération**
pour voir son détail, changer sa catégorie/son moyen de paiement/sa note, la
marquer comme réglée, ou l'**annuler** (voir « Modifier ou annuler une opération »
plus bas).

**Modules** (côté droit sur le web, écran séparé « Activité & modules » sur
mobile) : active ou désactive Inventaire / Crédits & dettes / Budget à tout moment.

---

## 5. Modifier ou annuler une opération

Comme il s'agit d'argent réel, l'app se comporte comme une vraie comptabilité :
**une opération ne se supprime jamais** — elle s'**annule**. Ça garde une trace
de tout (utile si tu dois te souvenir de ce qui s'est passé, ou justifier tes
chiffres), et ça évite les erreurs de calcul.

En touchant/cliquant une opération, tu peux :

- Pour une **vente**, voir le **détail** : quels produits, quelle quantité,
  à quel prix chacun.
- **Modifier** la catégorie, le moyen de paiement, le tiers ou la note à tout
  moment.
- **Marquer comme réglée** si c'était à crédit et que l'argent vient d'arriver/de
  partir.
- **Annuler** l'opération (avec un motif facultatif, ex. « erreur de saisie »).
  Elle reste visible dans l'historique, barrée, mais ne compte plus dans aucun
  calcul (chiffre d'affaires, charges, caisse…). Une **vente annulée** remet
  automatiquement le stock. Un **réapprovisionnement** ne peut être annulé que
  s'il n'y a pas eu de mouvement de stock plus récent sur ce produit depuis
  (sinon ça fausserait le coût moyen) — dans ce cas, corrige avec un nouveau
  réapprovisionnement plutôt.

⚠️ **Le montant, la devise, le sens et la date ne se modifient jamais** une fois
l'opération créée — c'est volontaire. Si tu t'es trompé sur l'un de ces points,
annule l'opération et ressaisis-la correctement.

---

## 6. Écran : Nouvelle opération (entrée / sortie)

Pour enregistrer un mouvement d'argent simple (pas une vente de produit) :
un loyer payé, un salaire reçu, une prestation facturée, du transport, etc.

- **Entrée / Sortie** : dans quel sens va l'argent
- **Montant**, **Catégorie** (Transport, Loyer, Salaires…), **Moyen de
  paiement** (Espèces, Orange Money, Wave, Banque)
- **Date**
- **À crédit** *(si module Dettes actif)* : coche si l'argent n'est pas encore
  échangé — choisis alors le client ou le fournisseur concerné

---

## 7. Écran : Nouvelle vente

*(uniquement si le module Inventaire est actif)*

- Cherche un produit, indique la quantité vendue (le prix de vente du produit
  s'applique automatiquement) — la quantité peut se saisir avec les boutons
  **−**/**+** ou directement **au clavier**
- Le **total** se calcule tout seul en bas
- **Moyen de paiement**, et **vente à crédit** si le client paiera plus tard
- *(si en plus le module Dettes est actif et que la vente est à crédit)* :
  choisis ou crée le **client** — nom et numéro de téléphone, tous les deux
  **facultatifs**, mais utiles pour savoir qui te doit quoi le jour où tu dois
  réclamer une créance (le numéro, s'il est renseigné, doit être un numéro
  mobile guinéen valide — 9 chiffres commençant par 61, 62, 65 ou 66, voir
  l'écran Tiers & dettes)
- **Montant payé maintenant** *(facultatif, vente à crédit)* : si le client
  paie une partie tout de suite — par exemple 80 000 sur une vente de
  100 000 — indique ce montant ici. Le chiffre d'affaires compte quand même
  la vente en entier, la caisse n'encaisse que ce qui est vraiment payé
  maintenant, et les 20 000 restants deviennent la créance du client (à
  régler plus tard, en une ou plusieurs fois, depuis sa fiche dans Tiers &
  dettes ou depuis le détail de l'opération)
- En validant : le stock des produits vendus baisse automatiquement, et la
  vente apparaît dans les opérations de l'activité

---

## 8. Écran : Produits & stock

*(uniquement si le module Inventaire est actif)*

- **Valeur du stock** et **nombre de références** en haut
- Filtres **Tous / Stock faible / Rupture / Archivés**
- Chaque produit : prix d'achat (coût moyen), prix de vente, marge, quantité
  en stock
- **+ Nouveau produit** : juste un nom, une unité et (au choix) un seuil
  d'alerte de stock — **pas de prix à saisir ici**. Ça n'aurait pas de sens de
  fixer un prix de vente avant même de savoir à combien tu achèteras le
  produit : le prix d'achat et le prix de vente se règlent tous les deux au
  **premier réapprovisionnement**
- **Réapprovisionner** un produit : indique la quantité achetée, le **coût
  d'achat unitaire**, et les **frais annexes** de ce lot si besoin (transport,
  douane… — un montant total pour tout le lot, pas par unité, réparti
  automatiquement). Le **coût de revient** (achat + part de frais par unité)
  sert à deux choses :
  - il entre dans le **coût moyen pondéré** du produit, comme le prix d'achat
    seul le faisait avant (le transport pour amener la marchandise fait
    partie de son coût réel, pas une charge séparée)
  - l'appli **propose un prix de vente** à partir de ce coût de revient et
    d'une **marge** (30 % par défaut la première fois, sinon la marge que tu
    appliques déjà sur ce produit). Cette marge est **modifiable** si elle ne
    te convient pas — et tu peux aussi corriger directement le prix de vente
    proposé, la marge affichée s'ajuste alors toute seule pour rester juste.
    Le prix retenu s'applique au produit une fois le réappro validé
  - *(si le module Dettes est actif)* : **achat à crédit**, avec les mêmes
    options que pour une vente à crédit — choisis ou crée le **fournisseur**,
    et indique un **montant payé maintenant** si tu paies une partie tout de
    suite (le reste devient ta dette envers lui, réglable plus tard en une ou
    plusieurs fois depuis sa fiche dans Tiers & dettes)
- **Modifier** un produit : nom, unité, prix de vente, seuil d'alerte — pour
  corriger le prix de vente en dehors d'un réappro (ex. la concurrence a
  changé ses prix). Le prix d'achat (coût moyen) et le stock ne se modifient
  pas ici — ils se mettent à jour tout seuls avec les réapprovisionnements,
  ventes et « Gardé pour moi »
- **Archiver** un produit : comme pour une activité ou un tiers, un produit ne
  se **supprime** jamais (son historique de stock et de ventes doit rester
  consultable) — tu peux juste l'archiver pour qu'il disparaisse des listes
  actives, et le réactiver depuis le filtre « Archivés »
- **Gardé pour moi** : pour retirer du stock une quantité que tu as
  **consommée toi-même** (ou ta famille) au lieu de la vendre — indique juste
  la quantité. Valorisé automatiquement au coût moyen du produit (pas de prix
  ni de moyen de paiement à saisir, ce n'est pas une vente). Ça baisse le
  stock et sa valeur, mais **ne compte ni comme du chiffre d'affaires, ni
  comme une charge** — ça apparaît juste à part, sous « Consommé
  personnellement », pour que tu comprennes pourquoi ton stock a baissé sans
  que ton Bénéfice net en soit affecté

---

## 9. Écran : Vue globale (mobile) / Tableau de bord (web)

La consolidation de **toutes** tes activités.

- **Sélecteur de devise** (GNF / XOF / USD / EUR) : bascule l'affichage, la
  conversion se fait automatiquement au taux du jour et ton choix est
  mémorisé.
- **Revenu net total** : le bénéfice net de toutes tes activités additionnées,
  sur la période choisie.
- **Patrimoine** : caisse + valeur du stock + créances − dettes, toutes
  activités confondues.
- **Résultat par activité** : quelle activité rapporte le plus / le moins.
- **Alertes de stock** *(web)* : les produits en rupture ou stock faible,
  toutes activités avec inventaire confondues.
- **On me doit** *(web)* : tes plus grosses créances clients.
- **Dernières transactions** *(web)* : les derniers mouvements, toutes
  activités confondues.

---

## 10. Écran : Tiers & dettes

*(uniquement pour les activités avec le module Dettes actif — sur mobile,
c'est l'onglet « Tiers »)*

- **On me doit** (créances) et **Je dois** (dettes) en haut
- La liste de tes clients/fournisseurs avec leur solde : positif = il te
  doit de l'argent, négatif = tu lui en dois
- **+ Nouveau tiers** : tu peux aussi en créer un directement depuis les
  écrans de vente/opération à crédit
- Le **numéro de téléphone** reste facultatif, mais s'il est renseigné il
  doit être un numéro mobile guinéen valide : **9 chiffres**, en commençant
  par **61**, **62**, **65** ou **66** (Orange, Cellcom ou MTN — ex.
  `622 12 34 56`)
- **Ce tiers a-t-il déjà un solde ?** *(à la création d'un tiers)* : pour
  enregistrer une créance ou une dette qui existait **avant** que tu
  commences à utiliser l'appli (ex. un client qui te devait déjà 40 000 GNF).
  Précise le **montant**, le **sens** (« Il/elle me doit » ou « Je lui dois »)
  et l'activité concernée. Ce solde de départ compte tout de suite dans le
  solde du tiers, mais **pas** dans le chiffre d'affaires ni les charges de
  la période — seulement quand tu le règles, la caisse bouge (voir « Solde
  initial » dans le glossaire)
- **Touche un tiers** pour voir sa fiche : ses coordonnées, son solde, la liste
  de ses **opérations à régler** (avec un bouton « Marquer réglé » sur chacune),
  et l'historique de ce qui a déjà été soldé ou annulé avec lui
- **Modifier** un tiers : depuis sa fiche, tu peux corriger son nom, son
  numéro, son type (client/fournisseur) et sa note à tout moment
- **Marquer réglé** ouvre un petit formulaire au lieu de valider tout de
  suite : le montant est pré-rempli avec ce qu'il reste à devoir, mais tu
  peux le réduire pour un **règlement partiel** (le client ne paie qu'une
  partie maintenant, le reste continue d'apparaître dans « à régler »)

---

## 11. Écran : Rapports / Compte de résultat (web)

Le document présentable façon comptable, avec un vrai **fichier PDF**
téléchargeable (« Télécharger en PDF ») — pas une impression de navigateur.

- Choisis une activité (ou « Toutes les activités » pour un rapport consolidé)
  et une période
- Le document reprend, dans l'ordre : Chiffre d'affaires → Coût des
  marchandises vendues → **Marge brute** → Charges d'exploitation →
  **Bénéfice net**, avec la marge nette en %
- **Indicateurs** à droite : trésorerie (caisse), valeur du stock, créances
  et dettes en cours, et — si tu en as ce mois-ci — la valeur consommée
  personnellement (hors calcul du Bénéfice net, juste pour information)

---

## 12. Écran : Paramètres

- **Photo de profil** : ajoute ou change ta photo (mobile et web) — sans
  photo, tes initiales s'affichent à la place sur fond de couleur
- **Compte** : nom d'utilisateur, e-mail (nécessaire pour le mot de passe oublié — voir plus bas)
- **Activités archivées** : la liste de tes activités archivées, avec un bouton
  « Réactiver » sur chacune
- **Devise principale** : la devise de référence de ton compte
- **Devise d'affichage** : dans quelle devise tu veux voir tes totaux (modifiable
  aussi directement depuis la Vue globale)
- Se déconnecter

---

## 13. Questions fréquentes

**Pourquoi la Caisse ne bouge pas quand je passe de « Mois » à « Année » ?**
Parce que la caisse n'est pas un total « sur la période » comme le chiffre
d'affaires ou les charges — c'est **le solde de tout l'argent réel, depuis le
tout début** de l'activité. C'est comme regarder combien il y a dans ton
porte-monnaie *maintenant*, peu importe la période que tu regardes à côté.

**Pourquoi mes achats de marchandise n'apparaissent pas dans « Charges » ?**
Parce qu'acheter du stock n'est pas une dépense « perdue » comme un loyer —
c'est transformer de l'argent en marchandise. Cet argent réapparaît dans
« Valeur du stock » tant que ce n'est pas vendu, puis dans « Coût des ventes »
au moment où c'est vendu. Le mettre aussi dans « Charges » compterait deux fois.

**J'ai gardé de la marchandise pour moi, pourquoi ça ne réduit pas mon Bénéfice net ?**
Parce que ce n'est pas une dépense de fonctionnement de ton commerce — c'est
toi qui profites de ta propre marchandise (ce qu'un comptable appelle un
« prélèvement »). Ça sort bien du stock (et de sa valeur), mais ça ne
compte ni comme du chiffre d'affaires (tu ne t'es rien vendu), ni comme une
charge. Tu le vois à part, sous « Consommé personnellement », pour
comprendre pourquoi ton stock a baissé sans confondre ça avec une perte ou
un vol.

**Pourquoi le Bénéfice net d'une activité sans Inventaire est différent ?**
Sans le module Inventaire, il n'y a pas de « Coût des ventes » à soustraire :
le bénéfice net, c'est simplement `Entrées − Sorties` (utile pour un salaire,
les dépenses de la maison, un taxi…).

**Une vente à crédit compte-t-elle dans mon Bénéfice net avant d'être payée ?**
Oui — dès la vente, elle compte dans le chiffre d'affaires et donc le
bénéfice net (tu l'as « gagnée »). Mais elle ne compte dans la **Caisse**
qu'une fois réglée (tu ne l'as pas encore en poche).

**J'ajoute un solde initial à un tiers, pourquoi ça ne change pas mon Chiffre
d'affaires ?**
Parce que ce solde ne correspond à aucune vente ou opération faite *dans*
l'appli — c'est juste le report d'une créance/dette qui existait déjà avant.
Le compter dans le CA de la période gonflerait artificiellement ton résultat
avec de l'argent qui n'a jamais transité par une vente enregistrée ici. Il
compte seulement dans le solde du tiers, et fera bouger la caisse le jour où
il sera réglé — exactement comme une vente à crédit ordinaire.

**J'ai changé ma devise d'affichage en USD, pourquoi certains montants
restent en GNF ?**
Les totaux globaux (bénéfice, patrimoine…) se convertissent automatiquement.
Mais le détail des tiers et les lignes individuelles de transactions restent
affichés dans la vraie devise de l'activité, pour ne jamais t'afficher un
montant mal converti.

**Pourquoi je ne peux pas supprimer une opération, juste l'annuler ?**
Parce qu'on parle d'argent réel : supprimer effacerait toute trace, alors
qu'annuler garde l'historique complet (utile pour comprendre ce qui s'est
passé) tout en sortant l'opération des calculs. Voir [Modifier ou annuler une
opération](#5-modifier-ou-annuler-une-opération). Même principe pour un
**produit** ou un **tiers** : on les archive, on ne les supprime pas — sinon
l'historique des ventes/dettes qui leur est lié perdrait tout son sens.

**J'ai activé « Crédits & dettes » sur une activité, mais je ne vois rien
changer — c'est normal ?**
Oui : contrairement à « Inventaire » (qui fait apparaître/disparaître des
cartes directement sur le tableau de bord de l'activité), l'effet de
« Crédits & dettes » se voit **ailleurs** — dans les écrans Nouvelle
vente/opération/réappro, qui proposent alors « à crédit » + le choix d'un
client ou fournisseur. Rien à voir sur le tableau de bord lui-même tant que tu
n'as pas encore fait d'opération à crédit sur cette activité.

**Et « Budget & prévision » ?**
Ce module n'a, pour l'instant, aucun écran dédié (pas encore construit) — le
toggle existe mais n'a effectivement aucun effet visible pour le moment.

**Pourquoi l'e-mail est-il obligatoire à l'inscription ?**
C'est le seul moyen actuel de récupérer ton compte si tu oublies ton mot de
passe (un code à 6 chiffres t'est envoyé). Sans e-mail enregistré, il faut
passer par l'administrateur de l'application pour réinitialiser un mot de
passe.
