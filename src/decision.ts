// The decision seam: what a brain is handed and what it must answer. No model,
// transport or browser in here, so every brain (AI SDK, System One, and any
// later one) depends on this and nothing else of each other.
import type { PlanAction } from './action-schema.js';
import type { Scene } from './scene.js';

/**
 * The loop's view of one decision. `actions` is empty only in named cases:
 * `done` (the brain judged the goal met on this Scene), `!decided` (nothing on
 * the page is legal to act on), and System One's `needsValue` hand-over.
 */
export interface Decision {
  /** false when the Scene affords no legal action at all */
  decided: boolean;
  /** the brain judged the goal met on this Scene; `actions` is empty */
  done?: boolean;
  satisfied: string;
  remaining: string;
  actions: PlanAction[];
  /** which brain actually produced this, for the evidence log */
  via?: string;
  /** calibrated confidence, when the deciding brain reports one */
  confidence?: number;
  /**
   * What the deciding brain exchanged with its model, verbatim, when it can be
   * replayed (System One's request and response). Opaque to the loop; it rides
   * into the turn log so a verified run can become training data (training.ts).
   */
  evidence?: unknown;
}

/**
 * The swappable decision seam. Both brains satisfy it, so the loop never learns
 * which one it is holding: the AI SDK one below, and the System-One one in
 * `system-one-brain.ts`.
 */
export interface BrainInput {
  scene: Scene;
  goal: string;
  signal?: AbortSignal;
}

export type Brain = (input: BrainInput) => Promise<Decision>;

/** "The Scene affords nothing" — a real state, reported rather than papered over. */
export const nothingAfforded = (via: string): Decision => ({
  decided: false,
  via,
  satisfied: '',
  remaining: '',
  actions: [],
});
