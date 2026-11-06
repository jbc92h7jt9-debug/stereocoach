import { Viewer, PRIO_COLORS } from './viz/viewer.js';
import { configFromView } from './chem/chirality.js';
import { checkPriorities, feedbackRS, explainNotStereo, helpText } from './pedagogy/coach.js';
import { runTests } from '../tests/chem-tests.js';
import * as THREE from '../vendor/three.module.js';

const $ = id => document.getElementById(id);
const errors = []; const logErr = e => { errors.push(new Date().toLocaleTimeString() + ' — ' + (e?.message || e)); renderDiag(); };
addEventListener('error', e => logErr(e.error || e.message)); addEventListener('unhandledrejection', e => logErr(e.reason));
const fatal = msg => { $('fatal').hidden = false; $('fatal').innerHTML = '<b>StereoCoach ne peut pas démarrer.</b><br>' + msg; };

// ----- Progression locale (localStorage, sans compte) -----
const KEY = 'stereocoach.progress.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { done:0, noHelp:0, errs:{}, last:null }; } catch { return { done:0, noHelp:0, errs:{}, last:null }; } };
const save = p => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { logErr(e); } };
let prog = load();

// ----- État de l'exercice -----
const STEPS = ['A · Centre', 'B · Priorités', 'C · Orientation', 'D · R ou S'];
let mol, sc, viewer, step = 0, picked = null, prio = {}, prioOk = false, answer = null, help = [0,0,0,0], usedHelp = false, finished = false, exErrs = [];
const status = { three: 'non chargé', data: 'non chargé', webgl: 'non initialisé', tests: { run:0, ok:0 } };

async function init() {
  status.three = 'r' + THREE.REVISION;
  try { const r = await fetch('data/molecules.json'); if (!r.ok) throw new Error('HTTP ' + r.status); const d = await r.json();
    if (!d.molecules?.length) throw new Error('bibliothèque vide'); window.__data = d; mol = d.molecules[0]; sc = mol.stereocenters[0]; status.data = d.molecules.length + ' molécule(s)'; }
  catch (e) { return fatal(`Impossible de charger les données moléculaires (${e.message}). Servez l'application via un serveur HTTP (pas en file://).`); }
  try { viewer = new Viewer($('view'), onPick); viewer.load(mol); status.webgl = 'OK'; }
  catch (e) { status.webgl = 'ÉCHEC'; return fatal(`Le rendu 3D n'a pas pu démarrer : ${e.message}. Vérifiez que WebGL est activé dans votre navigateur.`); }
  $('btnReset').onclick = () => { viewer.resetView(); refreshOrient(); };
  $('btnH').onclick = () => { $('btnH').textContent = viewer.toggleH() ? 'Masquer les H' : 'Afficher les H'; };
  $('btnGuide').onclick = guide; $('btnAxis').onclick = toggleAxis; $('btnOk').onclick = validate; $('btnHelp').onclick = askHelp;
  $('btnDiag').onclick = () => { $('diag').hidden = !$('diag').hidden; renderDiag(); };
  $('btnTests').onclick = () => { const r = runTests(window.__data); status.tests = { run:r.length, ok:r.filter(x => x.ok).length }; renderDiag(r); };
  $('btnResetProg').onclick = () => { if (confirm('Effacer toute la progression ?')) { prog = { done:0, noHelp:0, errs:{}, last:null }; save(prog); renderScore(); } };
  addEventListener('keydown', e => { if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.metaKey && document.activeElement.tagName !== 'INPUT') $('btnDiag').click(); });
  viewer.controls.addEventListener('change', refreshOrient);
  render();
}

const fb = (cls, html) => { $('feedback').innerHTML = html ? `<div class="msg ${cls}">${html}</div>` : ''; };
const subOf = atom => sc.substituents.find(s => s.atom === atom);
const sub4 = () => sc.substituents.find(s => s.rank === 4).atom;
function onPick(atom) { if (step !== 0 || finished) return; picked = atom; viewer.setHighlight(new Set([atom])); fb('', `Atome sélectionné : <b>${mol.atoms[atom].el}</b> (n° ${atom}). Clique sur « Valider » pour vérifier.`); }

function render() {
  $('steps').innerHTML = STEPS.map((s, i) => `<li class="${i < step || finished ? 'done' : i === step ? 'cur' : ''}">${s}</li>`).join('');
  const st = $('stage'); const tb = ['btnGuide', 'btnAxis', 'orient'].map($);
  tb.forEach(b => b.hidden = !(step === 2 || step === 3)); $('btnHelp').hidden = finished; $('btnOk').textContent = finished ? 'Recommencer' : 'Valider';
  if (step === 0) st.innerHTML = `<p class="instr"><b>Étape A.</b> Clique sur l'atome qui est un <b>centre stéréogène</b>, puis valide.</p>`;
  if (step === 1) {
    st.innerHTML = `<p class="instr"><b>Étape B.</b> Classe les quatre substituants du centre (règles CIP) : 1 = priorité la plus haute.</p><div class="subs">` +
      sc.substituents.slice().sort((a, b) => a.atom - b.atom).map(s => `<div class="sub"><b>${s.label}</b><div class="prio">${[1,2,3,4].map(r => `<button data-a="${s.atom}" data-r="${r}" class="${prio[s.atom] === r ? 'sel' : ''}" aria-label="${s.label} : priorité ${r}">${r}</button>`).join('')}</div></div>`).join('') + '</div>';
    st.querySelectorAll('.prio button').forEach(b => b.onclick = () => { prio[+b.dataset.a] = +b.dataset.r; viewer.setPriorities(prio); render(); });
  }
  if (step === 2) st.innerHTML = `<p class="instr"><b>Étape C.</b> Oriente la molécule pour que le substituant de priorité <b>4</b> (<span style="color:${PRIO_COLORS[4]}">gris</span>) soit <b>à l'arrière</b>, loin de toi. Tourne-la librement ou utilise « Aide guidée ». Une rotation ne change jamais la configuration.</p>`;
  if (step === 3) st.innerHTML = `<p class="instr"><b>Étape D.</b> Regarde 1 → 2 → 3 (turquoise → bleu → orange) avec le 4 à l'arrière. Quelle est la configuration ?</p><div class="rs">${['R','S'].map(x => `<button data-x="${x}" class="${answer === x ? 'sel' : ''}">${x}</button>`).join('')}</div>`;
  if (step === 3) st.querySelectorAll('.rs button').forEach(b => b.onclick = () => { answer = b.dataset.x; render(); });
  renderScore(); refreshOrient();
}
function refreshOrient() {
  if (!viewer || !(step === 2 || step === 3)) return; const o = viewer.orientation(sc.atom, sub4()); const el = $('orient');
  el.className = 'badge ' + o.state; el.textContent = { back:'✓ 4 à l\'arrière', front:'✗ 4 à l\'avant', side:'⟳ 4 de côté' }[o.state];
}
function guide() { viewer.guideTo(sc.atom, sub4()); setTimeout(refreshOrient, 800); }
let axisOn = false; function toggleAxis() { axisOn = !axisOn; viewer.showAxis(sc.atom, sub4(), axisOn); $('btnAxis').classList.toggle('on', axisOn); }

function addErr(t) { if (!t) return; exErrs.push(t); prog.errs[t] = (prog.errs[t] || 0) + 1; save(prog); }
function askHelp() { const k = ['A','B','C','D'][step]; help[step] = Math.min(help[step] + 1, 4); usedHelp = true; fb('', `<b>Aide ${help[step]}/4.</b> ${helpText(k, help[step], sc, mol)}`); }

function validate() {
  if (finished) return reset();
  if (step === 0) {
    if (picked === null) return fb('', 'Sélectionne d\'abord un atome en cliquant dessus.');
    if (picked === sc.atom) { fb('ok', `Exact : cet atome de carbone est lié à quatre substituants différents (${sc.substituents.map(s => s.label).join(', ')}). C'est un centre stéréogène.`); step = 1; viewer.setHighlight(new Set([sc.atom])); setTimeout(render, 0); }
    else { addErr('centre'); fb('ko', explainNotStereo(mol, picked)); }
  } else if (step === 1) {
    const r = checkPriorities(sc, prio);
    if (r.ok) { prioOk = true; fb('ok', r.msg + ' Passe à l\'orientation.'); step = 2; render(); } else { addErr(r.type); fb('ko', r.msg); }
  } else if (step === 2) {
    const o = viewer.orientation(sc.atom, sub4());
    if (o.state === 'back') { fb('ok', 'Le substituant 4 est bien à l\'arrière : tu peux lire le sens 1 → 2 → 3.'); step = 3; render(); }
    else { addErr('orientation'); fb('ko', 'Le substituant de priorité 4 doit être à l\'arrière, loin de toi : sinon le sens de rotation observé est inversé. Tourne la molécule (ou « Aide guidée ») jusqu\'à voir « 4 à l\'arrière ».'); }
  } else if (step === 3) {
    if (!answer) return fb('', 'Choisis R ou S.');
    const o = viewer.orientation(sc.atom, sub4());
    const [p1, p2, p3] = [1, 2, 3].map(r => viewer.screenOf(sc.substituents.find(s => s.rank === r).atom));
    const readFromView = o.state === 'side' ? null : configFromView(p1, p2, p3, o.state === 'back');   // lecture depuis la vue ACTUELLE
    const r = feedbackRS({ answer, ref: sc.config, back: o.state === 'back', readFromView, priorityOk: prioOk });
    fb(r.ok ? 'ok' : 'ko', r.msg + (r.ok ? '' : ''));
    if (r.ok) { finished = true; prog.done++; if (!usedHelp && exErrs.length === 0) prog.noHelp++; prog.last = { mol: mol.name, cfg: sc.config, help: usedHelp, errors: exErrs.length, date: new Date().toISOString().slice(0, 10) }; save(prog); render(); }
    else addErr(r.type);
  }
}
function reset() { step = 0; picked = null; prio = {}; prioOk = false; answer = null; help = [0,0,0,0]; usedHelp = false; finished = false; exErrs = []; axisOn = false; viewer.showAxis(sc.atom, sub4(), false); viewer.setHighlight(new Set()); viewer.setPriorities({}); viewer.resetView(); fb('', ''); render(); }
function renderScore() { const l = prog.last; $('score').innerHTML = `Exercices réussis : ${prog.done} (dont ${prog.noHelp} sans aide ni erreur)` + (l ? ` · dernier : ${l.mol}, ${l.cfg}, ${l.date}` : '') + (Object.keys(prog.errs).length ? `<br>Erreurs rencontrées : ${Object.entries(prog.errs).map(([k, v]) => `${k} ×${v}`).join(', ')}` : ''); }
function renderDiag(results) {
  $('diagOut').textContent = `Three.js : ${status.three}\nWebGL / rendu : ${status.webgl}\nRDKit.js : non utilisé en phase 2 (coordonnées pré-calculées, validées hors ligne)\nMoteur CIP : phase 3 (rangs de référence issus de rdCIPLabeler, contrôlés)\nDonnées : ${status.data}\nTests : ${status.tests.run} lancés, ${status.tests.ok} réussis, ${status.tests.run - status.tests.ok} échoués\n` + (results ? '\n' + results.map(r => (r.ok ? 'OK   ' : 'ÉCHEC ') + r.name).join('\n') : '') + `\n\nDernières erreurs :\n${errors.slice(-5).join('\n') || '(aucune)'}`;
}
init().catch(e => { logErr(e); fatal(e.message); });
