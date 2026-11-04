'use strict';
const { startWaiting, MAX_TEXTS } = require('../layla_owner/waitNudge');

describe('waitNudge', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const make = () => ({ typing: jest.fn().mockResolvedValue(), send: jest.fn().mockResolvedValue(), clearTyping: jest.fn().mockResolvedValue() });

  test('typing sign shows instantly, no text for a fast reply', () => {
    const io = make(); const w = startWaiting(io);
    expect(io.typing).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(5000); w.stop();
    expect(io.send).not.toHaveBeenCalled();
    expect(io.clearTyping).toHaveBeenCalledTimes(1);
  });

  test('texts arrive at 8s, 30s, 60s and never more than 3', () => {
    const io = make(); const w = startWaiting(io);
    jest.advanceTimersByTime(8000); expect(io.send).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(22000); expect(io.send).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(30000); expect(io.send).toHaveBeenCalledTimes(3);
    jest.advanceTimersByTime(600000); expect(io.send).toHaveBeenCalledTimes(MAX_TEXTS);
    w.stop();
  });

  test('nothing is sent after stop()', () => {
    const io = make(); const w = startWaiting(io);
    jest.advanceTimersByTime(9000); w.stop();
    jest.advanceTimersByTime(120000);
    expect(io.send).toHaveBeenCalledTimes(1);
    expect(w.isStopped()).toBe(true);
  });

  test('typing sign is refreshed while waiting', () => {
    const io = make(); const w = startWaiting({ ...io, typingEveryMs: 10000 });
    jest.advanceTimersByTime(30000);
    expect(io.typing.mock.calls.length).toBeGreaterThanOrEqual(4);
    w.stop();
  });

  test('a failing send or typing never throws', async () => {
    const io = { typing: jest.fn().mockRejectedValue(new Error('x')), send: jest.fn().mockRejectedValue(new Error('y')) };
    const w = startWaiting(io);
    jest.advanceTimersByTime(70000);
    await Promise.resolve();
    expect(() => w.stop()).not.toThrow();
  });

  test('works with no functions given', () => {
    const w = startWaiting({}); jest.advanceTimersByTime(70000);
    expect(() => w.stop()).not.toThrow();
  });
});
