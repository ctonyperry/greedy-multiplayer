/**
 * Game logging system for debugging
 * Captures detailed game events for issue reporting
 */

export interface LogEntry {
  timestamp: string;
  type: 'GAME_START' | 'ROLL' | 'KEEP' | 'BANK' | 'BUST' | 'TURN_END' | 'AI_DECISION' | 'PHASE_CHANGE' | 'GAME_END' | 'ERROR' | 'INFO';
  player?: string;
  isAI?: boolean;
  details: Record<string, unknown>;
}

class GameLogger {
  private logs: LogEntry[] = [];
  private sessionId: string;
  private startTime: Date;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startTime = new Date();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  log(entry: Omit<LogEntry, 'timestamp'>): void {
    this.logs.push({
      ...entry,
      timestamp: this.getTimestamp(),
    });
  }

  gameStart(players: { name: string; isAI: boolean; aiStrategy?: string }[]): void {
    this.log({
      type: 'GAME_START',
      details: {
        sessionId: this.sessionId,
        playerCount: players.length,
        players: players.map(p => ({
          name: p.name,
          isAI: p.isAI,
          aiStrategy: p.aiStrategy,
        })),
      },
    });
  }

  roll(
    player: string,
    isAI: boolean,
    diceCount: number,
    result: number[],
    isBust: boolean,
    turnScoreBefore: number
  ): void {
    this.log({
      type: 'ROLL',
      player,
      isAI,
      details: {
        diceCount,
        result: result.join(', '),
        isBust,
        turnScoreBefore,
      },
    });
  }

  keep(
    player: string,
    isAI: boolean,
    keptDice: number[],
    pointsFromKeep: number,
    turnScoreAfter: number,
    diceRemaining: number,
    isHotDice: boolean
  ): void {
    this.log({
      type: 'KEEP',
      player,
      isAI,
      details: {
        keptDice: keptDice.join(', '),
        pointsFromKeep,
        turnScoreAfter,
        diceRemaining,
        isHotDice,
      },
    });
  }

  bank(
    player: string,
    isAI: boolean,
    turnScore: number,
    newTotalScore: number,
    diceRemaining: number,
    createdCarryover: boolean
  ): void {
    this.log({
      type: 'BANK',
      player,
      isAI,
      details: {
        turnScore,
        newTotalScore,
        diceRemaining,
        createdCarryover,
      },
    });
  }

  bust(player: string, isAI: boolean, lastRoll: number[], pointsLost: number): void {
    this.log({
      type: 'BUST',
      player,
      isAI,
      details: {
        lastRoll: lastRoll.join(', '),
        pointsLost,
      },
    });
  }

  turnEnd(
    player: string,
    isAI: boolean,
    finalTurnScore: number,
    totalScore: number,
    wasOnBoard: boolean,
    isNowOnBoard: boolean
  ): void {
    this.log({
      type: 'TURN_END',
      player,
      isAI,
      details: {
        finalTurnScore,
        totalScore,
        wasOnBoard,
        isNowOnBoard,
        gotOnBoard: !wasOnBoard && isNowOnBoard,
      },
    });
  }

  aiDecision(
    player: string,
    strategy: string,
    phase: string,
    decision: string,
    reasoning: Record<string, unknown>
  ): void {
    this.log({
      type: 'AI_DECISION',
      player,
      isAI: true,
      details: {
        strategy,
        phase,
        decision,
        ...reasoning,
      },
    });
  }

  phaseChange(player: string, fromPhase: string, toPhase: string, turnScore: number): void {
    this.log({
      type: 'PHASE_CHANGE',
      player,
      details: {
        fromPhase,
        toPhase,
        turnScore,
      },
    });
  }

  gameEnd(winner: string, finalScores: { name: string; score: number }[]): void {
    this.log({
      type: 'GAME_END',
      details: {
        winner,
        finalScores,
        gameDuration: Date.now() - this.startTime.getTime(),
      },
    });
  }

  error(message: string, context: Record<string, unknown>): void {
    this.log({
      type: 'ERROR',
      details: {
        message,
        ...context,
      },
    });
  }

  info(message: string, context: Record<string, unknown> = {}): void {
    this.log({
      type: 'INFO',
      details: {
        message,
        ...context,
      },
    });
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogCount(): number {
    return this.logs.length;
  }

  exportAsText(): string {
    const header = [
      '='.repeat(60),
      'GREEDY DICE GAME - DEBUG LOG',
      '='.repeat(60),
      `Session ID: ${this.sessionId}`,
      `Start Time: ${this.startTime.toISOString()}`,
      `Export Time: ${new Date().toISOString()}`,
      `Total Events: ${this.logs.length}`,
      `User Agent: ${navigator.userAgent}`,
      `Screen: ${window.screen.width}x${window.screen.height}`,
      '='.repeat(60),
      '',
    ].join('\n');

    const logLines = this.logs.map((entry, index) => {
      const playerInfo = entry.player ? ` [${entry.player}${entry.isAI ? ' (AI)' : ''}]` : '';
      const detailsStr = Object.entries(entry.details)
        .map(([key, value]) => `    ${key}: ${JSON.stringify(value)}`)
        .join('\n');

      return [
        `[${index + 1}] ${entry.timestamp} - ${entry.type}${playerInfo}`,
        detailsStr,
        '',
      ].join('\n');
    });

    return header + logLines.join('\n');
  }

  exportAsJSON(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      startTime: this.startTime.toISOString(),
      exportTime: new Date().toISOString(),
      userAgent: navigator.userAgent,
      screen: `${window.screen.width}x${window.screen.height}`,
      logs: this.logs,
    }, null, 2);
  }

  downloadLog(format: 'text' | 'json' = 'text'): void {
    const content = format === 'json' ? this.exportAsJSON() : this.exportAsText();
    const filename = `greedy-debug-${this.sessionId}.${format === 'json' ? 'json' : 'txt'}`;
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  reset(): void {
    this.logs = [];
    this.sessionId = this.generateSessionId();
    this.startTime = new Date();
  }
}

// Singleton instance
export const gameLogger = new GameLogger();
