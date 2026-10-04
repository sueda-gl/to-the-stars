// Generated-code checks: forbidden tokens (on a tokenised view of the code), syntax, shape, and a dry run
// inside a fresh node:vm context (no host globals, eval/new Function disabled, hard timeout).
// The scan is a blacklist and the browser is where the code finally runs, so the two real guards are:
//   1. 'use strict' is prepended to every stored asset (harden), so `this` in build() is undefined everywhere;
//   2. the dry run never runs in the server's realm.
import vm from 'node:vm';

export const FORBIDDEN = [
  { re: /(?<![.\w$])window\b/, label: 'window' },
  { re: /(?<![.\w$])document\b/, label: 'document' },
  { re: /\bglobalThis\b/, label: 'globalThis' },
  { re: /(?<![.\w$])(self|top|parent|frames|location|origin)\b/, label: 'self/top/parent/location' },
  { re: /(?<![.\w$])this\b/, label: 'this' },
  { re: /\bconstructor\b/, label: 'constructor' },
  { re: /\b__proto__\b/, label: '__proto__' },
  { re: /\b(getPrototypeOf|setPrototypeOf|defineProperty|defineProperties)\b/, label: 'prototype access' },
  { re: /\b(Reflect|Proxy|Symbol)\b/, label: 'Reflect/Proxy/Symbol' },
  { re: /(?<![.\w$])fetch\b/, label: 'fetch' },
  { re: /\b(XMLHttpRequest|WebSocket|EventSource|Image|Audio|Worker|SharedWorker|importScripts|postMessage|queueMicrotask|structuredClone)\b/, label: 'browser API' },
  { re: /\bimport\b/, label: 'import' },
  { re: /\bexport\b/, label: 'export' },
  { re: /\beval\b/, label: 'eval' },
  { re: /\bFunction\b/, label: 'Function' },
  { re: /\bPromise\b/, label: 'Promise' },
  { re: /\b(async|await|yield)\b/, label: 'async/await/yield' },
  { re: /\bfromAsync\b/, label: 'fromAsync' },
  { re: /\b(localStorage|sessionStorage|indexedDB|caches|cookie)\b/, label: 'storage' },
  { re: /\b(setTimeout|setInterval|setImmediate|requestAnimationFrame|requestIdleCallback)\b/, label: 'timers' },
  { re: /\bwhile\s*\(\s*(true|1|!0|!\s*false|\d+)\s*\)/, label: 'while(true)' },
  { re: /\bfor\s*\([^;)]*;\s*;/, label: 'for(;;)' },
  { re: /\bdo\b/, label: 'do-while' },
  { re: /(?<![.\w$])process\b/, label: 'process' },
  { re: /\brequire\b/, label: 'require' },
  { re: /(?<![.\w$])navigator\b/, label: 'navigator' },
  { re: /\bwith\s*\(/, label: 'with' },
  { re: /\\u/, label: 'unicode escape outside a string' },
  { re: /#[\p{L}_$]/u, label: 'private field' },
  { re: /\b(fromCharCode|fromCodePoint|atob|btoa|codePointAt|charCodeAt|TextDecoder|TextEncoder|decodeURI|decodeURIComponent|unescape)\b/, label: 'string decoding (fromCharCode/atob)' },
  { re: /\bprototype\b/, label: 'prototype' },
];

// Words that must not appear even INSIDE a string literal: a string is the raw material of every smuggling trick
// (obj["constructor"], ["__proto__"], indirect lookups by name). Generated code has no legitimate use for them.
// Comments are skipped (they cannot execute, and a model that writes "// the window sill" should not be sent to repair).
export const FORBIDDEN_IN_STRINGS = /constructor|__proto__|prototype|Function|globalThis|window|fetch|eval|process|require|import|document|fromCharCode|atob/;

// The contents of every string literal (quotes and template chunks), for the raw-literal scan. Comments and regex
// literals are skipped by the same tokenizer the forbidden-token scan uses.
export function literalContents(code) {
  const strings = [];
  stripLiterals(code, strings);
  return strings;
}
export function scanLiterals(code) {
  const hits = [];
  for (const lit of literalContents(code)) {
    const m = lit.match(FORBIDDEN_IN_STRINGS);
    if (m) hits.push(`"${m[0]}" inside a string literal`);
  }
  return Array.from(new Set(hits));
}

// Characters after which a `/` starts a regex literal rather than a division.
const REGEX_PREFIX = /[(,=:[!&|?{};+\-*%<>~^]$|\b(return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else)$|^$/;

// Replace strings, comments and regex literals with "" so a word inside a label ("the window sill") is not a hit.
// Template literals keep their ${...} expressions, since those are code.
export function stripLiterals(code, strings = null) {
  const s = String(code);
  let out = '', i = 0;
  const n = s.length;
  const lastCode = () => out.replace(/\s+$/, '').slice(-12);
  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { while (i < n && s[i] !== '\n') i++; out += ' '; continue; }
    if (c === '/' && d === '*') { const e = s.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; out += ' '; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && s[j] !== c && s[j] !== '\n') { if (s[j] === '\\') j++; j++; }
      if (strings) strings.push(s.slice(i + 1, j));
      i = j + 1; out += '""'; continue;
    }
    if (c === '`') {
      let j = i + 1, chunk = i + 1;
      out += '""';
      while (j < n && s[j] !== '`') {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === '$' && s[j + 1] === '{') {
          // keep the expression text: walk to the matching brace (strings inside are left as-is, rare in prefabs)
          if (strings) strings.push(s.slice(chunk, j));
          let depth = 1, k = j + 2;
          while (k < n && depth) { if (s[k] === '{') depth++; else if (s[k] === '}') depth--; k++; }
          out += ' (' + stripLiterals(s.slice(j + 2, k - 1), strings) + ') ';
          j = k; chunk = k; continue;
        }
        j++;
      }
      if (strings) strings.push(s.slice(chunk, j));
      i = j + 1; continue;
    }
    if (c === '/' && REGEX_PREFIX.test(lastCode())) {
      let j = i + 1, inClass = false;
      while (j < n && s[j] !== '\n' && (inClass || s[j] !== '/')) {
        if (s[j] === '\\') j++; else if (s[j] === '[') inClass = true; else if (s[j] === ']') inClass = false;
        j++;
      }
      i = j + 1; out += '""'; continue;
    }
    out += c; i++;
  }
  return out;
}

export function scanForbidden(code) {
  const stripped = stripLiterals(code);
  const hits = FORBIDDEN.filter(f => f.re.test(stripped)).map(f => f.label);
  hits.push(...scanLiterals(code));
  const loops = (stripped.match(/\b(for|while)\b/g) || []).length;
  if (loops > 24) hits.push(`too many loops (${loops})`);
  return hits;
}

export const STRICT = "'use strict';";

// What the browser will run: new Function('api', code + '\nreturn build(api);'). The stored code starts with
// a 'use strict' directive so that wrapper body is strict (this === undefined) without the client doing anything.
export function harden(code) {
  const c = String(code).trimStart();
  return c.startsWith(STRICT) ? c : `${STRICT}\n${c}`;
}

// Parse exactly the way the browser will (strict). Parse only: the returned function is never called here.
export function compile(code) {
  return new Function('api', `${harden(code)}\nreturn build(api);`);
}

// A stub api, built INSIDE the vm context so no host-realm object (not even an array) is reachable from the code.
// Every property is a callable that returns another stub; stubs act like groups (add, children) and like numbers.
const STUB_SRC = `
  var make = function () {
    var fn = function () { return make(); };
    return new Proxy(fn, {
      get: function (t, prop) {
        if (prop === Symbol.toPrimitive) return function () { return 0; };
        if (prop === Symbol.iterator) return function () { return [][Symbol.iterator](); };
        if (typeof prop === 'symbol') return undefined;
        if (prop === 'then') return undefined;
        if (prop === 'constructor' || prop === '__proto__' || prop === 'prototype') throw new TypeError('api has no ' + String(prop));
        if (prop === 'length') return 0;
        if (prop === 'children') return [];
        return make();
      },
      apply: function () { return make(); },
      construct: function () { return make(); },
    });
  };
  var api = make();`;

const MAX_CODE_CHARS = 40000;
const DRY_RUN_MS = 1500;

// Runs build(api) in a throwaway context. Returns { ok:true, value } or { ok:false, error }.
export function dryRun(code, { timeout = DRY_RUN_MS } = {}) {
  const src = `${STRICT}\n(function () {\n${STUB_SRC}\n  var run = function (api) {\n${code}\nreturn build(api);\n  };\n  return run(api);\n})()`;
  try {
    // No host sandbox object (Object.create(null)), no eval / new Function, microtasks drained under the same timeout.
    const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false }, microtaskMode: 'afterEvaluate' });
    const script = new vm.Script(src, { filename: 'generated-asset.js' });
    const value = script.runInContext(context, { timeout, displayErrors: false });
    return { ok: true, value };
  } catch (e) {
    const msg = /Script execution timed out/.test(e?.message) ? `build(api) ran for more than ${timeout} ms (an endless or huge loop?)` : (e?.message || String(e));
    return { ok: false, error: msg };
  }
}

// Returns { ok:true } or { ok:false, errors:[...] }.
export function validateCode(code, { dryRun: doDryRun = true } = {}) {
  const errors = [];
  if (typeof code !== 'string' || !code.trim()) return { ok: false, errors: ['code is empty'] };
  if (code.length > MAX_CODE_CHARS) errors.push(`code is too long (${code.length} chars, max ${MAX_CODE_CHARS})`);
  if (!/\bfunction\s+build\s*\(\s*api\s*\)/.test(code)) errors.push('code must declare `function build(api) { ... }`');
  if (!/\breturn\b/.test(code)) errors.push('build(api) must return the group');
  const bad = scanForbidden(code);
  if (bad.length) errors.push(`forbidden tokens: ${bad.join(', ')}`);
  let parsed = false;
  try { compile(code); parsed = true; } catch (e) { errors.push(`syntax error: ${e.message}`); }
  if (parsed && doDryRun && !errors.length) {
    const r = dryRun(code);
    if (!r.ok) errors.push(`runtime error on a dry run with a stub api: ${r.error}`);
    else if (r.value === undefined || r.value === null) errors.push('build(api) returned nothing; return the group');
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
