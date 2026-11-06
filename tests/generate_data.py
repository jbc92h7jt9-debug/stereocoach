"""Génère data/molecules.json : coordonnées 3D (ETKDG+MMFF) + validations croisées.
Les rangs CIP de référence sont saisis ici puis CONTRÔLÉS contre rdCIPLabeler."""
import json, numpy as np
from rdkit import Chem, rdBase
from rdkit.Chem import AllChem, rdCIPLabeler

smi = "C[C@H](O)CC"   # (S)-butan-2-ol attendu
m = Chem.AddHs(Chem.MolFromSmiles(smi))
assert AllChem.EmbedMolecule(m, randomSeed=42) == 0
AllChem.MMFFOptimizeMolecule(m, maxIters=2000)
rdCIPLabeler.AssignCIPLabels(m)
c = [a for a in m.GetAtoms() if a.HasProp('_CIPCode')][0]
label = c.GetProp('_CIPCode')
# Contrôle 3D -> stéréo : la 3D générée doit redonner la même étiquette
m2 = Chem.Mol(m); Chem.AssignStereochemistryFrom3D(m2); rdCIPLabeler.AssignCIPLabels(m2)
label3d = [a for a in m2.GetAtoms() if a.HasProp('_CIPCode')][0].GetProp('_CIPCode')
assert label == label3d, (label, label3d)

# Rangs de référence (saisis : O > CH2CH3 > CH3 > H), indices des voisins du centre
nb = {n.GetIdx(): n for n in c.GetNeighbors()}
rank = {}
for i, n in nb.items():
    if n.GetSymbol() == 'O': rank[i] = 1
    elif n.GetSymbol() == 'H': rank[i] = 4
    elif sorted(x.GetSymbol() for x in n.GetNeighbors() if x.GetIdx() != c.GetIdx()) == ['C', 'H', 'H']: rank[i] = 2   # CH2 (éthyle)
    else: rank[i] = 3                                                                          # CH3
assert sorted(rank.values()) == [1, 2, 3, 4]
# Contrôle croisé : R/S recalculé depuis rangs + 3D (produit mixte, R <=> < 0) == étiquette CIPLabeler
conf = m.GetConformer(); P = lambda i: np.array(conf.GetAtomPosition(i))
inv = {v: k for k, v in rank.items()}
tp = np.dot(P(inv[1]) - P(c.GetIdx()), np.cross(P(inv[2]) - P(c.GetIdx()), P(inv[3]) - P(c.GetIdx())))
calc = 'R' if tp < 0 else 'S'
assert calc == label, ("incohérence rangs/3D/CIP", calc, label)

names = {'O': 'OH', 'H': 'H'}
def sublabel(i):
    n = nb[i]
    if n.GetSymbol() in names: return names[n.GetSymbol()]
    return 'CH₂CH₃' if rank[i] == 2 else 'CH₃'
atoms = [{"i": a.GetIdx(), "el": a.GetSymbol(), "z": a.GetAtomicNum(),
          "xyz": [round(v, 4) for v in P(a.GetIdx())]} for a in m.GetAtoms()]
bonds = [{"a": b.GetBeginAtomIdx(), "b": b.GetEndAtomIdx(), "order": int(b.GetBondTypeAsDouble())} for b in m.GetBonds()]
mol = {"id": "butan-2-ol-S", "name": "Butan-2-ol", "formula": "C4H10O", "smiles": smi, "level": 1,
       "description": "Alcool secondaire à un seul centre stéréogène : un bon premier exemple.",
       "stereocenters": [{"atom": c.GetIdx(), "config": label,
          "substituents": [{"atom": i, "label": sublabel(i), "rank": rank[i],
                            "firstAtom": nb[i].GetSymbol(), "firstZ": nb[i].GetAtomicNum(),
                            "sphere2": sorted([x.GetSymbol() for x in nb[i].GetNeighbors() if x.GetIdx()!=c.GetIdx()], key=lambda s:-Chem.GetPeriodicTable().GetAtomicNumber(s))}
                           for i in sorted(nb, key=lambda k: rank[k])]}],
       "atoms": atoms, "bonds": bonds,
       "validation": {"coords": f"RDKit {rdBase.rdkitVersion} ETKDG seed 42 + MMFF94",
                      "cip_reference": f"rdCIPLabeler (nouvel algorithme CIP) = {label}",
                      "cross_check": "ranks saisis + 3D (produit mixte) == rdCIPLabeler; 3D -> stéréo == SMILES"}}
json.dump({"version": 1, "molecules": [mol]}, open("data/molecules.json", "w"), ensure_ascii=False, indent=1)
print("OK label", label, "triple", round(float(tp), 3), "atoms", len(atoms))
