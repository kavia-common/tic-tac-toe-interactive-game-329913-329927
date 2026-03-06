import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  applyMove,
  createEmptyBoard,
  getBestAIMove,
  getGameState,
  getNextPlayer,
} from "./game/ticTacToe";

/**
 * UI decisions:
 * - Keep this component as orchestrator; game rules are in /src/game/ticTacToe.js
 * - Store scores in state (session-only) and provide a separate "Reset scores" button.
 * - Support 2-player local + optional vs AI (AI plays as O).
 */

function getStatusText({ gameState, currentPlayer, mode }) {
  if (gameState.status === "won") return `Winner: ${gameState.winner}`;
  if (gameState.status === "draw") return "It's a draw";
  if (mode === "ai") return `Your turn: ${currentPlayer} (You are X)`;
  return `Current player: ${currentPlayer}`;
}

function isMoveAllowed({ mode, currentPlayer }) {
  // In AI mode user always plays X, so block clicks during O's turn
  if (mode === "ai" && currentPlayer === "O") return false;
  return true;
}

const SOUND_STORAGE_KEY = "ttt:soundEnabled";

/**
 * Create a minimal sound engine using WebAudio.
 * This avoids shipping audio assets and keeps it lightweight.
 */
function createSoundEngine() {
  // WebAudio isn't available in all environments (e.g. some test runners).
  const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextImpl) {
    return {
      playMove: () => {},
      playWin: () => {},
      playDraw: () => {},
      destroy: () => {},
    };
  }

  const ctx = new AudioContextImpl();

  const playTone = ({ frequency, durationMs, type = "sine", gain = 0.05 }) => {
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency;

      // Gentle envelope to avoid clicks
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

      osc.connect(g);
      g.connect(ctx.destination);

      osc.start();
      osc.stop(now + durationMs / 1000 + 0.02);
    } catch {
      // no-op: audio failures should never break the game
    }
  };

  return {
    playMove: () => playTone({ frequency: 520, durationMs: 55, type: "triangle", gain: 0.035 }),
    playWin: () => {
      // quick ascending triad
      playTone({ frequency: 523.25, durationMs: 90, type: "sine", gain: 0.045 }); // C5
      setTimeout(() => playTone({ frequency: 659.25, durationMs: 90, type: "sine", gain: 0.045 }), 95); // E5
      setTimeout(() => playTone({ frequency: 783.99, durationMs: 110, type: "sine", gain: 0.05 }), 190); // G5
    },
    playDraw: () => {
      // small descending two-tone
      playTone({ frequency: 440, durationMs: 90, type: "sine", gain: 0.04 });
      setTimeout(() => playTone({ frequency: 330, durationMs: 110, type: "sine", gain: 0.04 }), 95);
    },
    destroy: () => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    },
  };
}

// PUBLIC_INTERFACE
function App() {
  /** Main application component for the Tic Tac Toe game UI. */
  const [board, setBoard] = useState(() => createEmptyBoard());
  const [startingPlayer, setStartingPlayer] = useState("X");
  const [currentPlayer, setCurrentPlayer] = useState("X");

  const [mode, setMode] = useState("local"); // 'local' | 'ai'
  const [scores, setScores] = useState(() => ({ X: 0, O: 0, draws: 0 }));

  // Optional sounds: persisted across reloads.
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem(SOUND_STORAGE_KEY);
      if (raw === null) return false;
      return raw === "true";
    } catch {
      return false;
    }
  });

  const gameState = useMemo(() => getGameState(board), [board]);
  const canInteract = useMemo(
    () => gameState.status === "playing" && isMoveAllowed({ mode, currentPlayer }),
    [gameState.status, mode, currentPlayer]
  );

  const statusText = useMemo(
    () => getStatusText({ gameState, currentPlayer, mode }),
    [gameState, currentPlayer, mode]
  );

  // Sound engine lives in a ref to avoid recreating audio contexts unnecessarily.
  const soundRef = useRef(null);
  const prevStatusRef = useRef(gameState.status);

  // Create/destroy sound engine based on toggle.
  useEffect(() => {
    if (!soundEnabled) {
      if (soundRef.current) {
        soundRef.current.destroy?.();
      }
      soundRef.current = null;
      return;
    }

    // enable
    soundRef.current = createSoundEngine();
    return () => {
      soundRef.current?.destroy?.();
      soundRef.current = null;
    };
  }, [soundEnabled]);

  // Persist sound preference.
  useEffect(() => {
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, String(soundEnabled));
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  // When game ends, update score exactly once per round.
  useEffect(() => {
    if (gameState.status === "won") {
      setScores((s) => ({ ...s, [gameState.winner]: s[gameState.winner] + 1 }));
    } else if (gameState.status === "draw") {
      setScores((s) => ({ ...s, draws: s.draws + 1 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.status]); // intentionally only status: winner/draw computed from same board

  // Sound effects based on game state transitions.
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = gameState.status;

    // Only play end-of-round sounds on transition from playing -> won/draw.
    if (prevStatus === "playing" && gameState.status === "won") {
      soundRef.current?.playWin?.();
    } else if (prevStatus === "playing" && gameState.status === "draw") {
      soundRef.current?.playDraw?.();
    }
  }, [gameState.status]);

  // AI turn effect: if AI mode and it's O's turn and game is still playing, make AI move.
  useEffect(() => {
    if (mode !== "ai") return;
    if (gameState.status !== "playing") return;
    if (currentPlayer !== "O") return;

    // Small delay for better UX.
    const t = setTimeout(() => {
      setBoard((prev) => {
        const move = getBestAIMove(prev, "O");
        if (move === null) return prev;

        // AI move sound is triggered here (human move sound is on click).
        soundRef.current?.playMove?.();

        return applyMove(prev, move, "O");
      });
      setCurrentPlayer("X");
    }, 220);

    return () => clearTimeout(t);
  }, [mode, currentPlayer, gameState.status]);

  const handleCellClick = (index) => {
    if (!canInteract) return;

    // If move is legal, play move sound immediately on user action.
    if (board[index] === null) {
      soundRef.current?.playMove?.();
    }

    setBoard((prev) => {
      const next = applyMove(prev, index, currentPlayer);
      // If move was illegal, keep state as-is.
      if (next === prev) return prev;
      return next;
    });

    // Only advance player if the clicked cell was empty.
    if (board[index] === null) {
      setCurrentPlayer((p) => getNextPlayer(p));
    }
  };

  const startNewRound = (nextStarter) => {
    setBoard(createEmptyBoard());
    setStartingPlayer(nextStarter);
    setCurrentPlayer(nextStarter);
    prevStatusRef.current = "playing";
  };

  const handleRestartRound = () => startNewRound(startingPlayer);

  const handleNextRound = () => {
    const nextStarter = getNextPlayer(startingPlayer);
    startNewRound(nextStarter);
  };

  const handleResetEverything = () => {
    setScores({ X: 0, O: 0, draws: 0 });
    startNewRound("X");
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    // Reset round when switching modes to avoid odd mid-game transitions.
    // Keep scores to let players compare across modes.
    startNewRound("X");
  };

  return (
    <div className="App">
      <main className="ttt-page" aria-label="Tic Tac Toe game">
        <section className="ttt-card">
          <header className="ttt-header">
            <div>
              <h1 className="ttt-title">Tic Tac Toe</h1>
              <p className="ttt-subtitle">Local play or vs a simple AI</p>

              <div className="ttt-options" aria-label="Options">
                <label className="sound-toggle" title="Toggle sound effects">
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                    aria-label="Sound effects"
                  />
                  <span className="sound-toggle-label">Sound</span>
                </label>
              </div>
            </div>

            <div className="ttt-mode" role="group" aria-label="Game mode">
              <button
                type="button"
                className={`seg-btn ${mode === "local" ? "active" : ""}`}
                onClick={() => handleModeChange("local")}
              >
                2 Players
              </button>
              <button
                type="button"
                className={`seg-btn ${mode === "ai" ? "active" : ""}`}
                onClick={() => handleModeChange("ai")}
              >
                Vs AI
              </button>
            </div>
          </header>

          <section className="ttt-topRow">
            <div className="ttt-scores" aria-label="Score tracker">
              <div className="score-pill" title="Player X score">
                <span className="score-label">X</span>
                <span className="score-value">{scores.X}</span>
              </div>
              <div className="score-pill" title="Draws">
                <span className="score-label">Draw</span>
                <span className="score-value">{scores.draws}</span>
              </div>
              <div className="score-pill" title="Player O score">
                <span className="score-label">O</span>
                <span className="score-value">{scores.O}</span>
              </div>
            </div>

            <div className="ttt-status" aria-live="polite">
              <span
                // key forces remount so CSS animation reliably plays when text/class changes
                key={`${gameState.status}:${gameState.winner ?? ""}:${mode}:${currentPlayer}`}
                className={`status-badge ${
                  gameState.status === "won"
                    ? "won"
                    : gameState.status === "draw"
                      ? "draw"
                      : "playing"
                }`}
              >
                {statusText}
              </span>
            </div>
          </section>

          <section className="ttt-boardWrap" aria-label="Game board">
            <div
              className={`ttt-board ${!canInteract ? "locked" : ""}`}
              role="grid"
              aria-label="Tic Tac Toe board"
            >
              {board.map((cell, idx) => {
                const isWinningCell = Boolean(gameState.winningLine?.includes(idx));
                const isDisabled =
                  gameState.status !== "playing" ||
                  cell !== null ||
                  (mode === "ai" && currentPlayer === "O");

                return (
                  <button
                    key={idx}
                    type="button"
                    className={[
                      "ttt-cell",
                      cell ? `p-${cell}` : "",
                      isWinningCell ? "win" : "",
                    ].join(" ")}
                    onClick={() => handleCellClick(idx)}
                    disabled={isDisabled}
                    role="gridcell"
                    aria-label={`Cell ${idx + 1}${cell ? `, ${cell}` : ""}`}
                  >
                    {/* key ensures mark span remounts when value changes, so pop animation runs */}
                    <span key={cell ?? "empty"} className="ttt-mark" aria-hidden="true">
                      {cell ?? ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <footer className="ttt-controls" aria-label="Controls">
            <button type="button" className="btn" onClick={handleRestartRound}>
              Restart round
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleNextRound}
              disabled={gameState.status === "playing"}
              title={gameState.status === "playing" ? "Finish this round first" : "Start next round"}
            >
              Next round
            </button>

            <button type="button" className="btn btn-ghost" onClick={handleResetEverything}>
              Reset scores
            </button>
          </footer>

          <section className="ttt-help" aria-label="Help">
            <p className="ttt-helpText">
              {mode === "ai" ? (
                <>
                  You are <strong>X</strong>. The AI is <strong>O</strong>.
                </>
              ) : (
                <>
                  Take turns placing <strong>X</strong> and <strong>O</strong>.
                </>
              )}{" "}
              First to align three wins.
            </p>
          </section>
        </section>
      </main>
    </div>
  );
}

export default App;
