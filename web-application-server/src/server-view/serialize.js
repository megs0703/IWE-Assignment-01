// Server view: turns model objects into plain objects for Response.json().

// A Piece as a plain object.
export function serializePiece(piece) {
  if (piece === null) return null;
  return {
    letter: piece.letter,
    color: piece.color,
    name: piece.name,
    square: piece.square,
  };
}

// A list of [square, piece] pairs (as from board.pieces) as plain objects.
export function serializePieces(pairs) {
  return pairs.map(([, piece]) => serializePiece(piece));
}

// Task 2.1: the whole board as a plain object.
export function serializeBoard(board) {
  return {
    fen: board.toFen(),
    sideToMove: board.sideToMove,
    castlingRights: board.castlingRights,
    enPassantSquare: board.enPassantSquare,
    halfmoveClock: board.halfmoveClock,
    fullmoveNumber: board.fullmoveNumber,
    startPosition: board.isStartPosition(),
    pieces: serializePieces(board.pieces),
    // The lines of toString() as an array, readable in formatted JSON.
    printed: `${board}`.split("\n"),
  };
}

// Task 2.2: any error as { error: "…" }.
export function serializeError(error) {
  return { error: error.message };
}

// Task 2.2: a FenError with its message and all its fields.
export function serializeFenError(error) {
  return {
    error: error.message,
    fen: error.fen,
    at: error.at,
    length: error.length,
    expected: error.expected,
    found: error.found,
  };
}