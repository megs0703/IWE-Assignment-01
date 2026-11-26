import Piece from "../piece.js";
import { FenError } from "../errors.js";

// Constants for toString() (copied from the helper at the end of piece.js).
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

const SYMBOLS = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const PIECE_LETTERS = "pnbrqkPNBRQK";
const START_PLACEMENT = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

const isDigit = (ch) => ch !== undefined && ch >= "0" && ch <= "9";

// The board model (the "M" in MVC): pieces, side to move, castling rights,
// en passant square and the two move counters.
class Board {
  // Map from square name ("e4") to Piece, occupied squares only.
  // Filled in FEN order (a8..h8, a7..h7, ..., h1), so its insertion
  // order is exactly the order `pieces` must return.
  #squares;
  #sideToMove;
  #castlingRights;
  #enPassantSquare;
  #halfmoveClock;
  #fullmoveNumber;

  constructor(squares, sideToMove, castlingRights, enPassantSquare, halfmoveClock, fullmoveNumber) {
    this.#squares = squares;
    this.#sideToMove = sideToMove;
    this.#castlingRights = castlingRights;
    this.#enPassantSquare = enPassantSquare;
    this.#halfmoveClock = halfmoveClock;
    this.#fullmoveNumber = fullmoveNumber;
  }

  // ------------------------------------------------------------------
  // Parsing
  // ------------------------------------------------------------------

  // Reads a FEN string and returns a new Board.
  // Throws a TypeError for a non-string and a FenError for every
  // syntactically invalid FEN, pointing at the first offending character.
  static parse(fen) {
    if (typeof fen !== "string") {
      throw new TypeError(`FEN must be a string, but got ${typeof fen}`);
    }

    // The reader: `i` is the index of the next unread character.
    let i = 0;

    // Throws a FenError at fen[at]. `found` is null if the FEN ended there.
    const fail = (expected, at = i, length = 1) => {
      const found = at < fen.length ? fen.slice(at, at + length) : null;
      throw new FenError(fen, { at, length, expected, found });
    };

    // Reads exactly one space between two fields.
    const readSeparator = (afterField) => {
      if (fen[i] !== " ") fail(`a single space after the ${afterField}`);
      i++;
      if (fen[i] === " ") fail(`the next field, not a second space`);
    };

    // A leading space would otherwise be reported as an "empty rank".
    if (fen[0] === " ") fail("a piece letter or a digit (1-8), not a leading space");

    // --- Step 1: piece placement ------------------------------------
    // 8 ranks from rank 8 down to rank 1, separated by "/".
    // Each rank is piece letters and digits 1-8 describing exactly 8 squares.
    const squares = new Map();

    for (let rank = 8; rank >= 1; rank--) {
      let file = 0; // squares described so far in this rank
      let lastWasDigit = false;

      // Read characters until the rank is ended by "/", " " or the end.
      while (i < fen.length && fen[i] !== "/" && fen[i] !== " ") {
        const ch = fen[i];

        // A rank that is too long: point at the first extra character.
        if (file === 8) {
          fail(rank > 1 ? `"/" after 8 squares in rank ${rank}` : `a space after 8 squares in rank 1`);
        }

        if (PIECE_LETTERS.includes(ch)) {
          // A piece on the current square.
          const square = FILES[file] + rank;
          squares.set(square, new Piece(ch, square));
          file++;
          lastWasDigit = false;
        } else if (ch >= "1" && ch <= "8") {
          // A digit: that many empty squares. Two digits in a row are invalid.
          if (lastWasDigit) fail("a piece letter after a digit (no two digits in a row)");
          if (file + Number(ch) > 8) {
            fail(`a digit of at most ${8 - file} (rank ${rank} has only 8 squares)`);
          }
          file += Number(ch);
          lastWasDigit = true;
        } else {
          fail("a piece letter (pnbrqkPNBRQK) or a digit (1-8)");
        }
        i++;
      }

      // The rank has ended. Empty rank, e.g. "8//8".
      if (file === 0) {
        fail(`a piece letter or a digit (1-8) for rank ${rank} (empty rank)`);
      }
      // A rank that is too short: point at the "/" or space that ends it.
      if (file < 8) {
        fail(`a piece letter or a digit (1-8): rank ${rank} has only ${file} of 8 squares`);
      }

      if (rank > 1) {
        // Ranks 8..2 must be followed by "/".
        if (fen[i] !== "/") fail(`"/" after rank ${rank} (8 ranks are needed)`);
        i++;
      } else if (fen[i] === "/") {
        // A ninth rank.
        fail("a space after rank 1 (only 8 ranks are allowed)");
      }
    }

    // --- Step 2: side to move: "w" or "b" ----------------------------
    readSeparator("piece placement");
    if (fen[i] !== "w" && fen[i] !== "b") fail('"w" or "b" for the side to move');
    const sideToMove = fen[i] === "w" ? "white" : "black";
    i++;

    // --- Step 3: castling rights: "-" or a subset of "KQkq" in order --
    readSeparator("side to move");
    const castlingRights = {
      white: { kingside: false, queenside: false },
      black: { kingside: false, queenside: false },
    };
    if (fen[i] === "-") {
      i++;
    } else {
      const ORDER = "KQkq";
      let next = 0; // index in ORDER of the next letter still allowed
      const start = i;
      while (i < fen.length && fen[i] !== " ") {
        const pos = ORDER.indexOf(fen[i]);
        // Unknown letter, a repeat ("KK") or wrong order ("QK").
        if (pos < next) {
          const allowed = ORDER.slice(next);
          fail(allowed ? `one of "${allowed}" (castling letters in the order KQkq, no repeats)` : "a space after the castling rights");
        }
        next = pos + 1;
        i++;
      }
      if (i === start) fail('"-" or castling letters from "KQkq"');
      const field = fen.slice(start, i);
      castlingRights.white.kingside = field.includes("K");
      castlingRights.white.queenside = field.includes("Q");
      castlingRights.black.kingside = field.includes("k");
      castlingRights.black.queenside = field.includes("q");
    }

    // --- Step 4: en passant: "-" or a file plus rank 6 (w) or 3 (b) ---
    readSeparator("castling rights");
    let enPassantSquare;
    if (fen[i] === "-") {
      enPassantSquare = "-";
      i++;
    } else {
      if (!(fen[i] >= "a" && fen[i] <= "h")) fail('"-" or a file (a-h) for the en passant square');
      const epRank = sideToMove === "white" ? "6" : "3";
      if (fen[i + 1] !== epRank) {
        i++;
        fail(`rank ${epRank} for the en passant square (${sideToMove} to move)`);
      }
      enPassantSquare = fen.slice(i, i + 2);
      i += 2;
    }

    // --- Steps 5 and 6: the move counters -----------------------------
    // Digits only, no sign, no leading zeros.
    const readNumber = (what, min) => {
      const start = i;
      if (!isDigit(fen[i])) fail(`a non-negative integer for the ${what}`);
      if (fen[i] === "0" && isDigit(fen[i + 1])) {
        i++;
        fail(`a space after "0" (no leading zeros in the ${what})`);
      }
      while (isDigit(fen[i])) i++;
      const value = Number(fen.slice(start, i));
      if (value < min) fail(`an integer >= ${min} for the ${what}`, start, i - start);
      return value;
    };

    readSeparator("en passant square");
    const halfmoveClock = readNumber("halfmove clock", 0);

    readSeparator("halfmove clock");
    const fullmoveNumber = readNumber("fullmove number", 1);

    // --- Nothing may follow the last field (no trailing space/field) --
    if (i < fen.length) fail("the end of the FEN after the fullmove number");

    return new Board(squares, sideToMove, castlingRights, enPassantSquare, halfmoveClock, fullmoveNumber);
  }

  // ------------------------------------------------------------------
  // Getters
  // ------------------------------------------------------------------

  get sideToMove() {
    return this.#sideToMove;
  }

  // A copy, so callers can't change the board's state by accident.
  get castlingRights() {
    return {
      white: { ...this.#castlingRights.white },
      black: { ...this.#castlingRights.black },
    };
  }

  get enPassantSquare() {
    return this.#enPassantSquare;
  }

  get halfmoveClock() {
    return this.#halfmoveClock;
  }

  get fullmoveNumber() {
    return this.#fullmoveNumber;
  }

  // The piece on `square`, or null if it is empty.
  pieceAt(square) {
    return this.#squares.get(square) ?? null;
  }

  // All [square, piece] pairs, a8 to h1, rank by rank.
  get pieces() {
    return [...this.#squares];
  }

  // True if the pieces stand as in the start position and White is to move.
  isStartPosition() {
    return this.#placementToFen() === START_PLACEMENT && this.#sideToMove === "white";
  }

  // ------------------------------------------------------------------
  // Output
  // ------------------------------------------------------------------

  // Field 1 of the FEN, rebuilt from #squares.
  #placementToFen() {
    const ranks = [];
    for (let rank = 8; rank >= 1; rank--) {
      let row = "";
      let empty = 0;
      for (const file of FILES) {
        const piece = this.pieceAt(file + rank);
        if (piece) {
          if (empty > 0) row += empty;
          row += piece.letter;
          empty = 0;
        } else {
          empty++;
        }
      }
      if (empty > 0) row += empty;
      ranks.push(row);
    }
    return ranks.join("/");
  }

  // The FEN rebuilt from the board state.
  toFen() {
    const c = this.#castlingRights;
    const castling =
      (c.white.kingside ? "K" : "") +
      (c.white.queenside ? "Q" : "") +
      (c.black.kingside ? "k" : "") +
      (c.black.queenside ? "q" : "") || "-";

    return [
      this.#placementToFen(),
      this.#sideToMove === "white" ? "w" : "b",
      castling,
      this.#enPassantSquare,
      this.#halfmoveClock,
      this.#fullmoveNumber,
    ].join(" ");
  }

  // The board as Unicode text (helper from the end of piece.js).
  toString() {
    const rows = [];
    for (let rank = 8; rank >= 1; rank--) {
      const row = FILES.map(
        (file) => SYMBOLS[this.pieceAt(file + rank)?.letter] ?? "·",
      );
      rows.push(`${rank} ${row.join(" ")}`);
    }
    rows.push("  a b c d e f g h");
    return rows.join("\n");
  }
}

export default Board;