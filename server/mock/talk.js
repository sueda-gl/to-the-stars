// The offline mind for /api/talk: the sim's own templated talk engine (web/js/sim/talk.js), so the browser's offline
// fallback and the server's mock say the same things. Deterministic per (agent, text, history length).
import { mockTalk as simTalk, trimReply, talkIntent } from '../../web/js/sim/talk.js';

export const TALK_ACTIONS = ['none', 'build', 'rest', 'assign', 'ask_crowd', 'call_meeting'];

export function mockTalk({ agent = {}, text = '', history = [], snapshot = {} } = {}) {
  const r = simTalk({ agent, text, history, snapshot });
  return { reply: r.reply, mood: r.mood, action: r.action ? { type: r.action.type, request: r.action.request || '', text: r.action.text || r.action.say || '' } : null, intent: talkIntent(text) };
}

export { trimReply };
