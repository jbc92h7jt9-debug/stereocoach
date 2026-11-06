// Moteur chimique de la phase 2 : AUCUNE dépendance à l'interface ou à Three.js.
// La source de vérité des configurations est data/molecules.json (rdCIPLabeler, contrôlé).
// Ces fonctions ne servent qu'à VÉRIFIER la cohérence 3D <-> configuration et à corriger l'étudiant.
export const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
export const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
export const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const norm = (a) => { const n = Math.hypot(...a); return a.map(x => x / n); };

// Convention : produit mixte (p1-c)·((p2-c)×(p3-c)) < 0  <=>  R ; > 0  <=>  S.
// (validée par rdCIPLabeler sur butan-2-ol, voir tests/generate_data.py)
export function configFromRanks(c, p1, p2, p3) {
  const t = dot(sub(p1, c), cross(sub(p2, c), sub(p3, c)));
  if (Math.abs(t) < 1e-6) return null;            // géométrie dégénérée : refuser de conclure
  return t < 0 ? 'R' : 'S';
}
// Rotation propre (formule de Rodrigues) autour de l'axe unitaire k
export function rotate(p, k, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), kp = cross(k, p), kd = dot(k, p);
  return p.map((v, i) => v*c + kp[i]*s + k[i]*kd*(1-c));
}
// Lecture depuis un point de vue : pts2d = positions écran (x droite, y haut) de 1,2,3 ;
// back = true si le substituant 4 est à l'arrière. Retourne R/S ou null si ambigu.
export function configFromView(p1, p2, p3, back) {
  const area = (p2[0]-p1[0])*(p3[1]-p1[1]) - (p2[1]-p1[1])*(p3[0]-p1[0]);
  if (Math.abs(area) < 1e-9) return null;
  const clockwise = area < 0;                      // y vers le haut : aire négative = horaire
  return (clockwise === back) ? 'R' : 'S';         // horaire + 4 arrière = R ; 4 devant : inverser
}
