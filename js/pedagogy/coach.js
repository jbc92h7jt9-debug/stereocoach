// Moteur pédagogique : messages d'erreur et aides graduées, pilotés par les données de la fiche.
const Z = { H:1, C:6, N:7, O:8, F:9, P:15, S:16, Cl:17, Br:35, I:53 };
const COL = { 1:'turquoise', 2:'bleu', 3:'orange', 4:'gris' };

// Explique pourquoi `hi` doit être classé avant `lo` (données issues de la fiche moléculaire).
export function explainOrder(hi, lo) {
  if (hi.firstZ !== lo.firstZ)
    return `${hi.label} commence par un atome ${hi.firstAtom} (Z = ${hi.firstZ}), ${lo.label} par un atome ${lo.firstAtom} (Z = ${lo.firstZ}). Le numéro atomique le plus élevé l'emporte : ${hi.label} passe avant ${lo.label}.`;
  const a = hi.sphere2, b = lo.sphere2;
  return `${hi.label} et ${lo.label} commencent tous deux par un atome ${hi.firstAtom} : le premier point de comparaison ne les départage pas. On compare alors les atomes liés à ce ${hi.firstAtom}, classés par numéro atomique décroissant : (${a.join(', ')}) pour ${hi.label} contre (${b.join(', ')}) pour ${lo.label}. Au premier point de différence, ${a.find((x,i)=>x!==b[i])} (Z = ${Z[a.find((x,i)=>x!==b[i])]}) l'emporte sur ${b.find((x,i)=>x!==a[i])} (Z = ${Z[b.find((x,i)=>x!==a[i])]}) : ${hi.label} passe avant ${lo.label}.`;
}

// Étape A : pourquoi l'atome choisi n'est pas le centre stéréogène (déduit de la structure)
export function explainNotStereo(mol, idx) {
  const a = mol.atoms[idx];
  const nb = mol.bonds.filter(b => b.a === idx || b.b === idx).map(b => mol.atoms[b.a === idx ? b.b : b.a].el);
  if (nb.length < 4) return `Cet atome (${a.el}) n'a que ${nb.length} voisin${nb.length>1?'s':''} : un centre stéréogène tétraédrique en a quatre, tous différents.`;
  const dupH = nb.filter(x => x === 'H').length;
  if (dupH >= 2) return `Cet atome porte ${dupH} atomes d'hydrogène identiques : il n'a pas quatre substituants différents, donc ce n'est pas un centre stéréogène.`;
  return `Cet atome n'a pas quatre substituants tous différents : ce n'est pas le centre stéréogène de la molécule.`;
}

// Étape B : analyse de la proposition de priorités (map atome -> rang)
export function checkPriorities(sc, proposal) {
  const subs = sc.substituents;
  if (subs.some(s => !proposal[s.atom])) return { ok:false, type:'incomplet', msg:"Attribue une priorité à chacun des quatre substituants avant de valider." };
  if (new Set(subs.map(s => proposal[s.atom])).size < 4) return { ok:false, type:'doublon', msg:"Chaque priorité (1, 2, 3, 4) ne peut être attribuée qu'une seule fois." };
  const ordered = [...subs].sort((x, y) => x.rank - y.rank);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 4; j++) {
    const hi = ordered[i], lo = ordered[j];
    if (proposal[hi.atom] > proposal[lo.atom]) {
      const early = hi.firstZ === lo.firstZ ? 'CIP3' : 'CIP2';
      return { ok:false, type: early === 'CIP3' ? 'comparaison-arrêtée' : 'numéro-atomique',
        msg: `Tu as classé ${lo.label} avant ${hi.label}. ${explainOrder(hi, lo)} Recommence ton classement.` };
    }
  }
  return { ok:true, msg:"Classement correct : " + ordered.map(s => `${s.rank} = ${s.label}`).join(' ; ') + "." };
}

// Étape D : correction adaptée à la réponse ET à l'orientation réellement affichée
export function feedbackRS({ answer, ref, back, readFromView, priorityOk }) {
  const steps = `Méthode : (1) classer les substituants ; (2) placer le n°4 à l'arrière ; (3) suivre 1 → 2 → 3 : sens horaire = R, anti-horaire = S ; (4) si le n°4 est à l'avant, inverser la conclusion.`;
  if (answer === ref) return { ok:true, type:null, msg:`Exact : la configuration est ${ref}. ${steps} Rappel : tourner la molécule ne change jamais R/S.` };
  if (!priorityOk) return { ok:false, type:'priorités', msg:`Ta réponse est ${answer}, mais les priorités de l'étape B n'étaient pas correctes : une erreur de classement inverse la conclusion. Reprends d'abord les priorités.` };
  if (!back && readFromView === answer)
    return { ok:false, type:'substituant-4-devant', msg:`Attention : tu as lu correctement le sens de rotation 1 → 2 → 3 dans la vue actuelle, mais le substituant de priorité 4 est orienté vers l'avant. Il faut donc inverser la conclusion.` };
  if (back) return { ok:false, type:'sens-RS', msg:`Le substituant 4 est bien à l'arrière, donc on lit directement : sens horaire = R, anti-horaire = S. Observe à nouveau 1 → 2 → 3 (turquoise → bleu → orange) et refais la lecture.` };
  return { ok:false, type:'orientation', msg:`Ta réponse n'est pas correcte. Le substituant 4 n'est pas encore bien placé à l'arrière : sans cela, la lecture 1 → 2 → 3 n'est pas fiable. Réoriente la molécule (aide guidée) puis recommence.` };
}

// Aides graduées (niveaux 1 à 4) ; le niveau 4 donne la correction complète
export function helpText(step, level, sc, mol) {
  const subs = [...sc.substituents].sort((a, b) => a.rank - b.rank);
  const H = {
    A: ["Un centre stéréogène porte quatre substituants tous différents.", "Cherche un atome de carbone lié à quatre groupes distincts : ni deux H, ni un groupe répété.", "Regarde les carbones un par un : le CH₃ et le CH₂ portent des H identiques. Un seul carbone n'en porte qu'un.", `Le centre stéréogène est l'atome ${sc.atom} (carbone C2), lié à ${subs.map(s => s.label).join(', ')}.`],
    B: ["Compare d'abord les atomes directement liés au centre : le plus grand numéro atomique passe en premier.", "Règle CIP : numéro atomique décroissant ; en cas d'égalité, on compare les atomes liés à ceux-ci, sphère par sphère.", `Applique-la : ${subs.length ? explainOrder(subs[0], subs[1]) : ''}`, "Classement complet : " + subs.map(s => `${s.rank} = ${s.label}`).join(' ; ') + "."],
    C: ["Place le substituant de priorité 4 derrière le centre, loin de toi.", "Une rotation de la molécule ne change pas sa configuration : tu peux la tourner librement.", "Utilise « Aide guidée » : la caméra se place du côté opposé au substituant 4.", "Le substituant 4 doit pointer à l'opposé de l'observateur (indicateur vert « à l'arrière »)."],
    D: ["Suis le chemin 1 → 2 → 3 en regardant depuis ta position, avec 4 à l'arrière.", "Sens horaire = R, anti-horaire = S, à condition que le 4 soit à l'arrière.", "Si le 4 est à l'avant, ton observation est inversée : renverse la conclusion.", `La configuration est ${sc.config}.`]
  };
  return H[step][Math.min(level, 4) - 1];
}
export { COL };
