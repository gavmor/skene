import { describe, expect, it } from 'vitest';
import { trainingJsonl, trainingRowsOf, type VerifiedRun } from '../src/training';
import { ACTION_QUESTION, DONE_QUESTION, valueQuestionKey } from '../src/system-one-questions';
import type { SystemOneEvidence } from '../src/system-one-brain';
import type { PlanAction } from '../src/action-schema';
import type { TurnOutcome, TurnRecord } from '../src/wire';

const choice = (pick: string) => ({ type: 'choice' as const, choice: pick, probabilities: { [pick]: 0.9 }, confidence: 0.9 });
const select = valueQuestionKey('f0.s1');

/** A System One exchange: pick `move`, choose `b` for the select, goal met with p = `done`. */
const evidence = (move: string, done: number): SystemOneEvidence => ({
  request: {
    model: 'm',
    state: 'goal: g\n\nobservation:\n(page)',
    questions: {
      [ACTION_QUESTION]: { type: 'choice', instructions: 'next?', criteria: { choose_first: 'Set First', click_submit: 'Submit' } },
      [select]: { type: 'choice', instructions: 'value?', criteria: { a: 'Set to a', b: 'Set to b' } },
      [DONE_QUESTION]: { type: 'noul', instructions: 'done?' },
    },
  },
  response: { model: 'm', answers: { [ACTION_QUESTION]: choice(move), [select]: choice('b'), [DONE_QUESTION]: { type: 'noul', noul: done } } },
});

let at = 0;
const turn = (tick: number, actions: PlanAction[], over: Partial<TurnRecord> = {}): TurnRecord => ({
  tick,
  at: ++at,
  documentId: 'd1',
  url: 'https://example.test/',
  opsSinceLastTurn: 0,
  afforded: { state: [], trigger: [] },
  satisfied: '',
  remaining: '',
  actions,
  ms: 1,
  via: 'system-one',
  evidence: evidence('click_submit', 0.1),
  ...over,
});
const moved = (tick: number, yes = true): TurnOutcome => ({ tick, documentId: 'd1', moved: yes });
const run = (turns: TurnRecord[], outcomes: TurnOutcome[]): VerifiedRun => ({ id: 'run', verified: true, turns, outcomes });

describe('trainingRowsOf', () => {
  const batch: PlanAction[] = [
    { kind: 'setState', nodeId: 'f0.s1', value: 'b' },
    { kind: 'clickTrigger', nodeId: 'f0.go' },
  ];

  it('labels every answer of a move that advanced a verified run, and the final done', () => {
    const rows = trainingRowsOf(
      run([turn(1, batch), turn(2, [], { done: true, evidence: evidence('click_submit', 0.95) })], [moved(1)]),
    );
    expect(rows.map((r) => [r.id, r.question.instructions, r.label, r.target])).toEqual([
      ['run-1', 'next?', 'click_submit', 'click_submit'],
      ['run-2', 'value?', 'b', 'b'],
      ['run-3', 'done?', 'no', 0],
      ['run-4', 'done?', 'yes', 1],
    ]);
    expect(rows[0].state).toEqual({ input: 'goal: g\n\nobservation:\n(page)' });
    expect(rows[0].question.criteria).toEqual({ choose_first: 'Set First', click_submit: 'Submit' });
  });

  it('labels nothing for a move that changed nothing, or whose outcome is unknown', () => {
    expect(trainingRowsOf(run([turn(1, batch)], [moved(1, false)]))).toEqual([]);
    expect(trainingRowsOf(run([turn(1, batch)], []))).toEqual([]);
  });

  it('keeps no row from a turn the slow brain decided', () => {
    expect(trainingRowsOf(run([turn(1, batch, { via: 'system-one->ai-sdk (low confidence)', evidence: undefined })], [moved(1)]))).toEqual(
      [],
    );
  });

  it('trusts a done only when it is the run’s last word', () => {
    const early = turn(1, [], { done: true });
    expect(trainingRowsOf(run([early, turn(2, batch)], [moved(2)])).map((r) => r.label)).toEqual(['click_submit', 'b', 'no']);
  });

  it('keeps only the target of a filled free-text value: System One chose the field, not the text', () => {
    const fill: PlanAction[] = [{ kind: 'setState', nodeId: 'f0.t1', value: 'alice@example.com' }];
    const rows = trainingRowsOf(run([turn(1, fill, { evidence: evidence('choose_first', 0.1) })], [moved(1)]));
    expect(rows.map((r) => r.label)).toEqual(['choose_first', 'no']);
  });

  it('ignores evidence that is not a System One exchange', () => {
    expect(trainingRowsOf(run([turn(1, batch, { evidence: { request: 'x' } })], [moved(1)]))).toEqual([]);
  });

  it('writes one JSON object per line', () => {
    const rows = trainingRowsOf(run([turn(1, batch)], [moved(1)]));
    expect(trainingJsonl(rows).split('\n').filter(Boolean).map((l) => JSON.parse(l).id)).toEqual(['run-1', 'run-2', 'run-3']);
  });
});
