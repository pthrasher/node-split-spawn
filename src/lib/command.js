import { defaults } from 'lodash';
import kill from 'tree-kill';
import crossSpawn from 'cross-spawn';
import blessed from 'blessed';

const opts = {
  // eslint-disable-next-line prefer-object-spread
  env: Object.assign({}, process.env, { FORCE_COLOR: true }),
  stdio: 'pipe',
  cwd: process.cwd(),
};

const shell = process.platform === 'win32'
  ? { cmd: 'cmd', arg: '/C' }
  : { cmd: 'sh', arg: '-c' };

export default class Command {
  constructor(command, opt = {}, boxOpt = {}) {
    this.opt = opt;
    this.boxOpt = boxOpt;
    this.command = command;

    this.error = '';
    this.output = '';
    this.exitCode = null;
    this.execError = null;
    this.cpHandler = null;
  }

  createBox() {
    this.box = blessed.box(defaults(this.boxOpt, {
      // top: '0',
      // left: '0',
      // width: '40%',
      // height: '50%',
      border: {
        type: 'line',
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      scrollbar: {
        ch: '|',
        fg: '#f0a0a0',
      },
    }));
  }

  run(refresh) {
    try {
      this.cpHandler = crossSpawn(shell.cmd, [shell.arg, this.command], opts);
    } catch (e) {
      this.cpHandler = {};
      process.nextTick(() => {
        this.execError = e;
        this.cpHandler = null;
        refresh();
      });
      return;
    }
    const { cpHandler } = this;

    cpHandler.stdout.on('data', (data) => {
      this.box.setContent(this.output += data);
      this.box.setScrollPerc(100);
      refresh();
    });

    cpHandler.stderr.on('data', (data) => {
      this.error += data;
      this.box.setContent(this.output += data);
      refresh();
    });

    cpHandler.on('close', (code) => {
      this.exitCode = code;
      this.box.setContent(this.output += `child process exited with code ${code}`);
      refresh();
    });

    cpHandler.on('error', (err) => {
      this.execError = err;
      this.box.setContent(this.output += `child process error ${err}`);
      refresh();
    });
  }

  shutdown() {
    if (this.isRunning()) {
      return new Promise(
        (res, rej) => kill(this.cpHandler.pid, null, (err) => (err ? rej(err) : res())),
      );
    }
    return Promise.resolve();
  }

  isFailed() {
    return this.execError !== null;
  }

  isOk() {
    return this.exitCode === 0 && this.execError === null;
  }

  isRunning() {
    return this.cpHandler !== null && (this.exitCode === null && this.execError === null);
  }

  hasErrors() {
    return this.error !== '';
  }
}
