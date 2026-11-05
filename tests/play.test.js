'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const play = require('../routes/play');
describe('play buttons', () => {
  let d; beforeEach(() => { d = fs.mkdtempSync(path.join(os.tmpdir(), 'play-')); fs.mkdirSync(path.join(d, 'play')); });
  const card = (o) => fs.writeFileSync(path.join(d, 'play', o.id + '.json'), JSON.stringify(o));
  test('card shows ready, ▶ queues it once, result shows done', () => {
    card({ id: 'a1', title: 'Go merge', what: 'x', job: 'ping' });
    expect(play.list(d)[0].state).toBe('ready');
    expect(play.run(d, 'a1')).toEqual({ ok: true, state: 'queued' });
    expect(JSON.parse(fs.readFileSync(path.join(d, 'tasks', 'play_a1.json'), 'utf8'))).toEqual({ id: 'play_a1', job: 'ping', args: {} });
    expect(play.list(d)[0].state).toBe('queued'); expect(play.run(d, 'a1').code).toBe(409);
    fs.mkdirSync(path.join(d, 'results')); fs.writeFileSync(path.join(d, 'results', 'play_a1.json'), JSON.stringify({ status: 'done', output: 'ok' }));
    expect(play.list(d)[0]).toMatchObject({ state: 'done', note: 'ok' });
  });
  test('unknown job, bad id and missing card are refused', () => {
    card({ id: 'b1', title: 'Bad', job: 'rm_everything' });
    expect(play.run(d, 'b1').code).toBe(400); expect(play.run(d, '../x').code).toBe(400); expect(play.run(d, 'zz').code).toBe(404);
  });
  test('a repeat card can run again', () => {
    card({ id: 'c1', title: 'Health', job: 'health', repeat: true }); play.run(d, 'c1');
    fs.mkdirSync(path.join(d, 'results')); fs.writeFileSync(path.join(d, 'results', 'play_c1.json'), JSON.stringify({ status: 'done', output: 'health 200' }));
    expect(play.list(d)[0].state).toBe('ready');
  });
});
