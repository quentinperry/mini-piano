# Morceaux intégrés

L'application propose automatiquement tous les fichiers MIDI déposés dans ce dossier.

Pour en ajouter un :

1. Sur GitHub, basculer sur la branche `gh-pages`, ouvrir le dossier `songs/`.
2. « Add file » → « Upload files », déposer un ou plusieurs `.mid`, valider le commit.
3. Le site se met à jour en une à deux minutes ; le morceau apparaît dans le menu « Morceaux intégrés ».

Le nom du fichier sert de libellé (« 01 - Kyrie (pupitres).mid » s'affichera
« 01 - Kyrie (pupitres) ») ; espaces et accents bienvenus. Tout fichier non-MIDI
est ignoré. Un morceau écouté une fois est mis en cache par le service worker
et reste disponible hors ligne.
