// Controller: reads the request, calls the model, returns the serialized result.
// Mounted under /api by src/app.js.
//
// A syntactically invalid FEN makes Board.parse throw a FenError. We don't
// catch it here: app.js's onError turns it into a 400 with serializeFenError.
import { Hono } from "hono";
import Board from "../model/board.js";
import {
  serializeBoard,
  serializeError,
  serializePiece,
  serializePieces,
} from "../server-view/serialize.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const api = new Hono();

// Reads ?fen=… (start position if missing) and parses it.
function boardFrom(c) {
  return Board.parse(c.req.query("fen") ?? START_FEN);
}

// A 400 response with an informative message.
function badRequest(message) {
  return Response.json(serializeError(new Error(message)), { status: 400 });
}

// GET /api/board?fen=…  → the whole board
api.get("/board", (c) => {
  const board = boardFrom(c);
  return Response.json(serializeBoard(board));
});

// GET /api/board/square?fen=…&square=e4  → the piece on that square or null
api.get("/board/square", (c) => {
  const board = boardFrom(c);
  const square = c.req.query("square");

  if (square === undefined) {
    return badRequest('Missing query parameter "square", e.g. square=e4');
  }
  if (!/^[a-h][1-8]$/.test(square)) {
    return badRequest(`Invalid square "${square}": expected a file a-h and a rank 1-8, e.g. "e4"`);
  }
  return Response.json(serializePiece(board.pieceAt(square)));
});

// GET /api/board/pieces?fen=…&color=white  → all pieces, optionally of one color
api.get("/board/pieces", (c) => {
  const board = boardFrom(c);
  const color = c.req.query("color");

  if (color !== undefined && color !== "white" && color !== "black") {
    return badRequest(`Invalid color "${color}": expected "white" or "black"`);
  }
  const pairs = board.pieces.filter(([, piece]) => color === undefined || piece.color === color);
  return Response.json(serializePieces(pairs));
});

export default api;