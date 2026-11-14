# Morceaux intégrés

L'application propose automatiquement tous les fichiers MIDI déposés dans ce dossier : vous êtes au bon endroit.

Pour en ajouter un :

1. « Add file » → « Upload files », déposer un ou plusieurs `.mid`, valider le commit.
2. Le morceau apparaît dans le menu « Morceaux intégrés » de l'app en une à deux minutes.

Le nom du fichier sert de libellé (« 01kyrie.mid » s'affichera « 01 Kyrie ») ;
espaces et accents bienvenus. Tout fichier non-MIDI est ignoré. Un morceau
écouté une fois est mis en cache par le service worker et reste disponible
hors ligne.

## Pistes et pupitres

L'app reconnaît la piste de chaque pupitre d'après son nom (« S », « S I »,
« SII », « So », « Soprano », « Canto », « A1 », « Tenore », « Basso », « B2 »…).
Quand on choisit son pupitre, sa piste est mise en avant automatiquement
(les autres jouent en fond). En double chœur, c'est le premier chœur qui est
choisi ; on peut toujours changer de piste à la main.

## Ajouter les paroles

Les paroles se mettent dans un fichier texte **du même nom que le MIDI**,
terminé par `.paroles.txt` :

```
01kyrie.mid
01kyrie.paroles.txt   ← paroles du Kyrie
```

Pour le créer sur GitHub : « Add file » → « Create new file », nom
`01kyrie.paroles.txt`, coller le texte, valider. Le menu des morceaux affiche
alors « · paroles » à côté du titre.

### Le principe : une syllabe par note

L'app pose **chaque syllabe sur une note de la piste du pupitre, dans
l'ordre**. Il n'y a donc aucun minutage à écrire : il suffit que le texte
corresponde aux notes.

```
# Les lignes qui commencent par # sont des commentaires.

[Ténor]
Ky-ri-e e-lei-son,
Ky-ri-e e-lei__-son.

Chri-ste _ e-lei-son.

[Soprano]
Ky-ri-e e-lei-son,
…
```

| Écriture | Signification |
|---|---|
| `[Ténor]` | début des paroles d'un pupitre : `[Soprano]`, `[Alto]`, `[Ténor]`, `[Basse]` (ou `[S]`, `[A]`, `[T]`, `[B]`) |
| `[S II]`, `[Tenore]` | paroles d'une piste précise (nom de la piste, ou pupitre + numéro de chœur) |
| `[Tous]` | paroles communes à toutes les pistes qui n'ont pas leur propre section |
| `[Ténor, Basse]` | même texte pour plusieurs pupitres |
| `Ky-ri-e` | les tirets séparent les syllabes d'un mot (une note chacune) |
| espace | sépare les mots |
| `lei__` ou `lei _ _` | vocalise : chaque `_` fait tenir la syllabe sur une note de plus |
| retour à la ligne | nouvelle ligne à l'écran |
| ligne vide | nouveau paragraphe (petit espace dans le texte complet) |

Un pupitre qui chante les mêmes paroles que les autres mais sur un rythme
différent a besoin de sa propre section : l'alignement dépend des notes de
chaque piste.

### Vérifier l'alignement

Sous les paroles, l'app signale un décalage : « 12 notes de la piste sans
syllabe » (il manque du texte, ou une vocalise sans `_`) ou « 3 syllabes de
plus que de notes » (syllabe en trop, ou `_` en trop). Le plus simple est de
jouer le morceau en suivant les paroles : là où ça se décale, il manque ou il
y a en trop une syllabe ou un `_` juste avant.

Pour essayer un texte **avant** de le déposer ici, ouvrez le morceau dans
l'app puis touchez « Ajouter des paroles » (ou « Autres paroles… ») et
choisissez le fichier sur votre appareil.

### Variante minutée

Si une piste ne s'y prête pas (pas de piste chantée, piano seul…), on peut
minuter les lignes à la place, comme dans un fichier de karaoké `.lrc` :

```
[Tous]
[00:12] Ky-ri-e e-lei-son
[00:20.5] Chri-ste e-lei-son
```

La ligne s'allume à l'instant indiqué (minutes:secondes).

### Paroles déjà dans le MIDI

Si le fichier MIDI contient lui-même des paroles (export MuseScore, fichier
karaoké), l'app les affiche sans fichier `.paroles.txt`. Un fichier
`.paroles.txt` reste prioritaire s'il existe.

### Mise à jour

Après une correction, l'app peut afficher l'ancienne version une fois (elle
garde les morceaux en cache pour le hors-ligne) ; la nouvelle arrive au
chargement suivant.
