// Run with:  bun src/model/test.js   or   node src/model/test.js
// No test framework needed.
import Board from "./board.js";
import { FenError } from "../errors.js";

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    passed++;
    console.log(`PASS: ${name}`);
  } else {
    failed++;
    console.log(`FAIL: ${name}`);
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Board.parse(fen) must throw an error of type ErrorType.
// The message is printed so you can see where it points.
function checkThrows(name, fen, ErrorType = FenError, expectedAt) {
  try {
    Board.parse(fen);
    failed++;
    console.log(`FAIL: ${name} (no error was thrown)`);
  } catch (e) {
    const atOk = expectedAt === undefined || e.at === expectedAt;
    if (e instanceof ErrorType && atOk) {
      passed++;
      console.log(`PASS: ${name}`);
    } else {
      failed++;
      console.log(`FAIL: ${name} (got ${e.name} at ${e.at}, expected ${ErrorType.name} at ${expectedAt})`);
    }
    console.log(`      ${e.message}`);
    if (typeof fen === "string" && e.at !== undefined) {
      console.log(`      ${fen}`);
      console.log(`      ${" ".repeat(e.at)}^`);
    }
  }
}

// ----------------------------------------------------------------------
console.log("\n== Example FEN ==");
const example = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
const board = Board.parse(example);

check("sideToMove is black", board.sideToMove === "black");
check(
  "castlingRights all true",
  same(board.castlingRights, {
    white: { kingside: true, queenside: true },
    black: { kingside: true, queenside: true },
  }),
);
check("enPassantSquare is e3", board.enPassantSquare === "e3");
check("halfmoveClock is the number 0", board.halfmoveClock === 0);
check("fullmoveNumber is the number 1", board.fullmoveNumber === 1);

const e4 = board.pieceAt("e4");
check("pieceAt(e4) is a white pawn", e4 !== null && e4.color === "white" && e4.name === "pawn");
check("pieceAt(e5) is null", board.pieceAt("e5") === null);

const pieces = board.pieces;
check("pieces has 32 entries", pieces.length === 32);
check("pieces starts at a8 (black rook)", pieces[0][0] === "a8" && pieces[0][1].letter === "r");
check("pieces ends at h1 (white rook)", pieces.at(-1)[0] === "h1" && pieces.at(-1)[1].letter === "R");
check(
  "pieces are in order a8..h1, rank by rank",
  same(
    pieces.map(([sq]) => sq),
    [
      "a8", "b8", "c8", "d8", "e8", "f8", "g8", "h8",
      "a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7",
      "e4",
      "a2", "b2", "c2", "d2", "f2", "g2", "h2",
      "a1", "b1", "c1", "d1", "e1", "f1", "g1", "h1",
    ],
  ),
);
check("isStartPosition() is false", board.isStartPosition() === false);
check("toFen() returns the same FEN", board.toFen() === example);

const text = `${board}`;
check("toString() has 9 lines", text.split("\n").length === 9);
console.log(text);

// ----------------------------------------------------------------------
console.log("\n== Round trips ==");
for (const fen of [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "8/8/8/8/8/8/8/8 w - - 0 1",
  "r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R w Kq - 3 9",
  "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 42",
]) {
  check(`round trip: ${fen}`, Board.parse(fen).toFen() === fen);
}

// ----------------------------------------------------------------------
console.log("\n== isStartPosition ==");
check(
  "start FEN with w is the start position",
  Board.parse("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").isStartPosition() === true,
);
check(
  "start FEN with b is not",
  Board.parse("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1").isStartPosition() === false,
);
check(
  "castling '-' rebuilds as '-'",
  Board.parse("4k3/8/8/8/8/8/8/4K3 w - - 0 1").toFen() === "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
);

// ----------------------------------------------------------------------
console.log("\n== Invalid FENs ==");
const S = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"; // start placement

// 1. Placement
checkThrows("only 7 ranks", "8/8/8/8/8/8/8 w - - 0 1", FenError, 13);
checkThrows("9 ranks", "8/8/8/8/8/8/8/8/8 w - - 0 1", FenError, 15);
checkThrows("rank too short (points at /)", "rnbqkbn/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", FenError, 7);
checkThrows("last rank too short (points at space)", "8/8/8/8/8/8/8/7 w - - 0 1", FenError, 15);
checkThrows("rank too long (first extra char)", "rnbqkbnrr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", FenError, 8);
checkThrows("digit makes rank too long", "7p1/8/8/8/8/8/8/8 w - - 0 1", FenError, 2);
checkThrows("invalid letter x", "rnbqkbnx/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", FenError, 7);
checkThrows("digit 9", "9/8/8/8/8/8/8/8 w - - 0 1", FenError, 0);
checkThrows("digit 0", "0p7/8/8/8/8/8/8/8 w - - 0 1", FenError, 0);
checkThrows("two digits in a row (44)", "44/8/8/8/8/8/8/8 w - - 0 1", FenError, 1);
checkThrows("empty rank (8//8)", "8//8/8/8/8/8/8 w - - 0 1", FenError, 2);

// 2. Field separators
checkThrows("missing field", `${S} w KQkq - 0`, FenError);
checkThrows("only placement", S, FenError, S.length);
checkThrows("extra field", `${S} w KQkq - 0 1 x`, FenError);
checkThrows("double space", `${S}  w KQkq - 0 1`, FenError, S.length + 1);
checkThrows("leading space", ` ${S} w KQkq - 0 1`, FenError, 0);
checkThrows("trailing space", `${S} w KQkq - 0 1 `, FenError);
checkThrows("empty string", "", FenError, 0);

// 3. Side to move
checkThrows("side to move x", `${S} x KQkq - 0 1`, FenError, S.length + 1);
checkThrows("side to move W", `${S} W KQkq - 0 1`, FenError, S.length + 1);
checkThrows("side to move wb", `${S} wb KQkq - 0 1`, FenError, S.length + 2);

// 4. Castling
checkThrows("castling QK (wrong order)", `${S} w QK - 0 1`, FenError, S.length + 4);
checkThrows("castling KK (repeat)", `${S} w KK - 0 1`, FenError, S.length + 4);
checkThrows("castling X", `${S} w X - 0 1`, FenError, S.length + 3);
checkThrows("castling -K", `${S} w -K - 0 1`, FenError, S.length + 4);

// 5. En passant
checkThrows("en passant e3 with white to move", `${S} w KQkq e3 0 1`, FenError, S.length + 9);
checkThrows("en passant e6 with black to move", `${S} b KQkq e6 0 1`, FenError, S.length + 9);
checkThrows("en passant file i", `${S} w KQkq i6 0 1`, FenError, S.length + 8);
checkThrows("en passant e66 (something after)", `${S} w KQkq e66 0 1`, FenError, S.length + 10);
checkThrows("en passant -x", `${S} w KQkq -x 0 1`, FenError, S.length + 9);

// 6. Move counters
checkThrows("halfmove -1", `${S} w KQkq - -1 1`, FenError, S.length + 10);
checkThrows("halfmove +1", `${S} w KQkq - +1 1`, FenError, S.length + 10);
checkThrows("halfmove 01 (leading zero)", `${S} w KQkq - 01 1`, FenError, S.length + 11);
checkThrows("halfmove 1.5", `${S} w KQkq - 1.5 1`, FenError, S.length + 11);
checkThrows("fullmove 0", `${S} w KQkq - 0 0`, FenError, S.length + 12);
checkThrows("fullmove 01", `${S} w KQkq - 0 01`, FenError, S.length + 13);
checkThrows("fullmove abc", `${S} w KQkq - 0 abc`, FenError, S.length + 12);

// 7. Non-string argument
checkThrows("number instead of string", 42, TypeError);
checkThrows("undefined", undefined, TypeError);
checkThrows("null", null, TypeError);

// ----------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
console.log(failed === 0 ? "ALL PASSED" : `${failed} FAILED`);