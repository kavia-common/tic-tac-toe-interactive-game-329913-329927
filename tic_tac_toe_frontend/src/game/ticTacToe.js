/**
 * Small reusable rules/logic module for Tic Tac Toe.
 * Keep UI separate from the game logic so it can be reused and unit-tested.
 */

/** @typedef {'X'|'O'} Player */
/** @typedef {Player|null} Cell */
/** @typedef {Cell[]} Board */

export const BOARD_SIZE = 9;

/** All possible winning lines, as indices into the 1D 3x3 board. */
export const WIN_LINES = Object.freeze([
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],

  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],

  [0, 4, 8],
  [2, 4, 6],
]);

// PUBLIC_INTERFACE
export function createEmptyBoard() {
  /** Create a new empty board. */
  return Array.from({ length: BOARD_SIZE }, () => null);
}

// PUBLIC_INTERFACE
export function getNextPlayer(currentPlayer) {
  /** Return the next player given the current player. */
  return currentPlayer === "X" ? "O" : "X";
}

// PUBLIC_INTERFACE
export function isBoardFull(board) {
  /** Return true if there are no empty cells left. */
  return board.every((c) => c !== null);
}

// PUBLIC_INTERFACE
export function getWinner(board) {
  /**
   * Determine winner information for the current board.
   * @returns {{ winner: Player|null, line: number[]|null }}
   */
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c]) {
      return { winner: v, line };
    }
  }
  return { winner: null, line: null };
}

// PUBLIC_INTERFACE
export function getGameState(board) {
  /**
   * Get the current game state.
   * @returns {{ status: 'playing'|'won'|'draw', winner: Player|null, winningLine: number[]|null }}
   */
  const { winner, line } = getWinner(board);
  if (winner) return { status: "won", winner, winningLine: line };
  if (isBoardFull(board)) return { status: "draw", winner: null, winningLine: null };
  return { status: "playing", winner: null, winningLine: null };
}

// PUBLIC_INTERFACE
export function applyMove(board, index, player) {
  /**
   * Apply a move to a board immutably. If the move is illegal, returns the original board.
   * @param {Board} board
   * @param {number} index
   * @param {Player} player
   * @returns {Board}
   */
  if (index < 0 || index >= BOARD_SIZE) return board;
  if (board[index] !== null) return board;
  const next = board.slice();
  next[index] = player;
  return next;
}

/**
 * AI is intentionally simple, "hard enough" for casual play:
 * 1) win if possible
 * 2) block opponent win
 * 3) take center
 * 4) take a corner
 * 5) take any side
 */

function findWinningMove(board, player) {
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== null) continue;
    const candidate = applyMove(board, i, player);
    const { winner } = getWinner(candidate);
    if (winner === player) return i;
  }
  return null;
}

function getAvailableMoves(board) {
  const moves = [];
  for (let i = 0; i < board.length; i++) if (board[i] === null) moves.push(i);
  return moves;
}

// PUBLIC_INTERFACE
export function getBestAIMove(board, aiPlayer) {
  /**
   * Pick a move index for AI player; returns null if no moves.
   * @param {Board} board
   * @param {Player} aiPlayer
   * @returns {number|null}
   */
  const opponent = getNextPlayer(aiPlayer);
  const available = getAvailableMoves(board);
  if (available.length === 0) return null;

  // 1) win now
  const win = findWinningMove(board, aiPlayer);
  if (win !== null) return win;

  // 2) block opponent
  const block = findWinningMove(board, opponent);
  if (block !== null) return block;

  // 3) center
  if (board[4] === null) return 4;

  // 4) corners
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (corners.length > 0) return corners[0];

  // 5) sides
  const sides = [1, 3, 5, 7].filter((i) => board[i] === null);
  if (sides.length > 0) return sides[0];

  // fallback
  return available[0] ?? null;
}
