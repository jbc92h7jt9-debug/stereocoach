// Visualisation 3D (Three.js) : aucune décision chimique ici, uniquement de l'affichage.
import * as THREE from '../../vendor/three.module.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';

const EL = { C:{c:0x3b4652,r:.42}, H:{c:0xf4f6f8,r:.26}, O:{c:0xe36c65,r:.40}, N:{c:0x3b6fd0,r:.40}, S:{c:0xe6c84a,r:.5}, Cl:{c:0x4fb86a,r:.5}, Br:{c:0x9a4a2e,r:.55} };
export const PRIO_COLORS = { 1:'#42B6A5', 2:'#3B82C4', 3:'#E9AD56', 4:'#8A94A0' };

export class Viewer {
  constructor(canvasHost, onPick) {
    this.host = canvasHost; this.onPick = onPick;
    this.renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });   // peut lever : géré par l'appelant
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.host.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
    this.scene.add(new THREE.AmbientLight(0xffffff, .75));
    const d = new THREE.DirectionalLight(0xffffff, .9); d.position.set(4, 6, 8); this.camera.add(d); this.scene.add(this.camera);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = .12; this.controls.minDistance = 3; this.controls.maxDistance = 25;
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.atomMeshes = []; this.labels = []; this.showH = true; this.mol = null; this.selected = new Set();
    this.ray = new THREE.Raycaster(); this.arrow = null;
    const cv = this.renderer.domElement; let down = null;
    cv.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
    cv.addEventListener('pointerup', e => { if (down && Math.hypot(e.clientX-down[0], e.clientY-down[1]) < 5) this.pick(e); down = null; });
    new ResizeObserver(() => this.resize()).observe(this.host); this.resize();
    this.renderer.setAnimationLoop(() => { this.update?.(); this.controls.update(); this.renderer.render(this.scene, this.camera); });
  }
  resize() { const w = this.host.clientWidth || 600, h = this.host.clientHeight || 480; this.renderer.setSize(w, h, false); this.camera.aspect = w/h; this.camera.updateProjectionMatrix(); }
  load(mol) {
    this.mol = mol; this.group.clear(); this.atomMeshes = []; this.labels = [];
    const missing = mol.atoms.filter(a => !a.xyz || a.xyz.some(v => typeof v !== 'number' || isNaN(v)));
    if (missing.length) throw new Error('Coordonnées 3D manquantes ou invalides pour ' + mol.id);
    const v = a => new THREE.Vector3(...mol.atoms[a].xyz);
    const cen = mol.atoms.reduce((s, a) => s.add(new THREE.Vector3(...a.xyz)), new THREE.Vector3()).divideScalar(mol.atoms.length);
    this.center = cen; this.group.position.copy(cen).negate();
    mol.atoms.forEach(a => {
      const s = EL[a.el] || { c:0xaaaaaa, r:.4 };
      const m = new THREE.Mesh(new THREE.SphereGeometry(s.r, 32, 24), new THREE.MeshStandardMaterial({ color:s.c, roughness:.45, metalness:.05 }));
      m.position.set(...a.xyz); m.userData = { atom:a.i, base:s.c }; this.group.add(m); this.atomMeshes[a.i] = m;
    });
    mol.bonds.forEach(b => {
      const p = v(b.a), q = v(b.b), dir = q.clone().sub(p), len = dir.length();
      const off = b.order > 1 ? new THREE.Vector3(0, 0, 1).cross(dir).normalize().multiplyScalar(.09) : new THREE.Vector3();
      for (let k = 0; k < b.order; k++) {
        const o = off.clone().multiplyScalar(b.order === 2 ? (k ? 1 : -1) : k - 1);
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, len, 12), new THREE.MeshStandardMaterial({ color:0x9aa5b1, roughness:.5 }));
        cyl.position.copy(p).add(q).multiplyScalar(.5).add(o); cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
        cyl.userData = { bond:[b.a, b.b] }; this.group.add(cyl);
      }
    });
    this.applyH(); this.resetView();
  }
  applyH() { this.mol.atoms.forEach(a => { if (a.el === 'H') this.atomMeshes[a.i].visible = this.showH; });
    this.group.children.forEach(o => { if (o.userData.bond) o.visible = this.showH || this.mol.atoms[o.userData.bond[0]].el !== 'H' && this.mol.atoms[o.userData.bond[1]].el !== 'H'; }); }
  toggleH() { this.showH = !this.showH; this.applyH(); return this.showH; }
  resetView() { this.controls.target.set(0,0,0); this.camera.up.set(0,1,0); this.camera.position.set(0, 1.5, 8); this.camera.lookAt(0,0,0); this.controls.update(); }
  world(i) { return this.atomMeshes[i].getWorldPosition(new THREE.Vector3()); }
  pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1), this.camera);
    const hit = this.ray.intersectObjects(this.atomMeshes.filter(m => m.visible))[0];
    if (hit) this.onPick(hit.object.userData.atom);
  }
  setHighlight(set) { this.selected = set; this.atomMeshes.forEach((m, i) => { const on = set.has(i); m.material.emissive.setHex(on ? 0xe9ad56 : 0); m.material.emissiveIntensity = on ? .6 : 0; m.scale.setScalar(on ? 1.18 : 1); }); }
  // Pastilles de priorité (sprites) au-dessus des substituants
  setPriorities(map) {
    this.labels.forEach(l => this.group.remove(l)); this.labels = [];
    Object.entries(map).forEach(([atom, rank]) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 96; const g = cv.getContext('2d');
      g.fillStyle = PRIO_COLORS[rank]; g.beginPath(); g.arc(48, 48, 42, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 56px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(rank, 48, 52);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), depthTest:false }));
      const p = this.atomMeshes[atom].position; sp.position.set(p.x, p.y + .75, p.z); sp.scale.setScalar(.6); sp.renderOrder = 10;
      this.group.add(sp); this.labels.push(sp);
    });
  }
  // Orientation guidée : caméra du côté opposé au substituant 4 (rotation de la CAMÉRA, la molécule n'est pas modifiée)
  guideTo(centerAtom, atom4, animate = true) {
    const c = this.world(centerAtom), p4 = this.world(atom4);
    const dir = c.clone().sub(p4).normalize();            // de 4 vers le centre : l'observateur se place ainsi
    const to = c.clone().add(dir.multiplyScalar(8)), from = this.camera.position.clone(), t0 = performance.now();
    this.controls.target.copy(c);
    this.update = () => { const k = Math.min((performance.now()-t0)/700, 1), e = k*k*(3-2*k);
      this.camera.position.lerpVectors(from, to, animate ? e : 1); if (k >= 1) this.update = null; };
  }
  showAxis(centerAtom, atom4, on) {
    if (this.arrow) { this.scene.remove(this.arrow); this.arrow = null; }
    if (!on) return;
    const c = this.world(centerAtom), d = c.clone().sub(this.world(atom4)).normalize();   // axe d'observation
    this.arrow = new THREE.ArrowHelper(d.clone().negate(), c.clone().add(d.clone().multiplyScalar(3.4)), 2.4, 0xe9ad56, .5, .3); this.scene.add(this.arrow);
  }
  // État de l'orientation réellement affichée : substituant 4 à l'arrière ?
  orientation(centerAtom, atom4) {
    const c = this.world(centerAtom), p4 = this.world(atom4);
    const toCam = this.camera.position.clone().sub(c).normalize(), to4 = p4.sub(c).normalize();
    const d = toCam.dot(to4); return { d, state: d < -.6 ? 'back' : d > .6 ? 'front' : 'side' };
  }
  // Positions écran (x droite, y haut) pour la lecture du sens de rotation depuis la vue actuelle
  screenOf(atom) { const p = this.world(atom).project(this.camera); return [p.x, p.y]; }
}
