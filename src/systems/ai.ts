import type { AiParams } from '../data/types';

export type AiState = 'idle' | 'patrol' | 'chase' | 'attack' | 'hurt' | 'return' | 'dead';

export interface AiInput {
  state: AiState;
  now: number;
  stateSince: number;
  distToPlayer: number;
  distFromHome: number;
  hurtUntil: number;
  /** An attack sequence (windup/strike/recovery) is still running. */
  attackBusy: boolean;
  attackReadyAt: number;
  /** Recently provoked (e.g. hit from afar): widens the aggro radius. */
  provoked: boolean;
  dead: boolean;
}

const IDLE_MS = 1400;
const PATROL_MS = 2200;
const HOME_EPSILON = 8;

/**
 * Pure state transition for the shared enemy FSM
 * (idle → patrol → chase → attack → hurt → dead, plus "return" when leashed).
 * Entities execute the behavior of the returned state.
 */
export function decideAiState(i: AiInput, p: AiParams): AiState {
  if (i.dead) return 'dead';
  if (i.now < i.hurtUntil) return 'hurt';
  if (i.attackBusy) return 'attack';

  const aggroRange = i.provoked ? p.aggroRange * 1.8 : p.aggroRange;
  const engaged = i.distToPlayer <= aggroRange;

  if (i.state === 'return') {
    if (i.distFromHome <= HOME_EPSILON) return 'idle';
    return i.distToPlayer <= p.aggroRange * 0.6 ? 'chase' : 'return';
  }
  if (i.distFromHome > p.leashRange) return 'return';

  if (engaged) {
    if (i.distToPlayer <= p.attackRange && i.now >= i.attackReadyAt) return 'attack';
    return 'chase';
  }

  const elapsed = i.now - i.stateSince;
  if (i.state === 'idle') return elapsed > IDLE_MS && p.patrolRadius > 0 ? 'patrol' : 'idle';
  if (i.state === 'patrol') return elapsed > PATROL_MS ? 'idle' : 'patrol';
  return 'idle';
}
