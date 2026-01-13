import useWebSocket from "react-use-websocket";
import { useState, useEffect, useRef } from "react";
import throttle from "lodash.throttle";

import { UserList } from "../components/UserList";
import { GameOverPopup } from "../components/GameOverPopup";
import "./Game.css";

import {
  PublicUser,
  GameData,
  GameProps,
  Space,
  WSMessage,
  tileValues,
} from "../../../backend/interfaces";

import { WORD_LIST } from "../../../backend/dictionary";

// TODO: Change to return a invalid board reason, and then add that to invalid turn reason
function validBoardPlacement(
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

  // TODO:

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

    // Check if any single tiles are not adjacent to any other tiles
    if (
      // Todo: make a function for these adjacency checks. Currently they are wrong for left and rightmost positions wrapping to other layers
      flatBoard[spacePos + 1]?.letter === undefined &&
      flatBoard[spacePos - 1]?.letter === undefined &&
      flatBoard[spacePos + 15]?.letter === undefined &&
      flatBoard[spacePos - 15]?.letter === undefined
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

    console.log(interval);

    // Change step to vertical or horizontal based on interval given
    let step = (interval[1] - interval[0]) % 15 === 0 ? 15 : 1;
    let pos = interval[0];
    // Valid if at least one tile on the interval is touching another previously played tile or the center tile
    let validInterval = false;
    while (pos <= interval[1]) {
      if (
        board[pos + 1]?.letter !== undefined ||
        board[pos - 1]?.letter !== undefined ||
        board[pos + 15]?.letter !== undefined ||
        board[pos - 15]?.letter !== undefined ||
        pos == 112
      ) {
        validInterval = true;
      }
      pos += step;
    }
    if (!validInterval) return false;
  }

  return true;
}

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

export function Game({ roomID, username }: GameProps) {
  const [selectedTileIndex, selectTileIndex] = useState(-1);
  const [boardPosToHeldTileMap, setBoardPosToHeldTileMap] = useState(
    new Map<number, number>()
  );
  const [invalidTurnMessage, setInvalidTurnMessage] = useState("");
  const [turnPoints, setTurnPoints] = useState(0);
  const [swappingTiles, setSwappingTiles] = useState(false);
  const [swappedTiles, setSwappedTiles] = useState(new Array<number>());

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
    // window.addEventListener("mousemove", (e) => {
    //   messageAPI("mouse_move", [e.clientX, e.clientY], true);
    // });
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
    if (swappingTiles) {
      messageAPI("swap_tiles", swappedTiles);
      swapTiles();
    } else
      messageAPI("play_turn", [
        [...boardPosToHeldTileMap.entries()],
        turnPoints,
      ]);
    setBoardPosToHeldTileMap(new Map<number, number>());
    setInvalidTurnMessage("");
    setTurnPoints(0);
  }

  /** Update all words played during turn and return the points earned */
  function turnWordsAndPoints(
    newMap: Map<number, number>,
    words: Array<string>,
    wordIntervals: Set<string>
  ) {
    // Flatten board to act as if played tiles are hard set onto the board
    const flatBoard: Array<Space> = getFlatBoard(
      lastJsonMessage.board,
      lastJsonMessage.userData.tiles,
      newMap
    );

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
      // Place piece in hover state on board
      newMap.set(boardPos, selectedTileIndex);
      // Reset selected tile
      selectTileIndex(-1);
      // Tile is invalid if there is already a tile in that position
      if (lastJsonMessage.board[boardPos]?.letter !== undefined) return false;
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
    // Uses strings so that values are immutable and therefore no duplicates within a set, just be sure to JSON.parse whenever you're using them
    const wordIntervals: Set<string> = new Set();
    let pointsEarned = turnWordsAndPoints(newMap, wordsPlayed, wordIntervals);

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
    if (
      !validBoardPlacement(
        lastJsonMessage.board,
        lastJsonMessage.userData.tiles,
        newMap,
        wordIntervals
      )
    ) {
      invalidTurnReason +=
        (invalidTurnReason.length === 0 ? "" : ", ") + "Invalid tile placement";
    }

    // Allow the player to skip their turn if they desire
    if (newMap.size === 0) invalidTurnReason = "";

    setTurnPoints(pointsEarned);
    setInvalidTurnMessage(invalidTurnReason);
  }

  function swapTiles() {
    setSwappingTiles(!swappingTiles);

    // Clear variables
    setBoardPosToHeldTileMap(new Map<number, number>());
    selectTileIndex(-1);
    setSwappedTiles(new Array());
    setInvalidTurnMessage("");
    setTurnPoints(0);
  }

  function handleHeldTileClick(index: number) {
    if (swappingTiles) {
      let pos = swappedTiles.indexOf(index);
      if (pos === -1) setSwappedTiles([...swappedTiles, index]);
      else setSwappedTiles(swappedTiles.toSpliced(pos, 1));
    } else {
      selectTileIndex(index != selectedTileIndex ? index : -1);
    }
  }

  if (lastJsonMessage) {
    // Ensure connection to server is established
    let board = lastJsonMessage.board;

    let canEndTurn =
      invalidTurnMessage.length === 0 && lastJsonMessage.round !== -2;
    let endTurnText = canEndTurn
      ? `End turn (${turnPoints} points)`
      : invalidTurnMessage;
    // If not players turn or the game hasn't started, don't let them make a move
    if (
      Object.keys(lastJsonMessage.users)[lastJsonMessage.turn] !==
      lastJsonMessage.userData.uuid
    ) {
      canEndTurn = false;
      endTurnText =
        lastJsonMessage.turn === -1
          ? "Waiting for the game to start..."
          : "It is not your turn.";
    }
    if (swappingTiles) endTurnText = "End Turn (Swapping Out Tiles)";
    if (lastJsonMessage.round === -2) endTurnText = "Game Over.";

    return (
      <div className={"game"}>
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

        <div className="info-panel">
          <p className="held-tiles-title">
            {lastJsonMessage.userData.tiles.length > 0 ? "Held Tiles:" : ""}
          </p>
          <div className="held-tiles">
            {lastJsonMessage.userData.tiles.map((tile, index) => (
              <div
                key={index}
                className={
                  "tile" +
                  (index == selectedTileIndex ||
                  swappedTiles.indexOf(index) !== -1
                    ? " selected"
                    : "") +
                  (boardPosToHeldTileMap
                    .values()
                    .some((value) => value === index)
                    ? " placed"
                    : "")
                }
                onClick={() => handleHeldTileClick(index)}
              >
                <p className="main-text">{tile}</p>
                <p className="point-text">{tileValues.get(tile)}</p>
              </div>
            ))}
          </div>

          {lastJsonMessage.turn === -1 &&
          Object.keys(lastJsonMessage.users)[0] ===
            lastJsonMessage.userData.uuid ? (
            <button
              className="end-turn"
              onClick={() => messageAPI("start_game")}
            >
              <h1>Start Game</h1>
            </button>
          ) : (
            <button
              className="end-turn"
              disabled={!canEndTurn}
              onClick={() => endTurn()}
            >
              <h1>{endTurnText}</h1>
            </button>
          )}
          <button
            className="swap-tiles"
            disabled={
              Object.keys(lastJsonMessage.users)[lastJsonMessage.turn] !==
                lastJsonMessage.userData.uuid || lastJsonMessage.round < 0
            }
            onClick={() => swapTiles()}
          >
            <h1>Swap out tiles</h1>
            {swappingTiles ? (
              <p>
                Swapping tiles is currently enabled, press this button again to
                disable.
              </p>
            ) : (
              ""
            )}
          </button>

          <UserList
            users={lastJsonMessage.users || []}
            roomID={lastJsonMessage.roomID}
            turn={lastJsonMessage.turn}
            round={lastJsonMessage.round}
          />
        </div>
        {lastJsonMessage.round === -2 ? (
          <GameOverPopup users={lastJsonMessage.users || []} />
        ) : (
          ""
        )}
      </div>
    );
  } else {
    messageAPI("page_loaded");
    return <p>Loading...</p>;
  }
}
