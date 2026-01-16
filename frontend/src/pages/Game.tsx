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

import {
  validBoardPlacement,
  turnWordsAndPoints,
} from "../../../backend/functions";

import { WORD_LIST } from "../../../backend/dictionary";

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
    if (swappingTiles) {
      messageAPI("swap_tiles", swappedTiles);
      swapTiles();
    } else messageAPI("play_turn", [...boardPosToHeldTileMap.entries()]);
    setBoardPosToHeldTileMap(new Map<number, number>());
    setInvalidTurnMessage("");
    setTurnPoints(0);
  }

  // TODO: Should be able to show you if a word is in the dictionary and not keep that info hidden.
  function handleBoardClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    let target = (e.target as HTMLElement).closest(".space");
    // If no target was found, return
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
    let pointsEarned = turnWordsAndPoints(
      newMap,
      wordsPlayed,
      wordIntervals,
      lastJsonMessage.board,
      lastJsonMessage.userData.tiles
    );

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

  function claimUser(uuid: string) {
    messageAPI("claim_user", uuid);
  }

  function kickUser(uuid: string) {
    messageAPI("kick_user", uuid);
  }

  // Ensure connection to server is established
  if (lastJsonMessage) {
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
            tilesRemaining={lastJsonMessage.tilesRemaining}
            selfUuid={lastJsonMessage.userData.uuid}
            claimUser={claimUser}
            kickUser={kickUser}
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
    // Line below only needed for testing
    // messageAPI("page_loaded", undefined, true);
    return <p>Loading...</p>;
  }
}
