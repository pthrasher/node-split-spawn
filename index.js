'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var lodash = require('lodash');
var blessed = _interopDefault(require('blessed'));
var kill = _interopDefault(require('tree-kill'));
var cp = _interopDefault(require('child_process'));

const streamMap = {
  0: 'out',
  1: 'output',
  2: 'error'
};

class Viewer {
  constructor(commands, opt = {}, boxOpt = {}) {
    this.opt = opt;
    this.boxOpt = boxOpt;
    this.commands = commands;

    this.output = '';
    this.error = '';
    this.out = '';
    this.exitCode = null;
    this.execError = null;
    this.cpHandler = null;

    this.selectedStream = 0;
    this.selectedIndex = -1;
  }

  createBox() {
    this.box = blessed.box(lodash.defaults(this.boxOpt, {
      top: '10%',
      left: '0',
      width: '100%',
      height: '90%',
      border: {
        type: 'line'
      },
      tags: false,
      hidden: true,
      valign: 'bottom',
      scrollable: true,
      alwaysScroll: true,
      mouse: false,
      keys: true,
      scrollbar: {
        ch: '|',
        fg: '#f0a0a0'
      }
    }));
    this.box.on('keypress', (ch, key) => {
      if (key.name === 'right' || key.name === 'k') {
        if (this.selectedStream++ > 2) {
          this.selectedStream = 0;
        }
        this.refresh();
        this.box.screen.render();
        return;
      }
      if (key.name === 'left' || key.name === 'j') {
        if (this.selectedStream-- < 0) {
          this.selectedStream = 2;
        }
        this.refresh();
        this.box.screen.render();
        return;
      }
      if (key.name === 'escape') {
        this.selectedIndex = -1;
        this.refresh();
        this.box.screen.render();
        return;
      }
    });
  }

  formatOutput() {
    const com = this.commands[this.selectedIndex];
    if (!com) {
      this.box.setContent('');
      this.box.hide();
      return;
    }
    this.box.setContent(com[streamMap[this.selectedStream]]);
  }

  refresh() {
    this.formatOutput();
  }
}

class Command {
  constructor(command, opt = {}, boxOpt = {}) {
    this.opt = opt;
    this.boxOpt = boxOpt;
    this.command = command;

    this.output = '';
    this.error = '';
    this.out = '';
    this.exitCode = null;
    this.execError = null;
    this.cpHandler = null;
  }

  createBox() {
    this.box = blessed.box(lodash.defaults(this.boxOpt, {
      // top: '0',
      // left: '0',
      // width: '40%',
      // height: '50%',
      border: {
        type: 'line'
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      scrollbar: {
        ch: '|',
        fg: '#f0a0a0'
      }
    }));
  }

  run(refresh) {
    try {
      this.cpHandler = cp.spawn(this.command, this.opt);
    } catch (e) {
      this.cpHandler = {};
      process.nextTick(() => {
        this.execError = e;
        this.cpHandler = null;
        refresh();
      });
      return;
    }
    const cpHandler = this.cpHandler;

    cpHandler.stdout.on('data', data => {
      this.output += data;
      this.box.setContent(this.out += data);
      this.box.setScrollPerc(100);
      refresh();
    });

    cpHandler.stderr.on('data', data => {
      this.error += data;
      this.box.setContent(this.out += data);
      refresh();
    });

    cpHandler.on('close', code => {
      this.exitCode = code;
      this.box.setContent(this.out += `child process exited with code ${code}`);
      refresh();
    });

    cpHandler.on('error', err => {
      this.execError = err;
      this.box.setContent(this.out += `child process error ${err}`);
      refresh();
    });
  }

  shutdown() {
    if (this.isRunning()) {
      return new Promise((res, rej) => kill(this.cpHandler.pid, null, err => err ? rej(err) : res()));
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
    return this.cpHandler !== null && this.exitCode === null && this.execError === null;
  }

  hasErrors() {
    return this.error !== '';
  }
}

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var index = function (commandList, screenTitle = "foobar") {
  const screen = blessed.screen({ smartCSR: true });
  let coms = [];

  screen.title = screenTitle;

  // Quit on Escape, q, or Control-C.
  screen.key(['q', 'C-c'], function (ch, key) {
    Promise.all(coms.map(com => com.shutdown())).catch(err => {
      console.error(err);
      process.exit(1);
    }).then(() => process.exit(0));
  });

  // Focus our element.
  const width = `${100 / commandList.length | 0}%`;

  coms = commandList.map((command, i) => {
    const com = { command };

    const boxOpt = _extends({}, com.boxOpt || {}, {
      width,
      left: i ? `${i * 100 / commandList.length | 0}%` : '0'
    });

    const c = new Command(com.command, com.opt || {}, boxOpt);
    c.createBox();
    screen.append(c.box);
    return c;
  });

  const viewer = new Viewer(coms);
  viewer.createBox();
  screen.append(viewer.box);

  const delayedRender = lodash.debounce(() => {
    viewer.refresh();
    screen.render();
  }, 100);

  coms.forEach(com => {
    com.run(delayedRender);
  });
};

module.exports = index;
