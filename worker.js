import { handler, merge } from './fn';
import Context from './context';

const context = new Context();

process.on('message', async ({ type, seq, payload }) => {
  if (type === 'request') {
    let res;
    try {
      res = await handler(payload, context);
    } catch (e) {
      res = { code: 500, body: { error: e.message } };
    }
    process.send({ type: 'response', seq, payload: res });

    if (context.changed.size === 0) {
      return;
    }

    const changed = Array.from(context.changed).map((key) => {
      return { key, entry: context.getRaw(key) };
    });
    context.changed.clear();

    process.send({ type: 'changes', payload: changed });
  } else if (type === 'changes') {
    for (const { key, entry } of payload) {
      const existing = context.getRaw(key);

      // New entry, just copy
      if (!existing) {
        context.setRaw(key, entry);
        continue;
      }

      existing.ttl = Math.max(existing.ttl, entry.ttl);
      existing.expiresAt = Math.max(existing.expiresAt, entry.expiresAt);

      existing.value = merge(key, existing.value, entry.value);
    }
  }
});
