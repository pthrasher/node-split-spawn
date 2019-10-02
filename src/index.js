import { debounce } from 'lodash';
import blessed from 'blessed';
import Viewer from './lib/viewer';
import Command from './lib/command';

export default function (commandList, screenTitle = 'foobar') {
  const screen = blessed.screen({ smartCSR: true });
  let coms = [];

  screen.title = screenTitle;

  // Quit on Escape, q, or Control-C.
  screen.key(['q', 'C-c'], (/* ch, key */) => {
    Promise.all(coms.map((com) => com.shutdown()))
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
      })
      .then(() => process.exit(0));
  });

  // Focus our element.
  const width = `${100 / commandList.length || 0}%`;

  coms = commandList.map((command, i) => {
    const com = { command };

    const boxOpt = {
      ...(com.boxOpt || {}),
      width,
      left: i ? `${(i * 100) / commandList.length || 0}%` : '0',
    };

    const c = new Command(com.command, com.opt || {}, boxOpt);
    c.createBox();
    screen.append(c.box);
    return c;
  });

  const viewer = new Viewer(coms);
  viewer.createBox();
  screen.append(viewer.box);

  const delayedRender = debounce(() => {
    viewer.refresh();
    screen.render();
  }, 100);

  coms.forEach((com) => {
    com.run(delayedRender);
  });
}
