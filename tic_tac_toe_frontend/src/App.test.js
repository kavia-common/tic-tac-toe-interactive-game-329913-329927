import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

/**
 * Notes:
 * - We use aria-labels/roles that exist in App.js (grid, gridcell, etc).
 * - AI moves are delayed by setTimeout(220ms), so tests use fake timers + act().
 */

function getCells() {
  const board = screen.getByRole("grid", { name: /tic tac toe board/i });
  return within(board).getAllByRole("gridcell");
}

async function clickCell(user, idx) {
  const cells = getCells();
  await user.click(cells[idx]);
}

describe("Tic Tac Toe UI", () => {
  test("renders basic UI chrome (title, mode toggle, scores, board, controls)", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /tic tac toe/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /game mode/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/score tracker/i)).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: /tic tac toe board/i })).toBeInTheDocument();

    // 9 cells
    expect(getCells()).toHaveLength(9);

    expect(screen.getByRole("button", { name: /restart round/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next round/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset scores/i })).toBeInTheDocument();
  });

  test("local mode: clicking alternates players and fills cells", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Initial status
    expect(screen.getByText(/current player:\s*x/i)).toBeInTheDocument();

    await clickCell(user, 0);
    expect(screen.getByLabelText(/cell 1,\s*x/i)).toBeInTheDocument();
    expect(screen.getByText(/current player:\s*o/i)).toBeInTheDocument();

    await clickCell(user, 1);
    expect(screen.getByLabelText(/cell 2,\s*o/i)).toBeInTheDocument();
    expect(screen.getByText(/current player:\s*x/i)).toBeInTheDocument();
  });

  test("local mode: cannot play in an occupied cell (does not change turn)", async () => {
    const user = userEvent.setup();
    render(<App />);

    await clickCell(user, 0);
    expect(screen.getByText(/current player:\s*o/i)).toBeInTheDocument();

    // Clicking same cell should do nothing (button is disabled after it has a mark)
    const cell1 = screen.getByLabelText(/cell 1,\s*x/i);
    expect(cell1).toBeDisabled();
    await user.click(cell1);

    // Still O's turn; cell remains X
    expect(screen.getByText(/current player:\s*o/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cell 1,\s*x/i)).toBeInTheDocument();
  });

  test("local mode: detects a win, highlights winning line, disables next round until game ends, and updates score once", async () => {
    const user = userEvent.setup();
    render(<App />);

    const nextRoundBtn = screen.getByRole("button", { name: /next round/i });
    expect(nextRoundBtn).toBeDisabled(); // while playing

    // X win on top row: X at 0,1,2 with O at 3,4 in between.
    await clickCell(user, 0); // X
    await clickCell(user, 3); // O
    await clickCell(user, 1); // X
    await clickCell(user, 4); // O
    await clickCell(user, 2); // X wins

    expect(screen.getByText(/winner:\s*x/i)).toBeInTheDocument();

    // winning cells have .win class
    const cells = getCells();
    expect(cells[0].className).toMatch(/\bwin\b/);
    expect(cells[1].className).toMatch(/\bwin\b/);
    expect(cells[2].className).toMatch(/\bwin\b/);

    // board cells should be disabled when game is not playing
    for (const cell of cells) {
      expect(cell).toBeDisabled();
    }

    // Next round now enabled
    expect(nextRoundBtn).toBeEnabled();

    // Score increments once for X
    const scoreTracker = screen.getByLabelText(/score tracker/i);
    // There are multiple "X" labels; use the score-pill title to anchor.
    const xPill = within(scoreTracker).getByTitle(/player x score/i);
    expect(within(xPill).getByText("1")).toBeInTheDocument();
  });

  test("restart round clears board but keeps scores", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Create quick win for X (same as previous test)
    await clickCell(user, 0); // X
    await clickCell(user, 3); // O
    await clickCell(user, 1); // X
    await clickCell(user, 4); // O
    await clickCell(user, 2); // X wins

    const scoreTracker = screen.getByLabelText(/score tracker/i);
    const xPill = within(scoreTracker).getByTitle(/player x score/i);
    expect(within(xPill).getByText("1")).toBeInTheDocument();

    // Restart round
    await user.click(screen.getByRole("button", { name: /restart round/i }));

    // Board cleared
    for (let i = 0; i < 9; i++) {
      expect(screen.getByLabelText(new RegExp(`cell ${i + 1}$`, "i"))).toBeInTheDocument();
    }

    // Score remains
    expect(within(xPill).getByText("1")).toBeInTheDocument();
    expect(screen.getByText(/current player:\s*x/i)).toBeInTheDocument();
  });

  test("next round starts a new game and alternates starting player", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Force a win for X
    await clickCell(user, 0); // X
    await clickCell(user, 3); // O
    await clickCell(user, 1); // X
    await clickCell(user, 4); // O
    await clickCell(user, 2); // X wins

    const nextRoundBtn = screen.getByRole("button", { name: /next round/i });
    expect(nextRoundBtn).toBeEnabled();

    await user.click(nextRoundBtn);

    // New round should start with O (alternating starter)
    expect(screen.getByText(/current player:\s*o/i)).toBeInTheDocument();

    // Board is cleared
    for (let i = 0; i < 9; i++) {
      expect(screen.getByLabelText(new RegExp(`cell ${i + 1}$`, "i"))).toBeInTheDocument();
    }
  });

  test("reset scores sets all scores to 0 and starts a fresh round with X", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Create a win to change scores
    await clickCell(user, 0); // X
    await clickCell(user, 3); // O
    await clickCell(user, 1); // X
    await clickCell(user, 4); // O
    await clickCell(user, 2); // X wins

    const scoreTracker = screen.getByLabelText(/score tracker/i);
    const xPill = within(scoreTracker).getByTitle(/player x score/i);
    expect(within(xPill).getByText("1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reset scores/i }));

    // Scores zeroed
    expect(within(xPill).getByText("0")).toBeInTheDocument();
    const oPill = within(scoreTracker).getByTitle(/player o score/i);
    expect(within(oPill).getByText("0")).toBeInTheDocument();
    const drawPill = within(scoreTracker).getByTitle(/draws/i);
    expect(within(drawPill).getByText("0")).toBeInTheDocument();

    // Back to X starter
    expect(screen.getByText(/current player:\s*x/i)).toBeInTheDocument();
  });

  test("AI mode: after X plays, AI (O) responds after delay and user cannot click during AI turn", async () => {
    jest.useFakeTimers();

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<App />);

    await user.click(screen.getByRole("button", { name: /vs ai/i }));
    expect(screen.getByText(/your turn:\s*x\s*\(you are x\)/i)).toBeInTheDocument();

    // X plays corner (0). After this click, App sets currentPlayer to O,
    // and interaction should be blocked until AI moves.
    await clickCell(user, 0);
    expect(screen.getByLabelText(/cell 1,\s*x/i)).toBeInTheDocument();

    // All empty cells should be disabled during AI turn
    for (let i = 1; i < 9; i++) {
      expect(screen.getByLabelText(new RegExp(`cell ${i + 1}$`, "i"))).toBeDisabled();
    }

    // AI should play center (4) after 220ms (rule: take center if available)
    await act(async () => {
      jest.advanceTimersByTime(221);
    });

    expect(screen.getByLabelText(/cell 5,\s*o/i)).toBeInTheDocument();

    // Back to user's turn and interaction re-enabled (at least one empty cell enabled)
    expect(screen.getByText(/your turn:\s*x\s*\(you are x\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cell 2$/i)).toBeEnabled();

    jest.useRealTimers();
  });
});
