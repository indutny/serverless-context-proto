import { parse as parseURL } from 'url';
import { parse as parseQuery } from 'querystring';

const TTL = 3600;  // 1 hour TTL

function uuid() {
  return (Math.random() * 0xffffffff) >>> 0;
}

function results(votes) {
  const counter = new Map();
  for (const { key } of votes) {
    const last = counter.get(key) || 0;
    counter.set(key, last + 1);
  }

  return Array.from(counter.entries());
}

export const handler = async (req, ctx) => {
  const url = parseURL(req.url);
  const query = parseQuery(url.query) || {};

  const poll = ctx.get('poll' + query.url, () => ({
    votes: [],
    results: results([]),
  }));

  if (req.method === 'GET') {
    return { body: { ok: true, data: poll.results } };
  }

  if (req.method !== 'PUT') {
    return { status: 400, body: { error: 'Invalid method' } };
  }

  const key = query.key;
  if (!key) {
    return { status: 400, body: { error: 'Invalid key' } };
  }

  poll.votes.push({ key, uuid: uuid() });

  // Update cached value
  poll.results = results(poll.votes);

  ctx.set('poll' + query.url, poll, TTL);

  return { body: { ok: true, data: poll.results } };
};

export const merge = (key, a, b) => {
  if (!key.startsWith('poll')) {
    return a;
  }

  const uuids = new Set();
  for (const vote of a.votes) {
    uuids.add(vote.uuid);
  }

  const missing = [];
  for (const vote of b.votes) {
    if (!uuids.has(vote.uuid)) {
      missing.push(vote);
    }
  }

  if (missing.length === 0) {
    return a;
  }

  if (b.votes.length === a.votes.length + missing.length) {
    return b;
  }

  const votes = a.votes.concat(missing);
  return {
    votes,
    results: results(votes),
  };
};
