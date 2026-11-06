# StereoCoach — prototype phase 2 (butan-2-ol)

Application web statique (HTML/CSS/JS, Three.js r160 en local). Aucun backend.

## Lancer
    cd stereocoach && python3 -m http.server 8000   # puis http://localhost:8000
Ne fonctionne pas en `file://` (modules ES, fetch). Publiable tel quel sur GitHub Pages.

## Arborescence
- `data/molecules.json` : SMILES, coordonnées 3D, rangs CIP, configuration de référence, provenance.
- `js/chem/chirality.js` : calculs de chiralité (indépendant de l'interface).
- `js/viz/viewer.js` : rendu Three.js (aucune décision chimique).
- `js/pedagogy/coach.js` : erreurs, messages, aides graduées, pilotés par les données.
- `js/main.js` : parcours A→D, diagnostic, localStorage.
- `tests/chem-tests.js` (navigateur + Node), `tests/run-node.mjs`, `tests/generate_data.py`.

## Régénérer les données / tester
    pip install rdkit && python3 tests/generate_data.py   # contrôles croisés, échoue si incohérence
    node tests/run-node.mjs                                 # 8 tests chimiques et géométriques
Dans l'application : touche D ou bouton « Diagnostic » puis « Lancer les tests ».

## Provenance
Coordonnées : RDKit 2026.09.1 (ETKDG, graine 42, MMFF94). Configuration : rdCIPLabeler (nouvel algorithme CIP).
Contrôles : produit mixte 3D == étiquette rdCIPLabeler ; 3D -> stéréo == SMILES.

## Limites (phase 2)
Une seule molécule ; pas de moteur CIP général (phase 3) ; RDKit.js non utilisé ; modules 1, 2, 3, 5 et bibliothèque non développés.
Rendu 3D et interface NON testés dans un navigateur réel (aucun navigateur disponible dans mon environnement).
