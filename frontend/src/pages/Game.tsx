import useWebSocket from "react-use-websocket";
import { useState, useEffect, useRef } from "react";
import throttle from "lodash.throttle";

import { UserList } from "../components/UserList";
import "./Game.css";

import {
  User,
  GameData,
  GameProps,
  Space,
  WSMessage,
  tileValues,
} from "../../../backend/interfaces";

import { WORD_LIST } from "../../../backend/dictionary";

// TODO: Consider allowing placement anywhere but not allowing for the turn to be played
function validBoardPlacement(
  boardPos: number,
  board: Array<Space>,
  boardPosToHeldTileMap: Map<number, number>
): boolean {
  // Tile is invalid if there is already a tile in that position
  if (board[boardPos]?.letter !== undefined) return false;

  // Tile is always valid if it is in the center of the board
  if (boardPos === 112) {
    return true;
  }

  // If the second tile is played, make sure it is in the same row or column as the first tile
  if (boardPosToHeldTileMap.size === 1) {
    let firstTile = boardPosToHeldTileMap.keys().next().value || -1;

    let baseColumn = firstTile % 15;
    let baseRow = (firstTile - baseColumn) / 15;

    let newColumn = boardPos % 15;
    let newRow = (boardPos - newColumn) / 15;

    if (baseColumn !== newColumn && baseRow !== newRow) return false;
  }
  // All tiles past the first two should be in the same row or column as all other tiles
  if (boardPosToHeldTileMap.size > 1) {
    let firstTile = Number([...boardPosToHeldTileMap.entries()][0]![0]);
    let secondTile = Number([...boardPosToHeldTileMap.entries()][1]![0]);

    let firstColumn = firstTile % 15;
    let firstRow = (firstTile - firstColumn) / 15;
    let secondColumn = secondTile % 15;
    let secondRow = (secondTile - secondColumn) / 15;

    let newColumn = boardPos % 15;
    let newRow = (boardPos - newColumn) / 15;

    console.log(
      `first: [${firstRow}, ${firstColumn}]\nsecond: [${secondRow}, ${secondColumn}]\new: [${newRow}, ${newColumn}]`
    );

    // Ensure that the newly played tile falls into line with the first two played tiles
    if (
      !(
        (firstColumn == secondColumn && firstColumn == newColumn) ||
        (firstRow == secondRow && firstRow == newRow)
      )
    )
      return false;
  }

  // Ensure played tile is adjacent to another tile
  let adjacentOffsets: Array<number> = [1, -1, 15, -15];
  for (let x of adjacentOffsets) {
    let pos: number = boardPos + x;

    if (
      boardPosToHeldTileMap.get(pos) !== undefined ||
      board[pos]?.letter !== undefined
    ) {
      return true;
    }
  }

  return false;
}

export function Game({ roomID, username }: GameProps) {
  const [selectedTileIndex, selectTileIndex] = useState(-1);
  const [boardPosToHeldTileMap, setBoardPosToHeldTileMap] = useState(
    new Map<number, number>()
  );
  const [invalidTurnMessage, setInvalidTurnMessage] = useState("");
  const [turnPoints, setTurnPoints] = useState(0);

  let WS_URL;
  if (import.meta.env.DEV) {
    WS_URL = import.meta.env.VITE_DEV_WS_URL || "ws://localhost:8000/ws";
  } else {
    let protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let host = window.location.host;
    WS_URL = `${protocol}//${host}/ws`;
  }

  const { sendJsonMessage, lastJsonMessage } = useWebSocket<GameData>(WS_URL, {
    share: true,
    queryParams: { username, roomID },
  });

  const THROTTLE_MS = 100;
  const sendJsonMessageThrottled = useRef(
    throttle(sendJsonMessage, THROTTLE_MS)
  );

  useEffect(() => {
    // Initial Login Message
    messageAPI("page_loaded");

    window.addEventListener("mousemove", (e) => {
      messageAPI("mouse_move", [e.clientX, e.clientY], true);
    });
  }, []);

  function messageAPI(
    _message: string,
    _data: any = undefined,
    throttled: boolean = false
  ) {
    const message: WSMessage = {
      message: _message,
      data: _data,
    };

    if (throttled) {
      sendJsonMessageThrottled.current(message);
    } else {
      sendJsonMessage(message);
    }
  }

  function endTurn() {
    // TODO: should just be messageAPI("play_turn", [...boardPosToHeldTileMap.entries()]); where the server also checks how many points the move is worth based on the pieces played, but for now it's just going to be sent by the user
    messageAPI("play_turn", [[...boardPosToHeldTileMap.entries()], turnPoints]);
    setBoardPosToHeldTileMap(new Map<number, number>());
    setInvalidTurnMessage("It is not currently your turn.");
    setTurnPoints(0);
  }

  /** Update all words played during turn and return the points earned */
  function turnWordsAndPoints(
    newMap: Map<number, number>,
    words: Array<string>
  ) {
    const flatBoard: Array<Space> = lastJsonMessage.board;
    // Uses strings so that values are immutable and therefore no duplicates within a set, just be sure to JSON.parse whenever you're using them
    const wordIntervals: Set<string> = new Set();

    // Flatten board to act as if played tiles are hard set onto the board
    for (let spacePos of newMap.keys()) {
      flatBoard[spacePos]!.letter =
        lastJsonMessage.userData.tiles[newMap.get(Number(spacePos)) || 0];
    }

    // Find words based on tiles connected to played tiles
    for (let spacePos of newMap.keys()) {
      // Word interval checking for horizontal and vertical
      let vStart: number = spacePos;
      let vEnd: number = spacePos;
      let hStart: number = spacePos;
      let hEnd: number = spacePos;
      // Check if interval start/end goes out of bounds or runs into a blank space
      while (vStart - 15 > 0 && flatBoard[vStart - 15]!.letter !== undefined)
        vStart -= 15;

      while (vEnd + 15 <= 225 && flatBoard[vEnd + 15]!.letter !== undefined)
        vEnd += 15;

      while (
        (hStart % 15) - 1 > 0 &&
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

        // Implement space effects
        switch (flatBoard[pos]!.effect) {
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

  function handleBoardClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    let target = (e.target as HTMLElement).closest(".space");
    // If no target was found, return
    // TODO: If not user's turn, return
    if (!target) return;
    let boardPos = Number(target.getAttribute("data-index") || "0");

    const newMap = new Map(boardPosToHeldTileMap);
    // If tile is selected, attempt to place at board pos or replace tile at board pos
    if (selectedTileIndex !== -1) {
      if (
        !validBoardPlacement(
          boardPos,
          lastJsonMessage.board,
          boardPosToHeldTileMap
        )
      )
        return;
      // Place piece in hover state on board
      newMap.set(boardPos, selectedTileIndex);
      // Reset selected tile
      selectTileIndex(-1);
    }
    // If no tile is selected, attempt to take back tile placed during the current turn
    else {
      // Remove board pos if contained in map
      newMap.delete(boardPos);
    }
    // Update board visually
    setBoardPosToHeldTileMap(newMap);

    // Check to ensure turn is valid and add up points scored this turn
    const wordsPlayed: Array<string> = [];
    let pointsEarned = turnWordsAndPoints(newMap, wordsPlayed);

    let invalidTurnReason = "";
    if (wordsPlayed.length === 0) {
      invalidTurnReason += `Words must be 2 letters or longer`;
    }
    // Check to ensure all words played are in WORD_LIST
    for (let word of wordsPlayed) {
      if (!WORD_LIST.has(word))
        invalidTurnReason +=
          invalidTurnReason.length === 0
            ? `Invalid word(s): ${word}`
            : `, ${word}`;
    }

    setTurnPoints(pointsEarned);
    setInvalidTurnMessage(invalidTurnReason);
  }

  // Ensure connection to server is established
  if (lastJsonMessage) {
    let board = lastJsonMessage.board;

    return (
      <div className="game">
        <div
          className="board"
          onClick={(e) => {
            handleBoardClick(e);
          }}
        >
          {board.map((space, index) => (
            <div
              key={index}
              data-index={index}
              className={
                "space" +
                (boardPosToHeldTileMap.get(index) !== undefined
                  ? " selected"
                  : "") +
                (space.letter || boardPosToHeldTileMap.get(index) !== undefined
                  ? " tile"
                  : "") +
                (space.effect ? " effect " + space.effect : "")
              }
            >
              <p className="main-text">
                {space.letter
                  ? space.letter
                  : boardPosToHeldTileMap.get(index) !== undefined
                  ? lastJsonMessage.userData.tiles[
                      boardPosToHeldTileMap.get(index)!
                    ]
                  : space.effect?.replace("-", " ").toUpperCase()}
              </p>
              <p className="point-text">
                {space.letter || boardPosToHeldTileMap.get(index) !== undefined
                  ? tileValues.get(
                      space.letter ||
                        lastJsonMessage.userData.tiles[
                          boardPosToHeldTileMap.get(index)!
                        ]!
                    ) || ""
                  : ""}
              </p>
            </div>
          ))}
        </div>

        <p>{lastJsonMessage.userData.tiles.length > 0 ? "Held Tiles:" : ""}</p>

        <div className="held-tiles">
          {lastJsonMessage.userData.tiles.map((tile, index) => (
            <div
              key={index}
              className={
                "tile" +
                (index == selectedTileIndex ? " selected" : "") +
                (boardPosToHeldTileMap.values().some((value) => value === index)
                  ? " placed"
                  : "")
              }
              onClick={() =>
                selectTileIndex(index != selectedTileIndex ? index : -1)
              }
            >
              <p className="main-text">{tile}</p>
              <p className="point-text">{tileValues.get(tile)}</p>
            </div>
          ))}
        </div>

        <button
          disabled={!(invalidTurnMessage.length === 0)}
          onClick={() => endTurn()}
        >
          <h1>End turn ({turnPoints} points)</h1>
        </button>
        <p>{invalidTurnMessage}</p>

        <button onClick={() => messageAPI("page_loaded")}>
          <h1>Re-send page loaded</h1>
        </button>

        <UserList
          users={lastJsonMessage.users || []}
          roomID={lastJsonMessage.roomID}
        />
      </div>
    );
  } else {
    return <p>Loading...</p>;
  }
}
