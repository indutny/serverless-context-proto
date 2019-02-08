import { fork } from 'child_process';
import { EventEmitter } from 'events';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';

const CPU_COUNT = os.cpus().length;
const WORKER_FILE = path.join(__dirname, 'worker.js');

class Worker extends EventEmitter {
  constructor() {
    super();

    this.proc = fork(WORKER_FILE, {
      ipc: [ null, 'inherit', 'inherit', 'ipc' ],
    });

    this.seq = 0;
    this.queue = new Map();

    this.proc.on('message', ({ type, seq, payload = {} }) => {
      if (type === 'changes') {
        this.emit('broadcast', type, payload);
      } else if (type === 'response') {
        const res = this.queue.get(seq);
        this.queue.delete(seq);

        res.writeHead(payload.code || 200, payload.headers || {});
        res.end(JSON.stringify(payload.body || {}));
      }
    });
  }

  send(type, payload, seq) {
    this.proc.send({ type, seq, payload });
  }

  balance(req, res) {
    const seq = this.seq;
    this.seq = (this.seq + 1) >>> 0;

    this.queue.set(seq, res);

    this.send('request', {
      method: req.method,
      url: req.url,
      headers: req.headers,
    }, seq);
  }
}

const workers = [];
for (let i = 0; i < CPU_COUNT; i++) {
  const worker = new Worker();

  worker.on('broadcast', (type, payload) => {
    // Broadcast
    for (const sibling of workers) {
      if (sibling !== worker) {
        sibling.send(type, payload);
      }
    }
  });

  workers.push(worker);
}

const server = http.createServer((req, res) => {
  // Pick random worker
  const worker = workers[(workers.length * Math.random()) | 0];

  worker.balance(req, res);
}).listen(8000, () => {
  const addr = server.address();
  let host = addr.address;
  if (addr.family === 'IPv6') {
    host = `[${host}]`;
  }
  console.error('Listening on %s:%d', host, addr.port);
});
