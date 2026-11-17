// Verified runs -> Jeff training rows, for a System One adapter trained on this
// loop's own questions.
//
// A turn records what System One ANSWERED, not whether that was right. Here an
// answer is labelled correct only when something outside the classifier
// vouches for it:
//   · the run is VERIFIED — a test's post-condition passed, or a person marked
//     it — never the classifier's own `goal_reached`, which would make its
//     mistakes into labels;
//   · the turn is on that run's path and its plan MOVED the page (TurnOutcome).
//     A plan that changed nothing was a dead end even on a run that succeeded.
// Everything else yields no row:
//   · a turn the slow brain decided carries no System One evidence (the gate
//     replaces the decision), so it is left out by construction;
//   · a turn with no outcome (overtaken by a retarget) is unknown, not moved;
//   · a wrong answer is NOT exported as a negative. Jeff declares `subset` per
//     function, so a "not this" row would train a different function than the
//     single-choice `next_action` it came from.
//
// The row shape is Jeff's `TrainingRow` (jeff apps/hub/app/lib/
// adapter-requests.server.ts): `state` holds the classifier's input exactly as
// it was sent, so the adapter trains on what it will see at inference.
import { ACTION_QUESTION, DONE_QUESTION, valueQuestionKey } from './system-one-questions';
import type { SystemOneEvidence } from './system-one-brain';
import { isChoiceAnswer, type SystemOneAnswer, type SystemOneQuestion } from './system-one';
import type { TurnOutcome, TurnRecord } from './wire';

export interface TrainingRow {
  id: string;
  state: Record<string, unknown>;
  question: { type: 'choice' | 'noul'; instructions: string; criteria: Record<string, string> };
  /** a choice: the winning key; a noul: 'yes' or 'no' */
  label: string;
  /** a choice: the winning key again; a noul: 1 for yes, 0 for no */
  target: string | number;
}

/** A run something outside the classifier has vouched for; nothing else is accepted. */
export interface VerifiedRun {
  /** stem of every row id: `${id}-001`, ... */
  id: string;
  verified: true;
  turns: TurnRecord[];
  outcomes: TurnOutcome[];
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Turn records are read back from storage or JSONL, so evidence is checked, not trusted. */
export function isSystemOneEvidence(value: unknown): value is SystemOneEvidence {
  if (!isObject(value) || !isObject(value.request) || !isObject(value.response)) return false;
  return typeof value.request.state === 'string' && isObject(value.request.questions) && isObject(value.response.answers);
}

type Row = Omit<TrainingRow, 'id'>;

function choiceRow(state: string, question: SystemOneQuestion | undefined, answer: SystemOneAnswer | undefined): Row | null {
  if (question?.type !== 'choice' || !isChoiceAnswer(answer) || !(answer.choice in question.criteria)) return null;
  return {
    state: { input: state },
    question: { type: 'choice', instructions: question.instructions, criteria: question.criteria },
    label: answer.choice,
    target: answer.choice,
  };
}

function doneRow(state: string, question: SystemOneQuestion | undefined, met: boolean): Row | null {
  if (question?.type !== 'noul') return null;
  return {
    state: { input: state },
    question: { type: 'noul', instructions: question.instructions, criteria: {} },
    label: met ? 'yes' : 'no',
    target: met ? 1 : 0,
  };
}

/** The rows one vouched-for turn supports. */
function rowsOf(turn: TurnRecord, evidence: SystemOneEvidence, final: boolean, moved: boolean): Row[] {
  const { state, questions } = evidence.request;
  const { answers } = evidence.response;
  // The run's last word, and the run was verified: the goal was met here.
  if (turn.done) return final ? [doneRow(state, questions[DONE_QUESTION], true)].filter((r) => r !== null) : [];
  if (turn.actions.length === 0 || !moved) return [];
  // The move was on the verified path, so the goal was not yet met, and every
  // value the move set was one the run needed.
  const values = turn.actions.flatMap((action) => {
    if (action.kind !== 'setState') return [];
    const key = valueQuestionKey(action.nodeId);
    return [choiceRow(state, questions[key], answers[key])];
  });
  return [choiceRow(state, questions[ACTION_QUESTION], answers[ACTION_QUESTION]), ...values, doneRow(state, questions[DONE_QUESTION], false)].filter(
    (r) => r !== null,
  );
}

/**
 * Every training row a verified run supports, in turn order. A free-text value
 * written by a filler has no value question, so only its `next_action` row is
 * kept: System One chose the target, not the text.
 */
export function trainingRowsOf(run: VerifiedRun): TrainingRow[] {
  const moved = new Set(run.outcomes.filter((o) => o.moved).map((o) => `${o.documentId}#${o.tick}`));
  const turns = run.turns.toSorted((a, b) => a.at - b.at);
  const rows = turns.flatMap((turn, i) =>
    isSystemOneEvidence(turn.evidence)
      ? rowsOf(turn, turn.evidence, i === turns.length - 1, moved.has(`${turn.documentId}#${turn.tick}`))
      : [],
  );
  const width = String(rows.length).length;
  return rows.map((row, i) => ({ id: `${run.id}-${String(i + 1).padStart(width, '0')}`, ...row }));
}

/** One JSON object per line, as Jeff's training data sets are. */
export const trainingJsonl = (rows: TrainingRow[]): string => rows.map((row) => `${JSON.stringify(row)}\n`).join('');
