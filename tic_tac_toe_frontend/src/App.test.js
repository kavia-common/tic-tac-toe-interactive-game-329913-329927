import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the Tic Tac Toe title", () => {
  render(<App />);
  expect(screen.getByText(/tic tac toe/i)).toBeInTheDocument();
});
