import { configFromRanks, rotate, configFromView, sub, cross, dot, norm } from '../js/chem/chirality.js';
// Renvoie [{name, ok, detail}] — utilisable dans Node ET dans le navigateur (panneau de diagnostic).
export function runTests(data) {
  const R = []; const t = (name, ok, detail = '') => R.push({ name, ok: !!ok, detail });
  for (const mol of data.molecules) {
    const P = i => mol.atoms[i].xyz;
    for (const sc of mol.stereocenters) {
      const bySub = r => sc.substituents.find(s => s.rank === r).atom;
      const [a1, a2, a3, a4] = [1, 2, 3, 4].map(bySub);
      const c = P(sc.atom), ref = sc.config;
      t(`${mol.id}: 4 substituants de rangs distincts`, new Set(sc.substituents.map(s => s.rank)).size === 4);
      t(`${mol.id}: 3D + rangs == configuration de référence (${ref})`, configFromRanks(c, P(a1), P(a2), P(a3)) === ref);
      // Rotations propres : 90°, 180°, 360° et axes quelconques -> configuration inchangée
      for (const [nom, k, ang] of [['90° / x', [1,0,0], Math.PI/2], ['180° / y', [0,1,0], Math.PI], ['360° / z', [0,0,1], 2*Math.PI], ['137° / axe quelconque', norm([1,2,3]), 2.39]]) {
        const q = i => rotate(sub(P(i), c), k, ang);
        t(`${mol.id}: rotation ${nom} conserve ${ref}`, configFromRanks([0,0,0], q(a1), q(a2), q(a3)) === ref);
      }
      // Image miroir (x -> -x) : doit INVERSER la configuration
      const m = i => { const p = sub(P(i), c); return [-p[0], p[1], p[2]]; };
      const inv = ref === 'R' ? 'S' : 'R';
      t(`${mol.id}: image miroir donne ${inv}`, configFromRanks([0,0,0], m(a1), m(a2), m(a3)) === inv);
      // Lecture depuis un point de vue (projection orthographique) : indépendante de la direction de vue
      let okViews = true, n = 0;
      for (let k = 0; k < 200; k++) {
        const v = norm([Math.sin(k*1.7), Math.cos(k*2.3)+.1, Math.sin(k*0.9+1)]);        // direction caméra->vers la scène inversée
        const up0 = Math.abs(v[1]) > .9 ? [1,0,0] : [0,1,0];
        const xa = norm(cross(up0, v)), ya = cross(v, xa);                                // base écran (x droite, y haut), v pointe vers l'observateur
        const scr = i => { const p = sub(P(i), c); return [dot(p, xa), dot(p, ya)]; };
        const back = dot(sub(P(a4), c), v) < 0;                                           // 4 loin de l'observateur
        if (Math.abs(dot(norm(sub(P(a4), c)), v)) < .3) continue;                          // vue ambiguë : on ne conclut pas
        n++; if (configFromView(scr(a1), scr(a2), scr(a3), back) !== ref) okViews = false;
      }
      t(`${mol.id}: lecture 1→2→3 + position de 4 correcte sur ${n} points de vue`, okViews && n > 50);
    }
  }
  return R;
}
