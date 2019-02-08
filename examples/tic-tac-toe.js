// TODO(indutny): Make the game playable

import { parse as parseURL } from 'url';
import { parse as parseQuery } from 'querystring';

const TTL = 3600;  // 1 hour TTL

export const handler = async (req, ctx) => {
  const url = parseURL(req.url);
  const query = parseQuery(url.query) || {};

  const game = ctx.get('game', () => {
    return {
      turn: 0,
      field: [
        [ 0, 0, 0 ],
        [ 0, 0, 0 ],
        [ 0, 0, 0 ],
      ],
    };
  });

  if (req.method === 'GET') {
    return { body: { ok: true, data: game } };
  }

  if (req.method !== 'PUT') {
    return { status: 400, body: { error: 'Invalid method' } };
  }

  const x = parseInt(query.x, 10) | 0;
  const y = parseInt(query.y, 10) | 0;
  const player = parseInt(query.player, 10) | 0;

  if (player !== (game.turn % 2)) {
    return { status: 400, body: { error: 'It is not your turn now' } };
  }

  const field = game.field;

  if (y < 0 || y > field.length || x < 0 || x > field[0].length) {
    return { status: 400, body: { error: 'Invalid coordinates' } };
  }

  if (field[y][x] !== 0) {
    return { status: 400, body: { error: 'Cell already occupied' } };
  }

  // Pass turn to the next player
  game.turn++;

  // Update field
  field[y][x] = player ? 'O' : 'X';

  ctx.set('game', game, TTL);

  return { body: { ok: true, data: game } };
};

export const merge = (key, a, b) => {
  if (key !== 'game') {
    return a;
  }

  if (a.turn > b.turn) {
    return a;
  } else {
    return b;
  }
};
