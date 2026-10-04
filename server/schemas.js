// JSON schemas for structured outputs (output_config.format) and the §4 action validator.
// Structured-output rules: every object has additionalProperties:false and lists all keys in
// `required`; optional fields are nullable. No min/max, no recursion (the SDK would strip them anyway).
import { SKILLS, RESOURCES } from './catalogue.js';

const S = (type) => ({ type });
const NULLABLE = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const STR = S('string'), INT = S('integer'), NUM = S('number'), BOOL = S('boolean');
const OBJ = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const ARR = (items) => ({ type: 'array', items });
const ENUM = (values) => ({ type: 'string', enum: values });

export const ACTION_TYPES = ['build', 'ask_crowd', 'appoint_minister', 'assign', 'reply_letter', 'demolish', 'call_meeting', 'message_agent', 'trade', 'name_settlement',
  'send_gift', 'visit_neighbour', 'go_moon', 'moon', 'show', 'found_institution', 'resolve_conflict', 'noop'];   // §4 + §9 + ART_DIRECTION §15
export const HOWS = ['talk', 'punish', 'compensate', 'ignore'];   // resolve_conflict: how (free text is kept too; the sim maps it)
export const INSTITUTION_KINDS = ['police patrol', 'night watch', 'court', 'school', 'guild', 'festival committee'];   // + free text
export const MOON_DOS = ['seed', 'golden_hour', 'daylight', 'greet', 'gift', 'go_home'];
export const SHOW_TARGETS = ['globe', 'home'];
export const SCENES = ['earth', 'moon'];
export const CATEGORIES = ['building', 'prop', 'landmark', 'nature'];
export const AT_MODES = ['pointer', 'center', 'near', 'auto', 'mark', 'water'];   // 'mark' = exactly on the cursor mark (§10); 'water' = afloat (the sim's addition)
export const MARK_KINDS = ['point', 'area', 'line'];
export const DECISIONS = ['yes', 'no', 'other'];

// One flat action object: `type` picks which fields matter. The API caps union-typed (nullable) parameters at 16
// per schema (a live 400 otherwise), so unused fields are EMPTY, not null: "" for strings, 0 for numbers, [] for
// arrays; only `at.x` / `at.z` and `say` stay nullable. The normaliser treats both empty and null as unset.
export const ACTION_SCHEMA = OBJ({
  type: ENUM(ACTION_TYPES),
  kind: STR,                 // catalogue id, or "" for a new thing
  request: STR,
  name: STR,
  at: OBJ({ mode: ENUM(AT_MODES), ref: STR, x: NULLABLE(NUM), z: NULLABLE(NUM) }),
  count: INT,                // 0 = default (1)
  assign: ARR(STR),
  question: STR,
  skill: STR,                // one of SKILLS or ""
  agentId: STR,
  agentIds: ARR(STR),
  to: STR,
  letterId: STR,
  decision: STR,             // yes | no | other | ""
  text: STR,
  buildingId: STR,
  neighbourId: STR,
  give: ARR(OBJ({ res: ENUM(RESOURCES), n: INT })),
  get: ARR(OBJ({ res: ENUM(RESOURCES), n: INT })),
  gift: STR,                 // send_gift: what travels ("a basket of bread")
  do: STR,                   // moon: one of MOON_DOS or ""
  target: STR,               // show: globe | home | ""
  conflictId: STR,           // resolve_conflict: a conflict id from snapshot.conflicts, or "" for the newest open one
  how: STR,                  // resolve_conflict: talk | punish | compensate | ignore | the sovereign's own words
  why: STR,
});

export const COMMAND_SCHEMA = OBJ({
  actions: ARR(ACTION_SCHEMA),
  say: NULLABLE(OBJ({ from: ENUM(['minister', 'ministry']), text: STR })),
});

export const LETTER_KINDS = ['petition', 'gossip', 'complaint', 'idea', 'quarrel', 'conflict', 'reply', 'report', 'refusal', 'skill_answer', 'neighbour', 'notice', 'thanks', 'election', 'shadeling', 'envoy'];
export const FROM_KINDS = ['agent', 'minister', 'ministry', 'neighbour'];

export const LETTER_DRAFT_SCHEMA = OBJ({
  from: OBJ({ kind: ENUM(FROM_KINDS), id: NULLABLE(STR), name: STR }),
  subject: STR,
  body: STR,
  kind: ENUM(LETTER_KINDS),
  options: ARR(OBJ({ label: STR, says: STR })),
});

export const SOCIETY_EVENT_KINDS = ['mood', 'loyalty', 'gossip', 'arrival', 'departure', 'neighbour', 'strike', 'quarrel'];
export const SOCIETY_SCHEMA = OBJ({
  letters: ARR(LETTER_DRAFT_SCHEMA),
  events: ARR(OBJ({ kind: ENUM(SOCIETY_EVENT_KINDS), agentId: NULLABLE(STR), neighbourId: NULLABLE(STR), delta: NULLABLE(INT), note: STR })),
});

export const LETTER_SCHEMA = OBJ({
  subject: STR,
  body: STR,
  options: ARR(OBJ({ label: STR, says: STR })),
});

export const CODEGEN_SCHEMA = OBJ({
  name: STR,
  aliases: ARR(STR),
  meta: OBJ({
    footprint: OBJ({ w: NUM, d: NUM }),
    cost: OBJ({ wood: INT, stone: INT, coin: INT, food: INT, goods: INT }),
    workers: INT,
    skill: ENUM(SKILLS),
    buildSeconds: INT,
    perDay: OBJ({ food: INT, wood: INT, stone: INT, coin: INT, goods: INT }),
    housing: INT,
    desc: STR,
    category: ENUM(CATEGORIES),
    areas: OBJ({ money: INT, happiness: INT, science: INT }),   // ART_DIRECTION §22b: what raising it gives (0-5 each)
  }),
  code: STR,
});

// Talk (ART_DIRECTION §11): one folk's bubble answer. No nullable fields (0 union-typed parameters).
export const TALK_ACTION_TYPES = ['none', 'build', 'rest', 'assign', 'ask_crowd', 'call_meeting'];
export const TALK_SCHEMA = OBJ({
  reply: STR,                // 1-2 plain sentences
  mood: INT,                 // -5..5
  action: OBJ({ type: ENUM(TALK_ACTION_TYPES), request: STR, text: STR }),
});
// -> { reply, mood, action|null }: the reply trimmed to two short sentences, the mood clamped, 'none' -> null
export function normaliseTalk(data, { trim = (s) => s } = {}) {
  if (!data || typeof data !== 'object' || !isStr(data.reply)) return null;
  const reply = trim(String(data.reply));
  if (!reply) return null;
  const mood = Number.isFinite(Number(data.mood)) ? Math.max(-5, Math.min(5, Math.round(Number(data.mood)))) : 0;
  const a = data.action && typeof data.action === 'object' ? data.action : null;
  let action = null;
  if (a && TALK_ACTION_TYPES.includes(a.type) && a.type !== 'none') {
    const request = isStr(a.request) ? a.request.trim().slice(0, 120) : '';
    const text = isStr(a.text) ? a.text.trim().slice(0, 160) : '';
    if (a.type === 'build') action = request ? { type: 'build', request, text } : null;
    else if (a.type === 'assign') action = text ? { type: 'assign', request: '', text } : null;
    else if (a.type === 'ask_crowd') action = { type: 'ask_crowd', request: '', text: text || request };
    else action = { type: a.type, request: '', text: '' };
  }
  return { reply, mood, action };
}

// §8 massing sketch: a few primitives drawn in pencil while the real code is written.
export const SKETCH_SHAPES = ['box', 'cylinder', 'cone', 'sphere', 'gable', 'dome'];
export const SKETCH_SCHEMA = OBJ({
  name: STR,
  category: ENUM(CATEGORIES),
  footprint: OBJ({ w: NUM, d: NUM }),
  height: NUM,
  parts: ARR(OBJ({ shape: ENUM(SKETCH_SHAPES), x: NUM, y: NUM, z: NUM, w: NUM, h: NUM, d: NUM, r: NUM, rot: NUM, color: STR })),
});

// ---------- action normalisation / validation (LLM or mock -> §4 shape) ----------
const isStr = v => typeof v === 'string' && v.trim().length > 0;
const resMap = (arr) => {
  if (!arr) return null;
  if (!Array.isArray(arr)) return typeof arr === 'object' ? arr : null;
  const o = {}; for (const { res, n } of arr) if (RESOURCES.includes(res) && Number.isFinite(n) && n > 0) o[res] = Math.round(n);
  return Object.keys(o).length ? o : null;
};
const strip = (o) => { for (const k of Object.keys(o)) if ((o[k] === null && k !== 'kind') || o[k] === undefined) delete o[k]; return o; };

// Returns { ok, action?, reason? }. Known ids are checked against the snapshot when it is given.
// The letters a snapshot carries: the server contract says `letters[]`, the sim's own snapshot says `unread[]` (+ `recent[]`).
export function snapshotLetters(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const out = [];
  for (const key of ['letters', 'recent', 'unread']) for (const l of (Array.isArray(snapshot[key]) ? snapshot[key] : [])) if (l && l.id && !l.resolved && !out.some(o => o.id === l.id)) out.push(l);
  return out;
}
// Resources: contract `resources`, sim snapshot `res`.
export const snapshotResources = (snapshot) => (snapshot && typeof snapshot === 'object' && (snapshot.resources || snapshot.res)) || {};

// The cursor mark that rides on /api/command (ARCHITECTURE §10): the marks module's summarize() shape
// { kind:'point'|'area'|'line', centroid:{x,z}, bbox, areaM2 | length, nearest } or its current() shape ({x,z} / poly / pts).
// -> null | { kind, centroid:{x,z}, bbox?:{x0,z0,x1,z1,w,d}, areaM2?, length?, nearest?, id?, poly?, pts? }. Rounded to 0.1 m;
// a polygon / stroke is kept (the sim fills it) but never sent to the model (summariseMark strips it).
const fin = v => (Number.isFinite(Number(v)) ? Number(v) : null);
const r1 = v => Math.round(v * 10) / 10;
const pts = list => (Array.isArray(list) ? list.map(p => Array.isArray(p) ? [fin(p[0]), fin(p[1])] : p && typeof p === 'object' ? [fin(p.x), fin(p.z)] : [null, null]).filter(([x, z]) => x != null && z != null).map(([x, z]) => [r1(x), r1(z)]) : []);
function bboxOf(b, fallbackPts = []) {
  let x0, z0, x1, z1;
  if (b && typeof b === 'object') {
    if (b.min && b.max) [x0, z0, x1, z1] = [fin(b.min.x), fin(b.min.z), fin(b.max.x), fin(b.max.z)];
    else if (fin(b.x0) != null && fin(b.x1) != null) [x0, z0, x1, z1] = [fin(b.x0), fin(b.z0), fin(b.x1), fin(b.z1)];
    else if (fin(b.w) != null && fin(b.x) != null) [x0, z0, x1, z1] = [fin(b.x) - fin(b.w) / 2, fin(b.z) - fin(b.d) / 2, fin(b.x) + fin(b.w) / 2, fin(b.z) + fin(b.d) / 2];
  }
  if ([x0, z0, x1, z1].some(v => v == null) && fallbackPts.length) { x0 = Math.min(...fallbackPts.map(p => p[0])); x1 = Math.max(...fallbackPts.map(p => p[0])); z0 = Math.min(...fallbackPts.map(p => p[1])); z1 = Math.max(...fallbackPts.map(p => p[1])); }
  if ([x0, z0, x1, z1].some(v => v == null)) return null;
  const lo = (a, b) => Math.min(a, b), hi = (a, b) => Math.max(a, b);
  const X0 = r1(lo(x0, x1)), X1 = r1(hi(x0, x1)), Z0 = r1(lo(z0, z1)), Z1 = r1(hi(z0, z1));
  return { x0: X0, z0: Z0, x1: X1, z1: Z1, w: r1(X1 - X0), d: r1(Z1 - Z0) };
}
export function normaliseMark(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = MARK_KINDS.includes(raw.kind) ? raw.kind : null;
  const poly = pts(raw.poly), line = pts(raw.pts);
  const c = raw.centroid && typeof raw.centroid === 'object' ? raw.centroid : null;
  const k = kind || (poly.length >= 3 ? 'area' : line.length >= 2 ? 'line' : 'point');
  const bbox = k === 'point' ? null : bboxOf(raw.bbox, k === 'area' ? poly : line);
  let cx = fin(c?.x) ?? fin(raw.x), cz = fin(c?.z) ?? fin(raw.z);
  if ((cx == null || cz == null) && bbox) { cx = (bbox.x0 + bbox.x1) / 2; cz = (bbox.z0 + bbox.z1) / 2; }
  if ((cx == null || cz == null) && (poly[0] || line[0])) { [cx, cz] = poly[0] || line[0]; }
  if (cx == null || cz == null) return null;
  if (k !== 'point' && !bbox) return { kind: 'point', centroid: { x: r1(cx), z: r1(cz) } };   // an area / line with no extent is a point
  const out = { kind: k, centroid: { x: r1(cx), z: r1(cz) } };
  if (bbox) out.bbox = bbox;
  if (k === 'area') { const a = fin(raw.areaM2) ?? fin(raw.area); out.areaM2 = r1(a != null ? Math.max(0, a) : bbox.w * bbox.d); }
  if (k === 'line') { const l = fin(raw.length); out.length = r1(l != null ? Math.max(0, l) : Math.hypot(bbox.w, bbox.d)); }
  if (typeof raw.nearest === 'string' && raw.nearest.trim()) out.nearest = raw.nearest.trim().slice(0, 60);
  else if (raw.nearest && typeof raw.nearest === 'object') { const n = {}; for (const key of ['id', 'kind', 'name', 'dist']) if (raw.nearest[key] != null) n[key] = typeof raw.nearest[key] === 'number' ? r1(raw.nearest[key]) : String(raw.nearest[key]).slice(0, 40); if (Object.keys(n).length) out.nearest = n; }
  if (raw.id != null && (typeof raw.id === 'string' || typeof raw.id === 'number')) out.id = raw.id;
  if (poly.length >= 3) out.poly = poly;
  if (line.length >= 2) out.pts = line;
  return out;
}
// what the model sees: no polygon, no stroke
export function summariseMark(mark) {
  const m = normaliseMark(mark);
  if (!m) return null;
  const { poly, pts: _p, id, ...rest } = m;
  return rest;
}

export function normaliseAction(a, snapshot = null, catalogue = null, opts = {}) {
  if (!a || typeof a !== 'object' || !ACTION_TYPES.includes(a.type)) return { ok: false, reason: 'unknown action type' };
  const agentIds = new Set((snapshot?.agents || []).map(x => x.id));
  const buildingIds = new Set((snapshot?.buildings || []).map(x => x.id));
  const neighbourIds = new Set((snapshot?.neighbours || []).map(x => x.id));
  const letterIds = new Set(snapshotLetters(snapshot).map(x => x.id));
  const known = (set, id) => !snapshot || set.size === 0 || set.has(id);
  const scene = SCENES.includes(opts.scene) ? opts.scene : 'earth';
  const kindOk = (k) => !catalogue || catalogue.byId?.has(k);
  switch (a.type) {
    case 'build': {
      let kind = isStr(a.kind) ? a.kind.trim().toLowerCase() : null;
      if (kind && !kindOk(kind)) { a.request = a.request || kind; kind = null; }
      if (!kind && !isStr(a.request)) return { ok: false, reason: 'build needs kind or request' };
      let at = a.at && AT_MODES.includes(a.at.mode) ? { mode: a.at.mode } : { mode: 'auto' };
      if (a.at?.ref && isStr(a.at.ref)) at.ref = a.at.ref;
      if (Number.isFinite(a.at?.x) && Number.isFinite(a.at?.z)) { at.x = a.at.x; at.z = a.at.z; }
      if (at.mode === 'water') { at.water = a.at.water === 'sea' ? 'sea' : 'lake'; }
      // The mark on the paper (§10). "There / here / this" with a mark means the mark, so a pointer placement becomes a mark
      // placement whenever one exists (a point mark beats the pointer); a mark placement without any mark falls back to the pointer.
      const mark = opts.mark === undefined ? null : normaliseMark(opts.mark);
      if (mark && (at.mode === 'mark' || at.mode === 'pointer')) { at = { mode: 'mark', x: mark.centroid.x, z: mark.centroid.z, mark }; }
      else if (at.mode === 'mark') at = opts.pointer && Number.isFinite(opts.pointer.x) && Number.isFinite(opts.pointer.z) ? { mode: 'pointer' } : { mode: 'auto' };
      if (at.mode === 'near' && !at.ref) at.mode = 'auto';
      if (at.mode === 'near' && at.ref && !['water', 'edge'].includes(at.ref) && !buildingIds.has(at.ref) && !neighbourIds.has(at.ref)) {
        const ref = at.ref.toLowerCase();
        const byKind = (snapshot?.buildings || []).find(b => b.kind === ref || b.name?.toLowerCase() === ref) || (snapshot?.neighbours || []).find(n => n.name?.toLowerCase() === ref);
        if (byKind) at.ref = byKind.id;
        else if (buildingIds.size || neighbourIds.size) { at.mode = 'auto'; delete at.ref; }
      }
      const count = Number.isFinite(a.count) && a.count > 0 ? Math.max(1, Math.min(6, Math.round(a.count))) : null;
      const assign = Array.isArray(a.assign) ? a.assign.filter(id => isStr(id) && known(agentIds, id)) : null;
      return { ok: true, action: strip({ type: 'build', kind: kind || null, request: isStr(a.request) ? a.request.trim() : null, name: isStr(a.name) ? a.name.trim() : null, at, count: count && count > 1 ? count : null, assign: assign?.length ? assign : null }) };
    }
    case 'ask_crowd':
      if (!isStr(a.question)) return { ok: false, reason: 'ask_crowd needs a question' };
      return { ok: true, action: strip({ type: 'ask_crowd', question: a.question.trim(), skill: SKILLS.includes(a.skill) ? a.skill : null }) };
    case 'appoint_minister':
      if (!isStr(a.agentId) || !known(agentIds, a.agentId)) return { ok: false, reason: 'unknown agentId' };
      return { ok: true, action: { type: 'appoint_minister', agentId: a.agentId } };
    case 'assign': {
      const ids = (a.agentIds || (a.agentId ? [a.agentId] : [])).filter(id => isStr(id) && known(agentIds, id));
      if (!ids.length) return { ok: false, reason: 'assign needs known agentIds' };
      const to = isStr(a.to) ? a.to : 'idle';
      if (!['idle', 'rest'].includes(to) && !known(buildingIds, to)) return { ok: false, reason: 'unknown building for assign' };
      return { ok: true, action: { type: 'assign', agentIds: ids, to } };
    }
    case 'reply_letter':
      if (!isStr(a.letterId) || !known(letterIds, a.letterId)) return { ok: false, reason: 'unknown letterId' };
      return { ok: true, action: { type: 'reply_letter', letterId: a.letterId, decision: DECISIONS.includes(a.decision) ? a.decision : 'other', text: isStr(a.text) ? a.text.trim() : '' } };
    case 'demolish':
      if (!isStr(a.buildingId) || !known(buildingIds, a.buildingId)) return { ok: false, reason: 'unknown buildingId' };
      return { ok: true, action: { type: 'demolish', buildingId: a.buildingId } };
    case 'call_meeting': return { ok: true, action: { type: 'call_meeting' } };
    case 'message_agent':
      if (!isStr(a.agentId) || !known(agentIds, a.agentId) || !isStr(a.text)) return { ok: false, reason: 'message_agent needs agentId and text' };
      return { ok: true, action: { type: 'message_agent', agentId: a.agentId, text: a.text.trim() } };
    case 'trade': {
      const give = resMap(a.give), get = resMap(a.get);
      if (!isStr(a.neighbourId) || !known(neighbourIds, a.neighbourId) || !give || !get) return { ok: false, reason: 'trade needs neighbourId, give and get' };
      return { ok: true, action: { type: 'trade', neighbourId: a.neighbourId, give, get } };
    }
    case 'name_settlement':
      if (!isStr(a.name)) return { ok: false, reason: 'name_settlement needs a name' };
      return { ok: true, action: { type: 'name_settlement', name: a.name.trim() } };
    // ---- §9 ----
    case 'send_gift': {
      if (!isStr(a.neighbourId) || !known(neighbourIds, a.neighbourId)) return { ok: false, reason: 'send_gift needs a known neighbourId' };
      const give = resMap(a.give);
      return { ok: true, action: strip({ type: 'send_gift', neighbourId: a.neighbourId, gift: isStr(a.gift) ? a.gift.trim() : 'a gift', give }) };
    }
    case 'visit_neighbour':
      if (!isStr(a.neighbourId) || !known(neighbourIds, a.neighbourId)) return { ok: false, reason: 'visit_neighbour needs a known neighbourId' };
      return { ok: true, action: { type: 'visit_neighbour', neighbourId: a.neighbourId } };
    case 'go_moon':
      if (scene === 'moon') return { ok: false, reason: 'already on the moon' };
      return { ok: true, action: { type: 'go_moon' } };
    case 'moon':
      if (scene !== 'moon') return { ok: false, reason: 'moon actions are only valid on the moon' };
      if (!MOON_DOS.includes(a.do)) return { ok: false, reason: 'moon needs do' };
      return { ok: true, action: strip({ type: 'moon', do: a.do, text: isStr(a.text) ? a.text.trim() : null }) };
    case 'show':
      return { ok: true, action: { type: 'show', target: SHOW_TARGETS.includes(a.target) ? a.target : 'globe' } };
    // ---- ART_DIRECTION §15 ----
    // found_institution: kind = what the sovereign called it ("police patrol", "night watch", "court", "builders' guild", anything);
    // count = members (0 = the kind's default), agentId = the leader, request = a place to raise for it ("a watchtower"), name = its title
    case 'found_institution': {
      const kind = isStr(a.kind) ? a.kind.trim().toLowerCase() : isStr(a.name) ? a.name.trim().toLowerCase() : null;
      if (!kind) return { ok: false, reason: 'found_institution needs a kind' };
      const members = Number.isFinite(a.members ?? a.count) && (a.members ?? a.count) > 0 ? Math.max(1, Math.min(6, Math.round(a.members ?? a.count))) : null;
      const leader = isStr(a.leader) ? a.leader : isStr(a.agentId) && known(agentIds, a.agentId) ? a.agentId : null;
      return { ok: true, action: strip({ type: 'found_institution', kind, members, leader, name: isStr(a.name) && a.name.trim().toLowerCase() !== kind ? a.name.trim() : null, request: isStr(a.request) ? a.request.trim() : null }) };
    }
    // resolve_conflict: conflictId from snapshot.conflicts (unknown ids are dropped: the sim takes the newest open one); how = a word or the sovereign's phrase
    case 'resolve_conflict': {
      const conflictIds = new Set((snapshot?.conflicts || []).map(c => c.id));
      const conflictId = isStr(a.conflictId) && (!snapshot || conflictIds.size === 0 || conflictIds.has(a.conflictId)) ? a.conflictId.trim() : null;
      const how = isStr(a.how) ? a.how.trim().toLowerCase() : isStr(a.text) ? a.text.trim().toLowerCase() : 'talk';
      return { ok: true, action: strip({ type: 'resolve_conflict', conflictId, how: HOWS.includes(how) ? how : how.slice(0, 120) }) };
    }
    case 'noop': return { ok: true, action: { type: 'noop', why: isStr(a.why) ? a.why.trim() : 'could not map that' } };
  }
  return { ok: false, reason: 'unreachable' };
}

export function normaliseActions(actions, snapshot, catalogue, opts = {}) {
  const out = [], dropped = [];
  const seen = new Set();
  for (const a of Array.isArray(actions) ? actions : []) {
    const r = normaliseAction(a, snapshot, catalogue, opts);
    if (!r.ok) { dropped.push({ action: a, reason: r.reason }); continue; }
    // One answer per letter, one meeting, one minister, one voyage per utterance (mock and live minds both repeat themselves).
    const key = r.action.type === 'reply_letter' ? `reply:${r.action.letterId}` : ['call_meeting', 'appoint_minister', 'name_settlement', 'go_moon', 'show', 'visit_neighbour'].includes(r.action.type) ? r.action.type : null;
    if (key) { if (seen.has(key)) { dropped.push({ action: a, reason: `duplicate ${r.action.type}` }); continue; } seen.add(key); }
    out.push(r.action);
  }
  return { actions: out, dropped };
}

export function normaliseLetterDraft(l) {
  if (!l || typeof l !== 'object' || !isStr(l.subject) || !isStr(l.body)) return null;
  const from = l.from && typeof l.from === 'object' ? l.from : { kind: 'agent', id: null, name: 'Someone' };
  return {
    from: { kind: FROM_KINDS.includes(from.kind) ? from.kind : 'agent', id: isStr(from.id) ? from.id : null, name: isStr(from.name) ? from.name : 'Someone' },
    subject: l.subject.trim(), body: l.body.trim(),
    kind: LETTER_KINDS.includes(l.kind) ? l.kind : 'petition',
    options: normaliseOptions(l.options),
  };
}

export function normaliseOptions(options) {
  return (Array.isArray(options) ? options : []).filter(o => o && isStr(o.label) && isStr(o.says)).slice(0, 3).map(o => ({ label: o.label.trim(), says: o.says.trim() }));
}

export function normaliseCodegenMeta(m = {}) {
  const ints = (o, keys) => { const r = {}; for (const k of keys) { const v = Math.round(Number(o?.[k] ?? 0)); if (v) r[k] = v; } return r; };
  return {
    footprint: { w: Math.max(1, Number(m.footprint?.w) || 3), d: Math.max(1, Number(m.footprint?.d) || 3) },
    cost: Object.keys(ints(m.cost, RESOURCES)).length ? ints(m.cost, RESOURCES) : { wood: 10, stone: 10 },
    workers: Math.max(1, Math.min(6, Math.round(Number(m.workers) || 2))),
    skill: SKILLS.includes(m.skill) ? m.skill : 'building',
    buildSeconds: Math.max(10, Math.min(300, Math.round(Number(m.buildSeconds) || 70))),
    perDay: ints(m.perDay, RESOURCES),
    housing: Math.max(0, Math.round(Number(m.housing) || 0)),
    desc: isStr(m.desc) ? m.desc.trim() : '',
    category: CATEGORIES.includes(m.category) ? m.category : guessCategory(m.desc || ''),
    ...(areasOf(m.areas) ? { areas: areasOf(m.areas) } : {}),   // §22b, optional: the sim classifies by words when it is missing
  };
}
function areasOf(a) {
  if (!a || typeof a !== 'object') return null;
  const out = {};
  for (const k of ['money', 'happiness', 'science']) { const n = Math.round(Number(a[k])); if (Number.isFinite(n) && n > 0) out[k] = Math.min(6, n); }
  return Object.keys(out).length ? out : null;
}

// A category from words, for assets whose meta lacks one (older cache files, mock, a model that forgot).
export function guessCategory(text = '') {
  const t = String(text).toLowerCase();
  if (/\b(tree|grove|oak|pine|palm|bush|hedge|flower|garden|rock|boulder|hill|reef)\b/.test(t)) return 'nature';
  if (/\b(statue|monument|obelisk|lighthouse|tower|arch|column|pillar|fountain|rocket|bridge|wonder|temple|beacon|totem|dragon)\b/.test(t)) return 'landmark';
  if (/\b(duck|boat|ship|cart|wagon|bench|barrel|crate|lantern|sign|well|pot|wheel|ball|kite|tent|umbrella|basket|toy)\b/.test(t)) return 'prop';
  return 'building';
}

// §8 sketch normaliser: ≤ 16 parts, finite numbers, hex colours from the Red arch grammar (anything else -> limestone).
export const SKETCH_PALETTE = {
  terracotta: '#c8553d', limestone: '#e8dcc4', red: '#c23a2c', cream: '#f3ecdc', teal: '#5f9ea0', sea: '#4f8a8b', olive: '#6b7f3a',
  pine: '#3f5a3a', ink: '#2a2520', stone: '#b9ad98', wood: '#8a5a3c', pink: '#e39a8c', gold: '#d9a441', glass: '#9fb7c4', trunk: '#6e4b35',
};
const HEX = /^#[0-9a-f]{6}$/i;
export function normaliseSketch(s, request = '') {
  if (!s || typeof s !== 'object') return null;
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const parts = (Array.isArray(s.parts) ? s.parts : []).slice(0, 16).map(p => {
    if (!p || typeof p !== 'object') return null;
    const shape = SKETCH_SHAPES.includes(p.shape) ? p.shape : 'box';
    const round = ['cylinder', 'cone', 'sphere', 'dome'].includes(shape);
    const r3 = (v) => Math.round(v * 1000) / 1000;
    const r = round ? Math.max(0.05, num(p.r, num(p.w, 1) / 2)) : 0;
    return { shape, x: r3(num(p.x, 0)), y: r3(num(p.y, 0)), z: r3(num(p.z, 0)), w: r3(Math.max(0.1, round ? 2 * r : num(p.w, 1))), h: r3(Math.max(0.1, shape === 'sphere' ? 2 * r : num(p.h, round && shape !== 'cylinder' && shape !== 'cone' ? r : 1))), d: r3(Math.max(0.1, round ? 2 * r : num(p.d, 1))), r: r3(r), rot: r3(num(p.rot, 0)), color: HEX.test(p.color || '') ? String(p.color).toLowerCase() : SKETCH_PALETTE.limestone };
  }).filter(Boolean);
  if (!parts.length) return null;
  const top = Math.max(...parts.map(p => p.y + (p.shape === 'sphere' || p.shape === 'dome' ? p.r : p.h / 2)));
  // half-extent along an axis: boxes by their side, round things by radius (a tipped cylinder by its half-length)
  const span = (k, w) => 2 * Math.max(...parts.map(p => Math.abs(p[k]) + (p.shape === 'box' || p.shape === 'gable' ? (p.rot ? Math.hypot(p.w, p.d) / 2 : p[w] / 2) : p.r)));
  const name = isStr(s.name) ? s.name.trim().slice(0, 40) : (request.replace(/^(a|an|the)\s+/i, '').slice(0, 40) || 'Thing');
  return {
    name, category: CATEGORIES.includes(s.category) ? s.category : guessCategory(`${name} ${request}`),
    footprint: { w: Math.max(1, Math.round(num(s.footprint?.w, span('x', 'w')) * 10) / 10), d: Math.max(1, Math.round(num(s.footprint?.d, span('z', 'd')) * 10) / 10) },
    height: Math.max(0.5, Math.round(num(s.height, top) * 10) / 10),
    parts,
  };
}
