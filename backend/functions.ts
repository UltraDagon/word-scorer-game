import { Space, tileValues } from "./interfaces";

// TODO: Change to return a invalid board reason, and then add that to invalid turn reason
/** Returns true if the tiles placed down are properly played (in a straight line and maintain a path to the center tile from other played tiles) */
export function validBoardPlacement(
  board: Array<Space>,
  userTiles: Array<string>,
  boardPosToHeldTileMap: Map<number, number>,
  // Probably abstract wordIntervals to another function so that it can be used by both client and server
  wordIntervals: Set<string>
): boolean {
  const flatBoard: Array<Space> = getFlatBoard(
    board,
    userTiles,
    boardPosToHeldTileMap
  );

  // Middle space cannot be empty
  if (flatBoard[112]?.letter === undefined) {
    return false;
  }

  const mapEntries = [...boardPosToHeldTileMap.entries()];
  // No need to do checks if there are less than 2 tiles played
  if (mapEntries.length < 2) {
    return true;
  }

  // Tiles must be in a straight line
  let firstPos = mapEntries[0]![0];
  let firstColumn = firstPos % 15;
  let firstRow = (firstPos - firstColumn) / 15;

  let secondPos = mapEntries[1]![0];
  let secondColumn = secondPos % 15;
  let secondRow = (secondPos - secondColumn) / 15;

  // If first and second tile aren't sharing a row/column, invalid turn
  if (firstColumn !== secondColumn && firstRow !== secondRow) return false;

  for (let i = 0; i < mapEntries.length; i++) {
    let spacePos = mapEntries[i]![0];

    // Check if any single tiles are not adjacent to any other tiles and ensure tile is not being placed on top of another tile
    if (
      emptyAdjacentTiles(spacePos, flatBoard) ||
      board[spacePos]?.letter !== undefined
    )
      return false;

    if (i > 2) {
      // Tiles must be in the same row or column
      let spaceColumn = spacePos % 15;
      let spaceRow = (spacePos - spaceColumn) / 15;

      // If tile is not in line with the current line established by the first two pieces
      if (
        !(firstColumn == secondColumn && firstColumn == spaceColumn) &&
        !(firstRow == secondRow && firstRow == spaceRow)
      )
        return false;
    }
  }

  // Words must be adjacent to previously played tiles or the center piece.
  for (let intervalString of wordIntervals) {
    let interval: Array<number> = JSON.parse(intervalString);

    if (interval[0] === undefined || interval[1] === undefined) continue;
    // If interval is one tile, don't check it
    if (interval[1] - interval[0] === 0) continue;

    // Change step to vertical or horizontal based on interval given
    let step = (interval[1] - interval[0]) % 15 === 0 ? 15 : 1;
    let pos = interval[0];
    // Valid if at least one tile on the interval is touching another previously played tile or the center tile
    let validInterval = false;
    while (pos <= interval[1]) {
      if (!emptyAdjacentTiles(pos, board) || pos == 112) {
        validInterval = true;
      }
      pos += step;
    }
    if (!validInterval) return false;
  }

  return true;
}

/** Updates "words" and "wordIntervals" based on words played during turn and return the points earned */
export function turnWordsAndPoints(
  boardPosToHeldTileMap: Map<number, number>,
  words: Array<string>,
  wordIntervals: Set<string>,
  board: Array<Space>,
  tiles: Array<string>
) {
  // Flatten board to act as if played tiles are hard set onto the board
  const flatBoard: Array<Space> = getFlatBoard(
    board,
    tiles,
    boardPosToHeldTileMap
  );

  // Find words based on tiles connected to played tiles
  for (let spacePos of boardPosToHeldTileMap.keys()) {
    // Word interval checking for horizontal and vertical
    let vStart: number = spacePos;
    let vEnd: number = spacePos;
    let hStart: number = spacePos;
    let hEnd: number = spacePos;
    // Check if interval start/end goes out of bounds or runs into a blank space
    while (vStart - 15 >= 0 && flatBoard[vStart - 15]!.letter !== undefined)
      vStart -= 15;

    while (vEnd + 15 <= 225 && flatBoard[vEnd + 15]!.letter !== undefined)
      vEnd += 15;

    while (
      (hStart % 15) - 1 >= 0 &&
      flatBoard[hStart - 1]!.letter !== undefined
    )
      hStart -= 1;

    while (hEnd % 15 != 14 && flatBoard[hEnd + 1]!.letter !== undefined)
      hEnd += 1;

    wordIntervals.add(`[${vStart}, ${vEnd}]`);
    wordIntervals.add(`[${hStart}, ${hEnd}]`);
  }

  let points = 0;
  for (let i of wordIntervals) {
    let wordPoints = 0;
    let wordPointMult = 1;

    let interval: Array<number> = JSON.parse(i);
    // Just in case
    if (interval[0] === undefined || interval[1] === undefined) continue;

    // If interval is only one tile, it is not a word
    if (interval[1] - interval[0] === 0) continue;

    // Change step to vertical or horizontal based on interval given
    let step = (interval[1] - interval[0]) % 15 === 0 ? 15 : 1;

    let currentWord = "";
    let pos = interval[0];
    while (pos <= interval[1]) {
      let letterPoints = tileValues.get(flatBoard[pos]!.letter!) || 0;
      let currentLetter = board[pos]!.letter || "";

      // Implement space effects. Do not count space effects if there is a tile on that space
      switch (flatBoard[pos]!.effect + currentLetter) {
        case "double-letter":
          letterPoints *= 2;
          break;
        case "triple-letter":
          letterPoints *= 3;
          break;
        case "double-word":
          wordPointMult *= 2;
          break;
        case "triple-word":
          wordPointMult *= 3;
          break;
        default:
          break;
      }
      currentWord += flatBoard[pos]?.letter;
      pos += step;

      wordPoints += letterPoints;
    }

    words.push(currentWord);
    points += wordPoints * wordPointMult;
  }

  return points;
}

/** Returns the board as if the user's hovered tiles were placed onto the board*/
function getFlatBoard(
  board: Array<Space>,
  userTiles: Array<string>,
  boardPosToHeldTileMap: Map<number, number>
): Array<Space> {
  const flatBoard: Array<Space> = structuredClone(board);
  for (let spacePos of boardPosToHeldTileMap.keys()) {
    flatBoard[spacePos]!.letter =
      userTiles[boardPosToHeldTileMap.get(Number(spacePos)) || 0];
  }

  return flatBoard;
}

/** Find if all tiles adjacent to the given pos are empty */
function emptyAdjacentTiles(pos: number, board: Array<Space>): boolean {
  if (board[pos + 1]?.letter !== undefined && pos % 15 !== 14) return false;
  if (board[pos - 1]?.letter !== undefined && pos % 15 !== 0) return false;
  if (
    board[pos + 15]?.letter !== undefined ||
    board[pos - 15]?.letter !== undefined
  )
    return false;

  return true;
}
