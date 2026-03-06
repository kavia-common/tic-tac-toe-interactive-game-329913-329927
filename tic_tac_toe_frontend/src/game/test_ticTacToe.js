import {
  applyMove,
  createEmptyBoard,
  getBestAIMove,
  getGameState,
  getNextPlayer,
  getWinner,
  isBoardFull,
} from "./ticTacToe";

describe("ticTacToe rules module", () => {
  test("createEmptyBoard returns a 9-cell board filled with nulls", () => {
    const b = createEmptyBoard();
    expect(b).toHaveLength(9);
    expect(b.every((c) => c === null)).toBe(true);
  });

  test("getNextPlayer toggles between X and O", () => {
    expect(getNextPlayer("X")).toBe("O");
    expect(getNextPlayer("O")).toBe("X");
  });

  test("applyMove is immutable and rejects illegal moves", () => {
    const b = createEmptyBoard();
    const b2 = applyMove(b, 0, "X");
    expect(b2).not.toBe(b);
    expect(b[0]).toBeNull();
    expect(b2[0]).toBe("X");

    // occupied cell -> returns same reference
    const b3 = applyMove(b2, 0, "O");
    expect(b3).toBe(b2);

    // out of range -> returns same reference
    expect(applyMove(b2, -1, "O")).toBe(b2);
    expect(applyMove(b2, 9, "O")).toBe(b2);
  });

  test("getWinner detects winner and winning line", () => {
    const b = ["X", "X", "X", null, null, null, null, null, null];
    const w = getWinner(b);
    expect(w.winner).toBe("X");
    expect(w.line).toEqual([0, 1, 2]);
  });

  test("getGameState returns draw when board is full with no winner", () => {
    // Classic draw board
    const b = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
    expect(isBoardFull(b)).toBe(true);
    expect(getGameState(b)).toEqual({
      status: "draw",
      winner: null,
      winningLine: null,
    });
  });

  test("getBestAIMove: returns null when no moves available", () => {
    const b = ["X", "O", "X", "X", "O", "O", "O", "X", "X"];
    expect(getBestAIMove(b, "O")).toBeNull();
  });

  test("getBestAIMove: wins when a winning move is available", () => {
    // O can win by playing index 2
    const b = ["O", "O", null, "X", "X", null, null, null, null];
    expect(getBestAIMove(b, "O")).toBe(2);
  });

  test("getBestAIMove: blocks opponent immediate win", () => {
    // X threatens to win at index 2; O must block at 2
    const b = ["X", "X", null, null, "O", null, null, null, null];
    expect(getBestAIMove(b, "O")).toBe(2);
  });

  test("getBestAIMove: takes center if no win/block exists", () => {
    const b = ["X", null, null, null, null, null, null, null, null];
    expect(getBestAIMove(b, "O")).toBe(4);
  });

  test("getBestAIMove: takes a corner when center is occupied and no win/block exists", () => {
    const b = [null, null, null, null, "X", null, null, null, null];
    expect(getBestAIMove(b, "O")).toBe(0);
  });

  test("getBestAIMove: takes a side when center and corners are occupied", () => {
    const b = ["X", null, "O", null, "X", null, "O", null, "X"];
    // available sides are [1,3,5,7], algorithm returns first available side => 1
    expect(getBestAIMove(b, "O")).toBe(1);
  });
});
