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
} from "../../../backend/interfaces";

export function Game({ roomID, username }: GameProps) {
  const [selectedTileIndex, selectTileIndex] = useState(-1);
  const [boardPosToHeldTileMap, setBoardPosToHeldTileMap] = useState(
    new Map<number, number>()
  );

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
    messageAPI("play_turn", [...boardPosToHeldTileMap.entries()]);
    setBoardPosToHeldTileMap(new Map<number, number>());
  }

  // TODO: Consider allowing placement anywhere but not allowing for the turn to be played
  function validBoardPlacement(boardPos: number): boolean {
    // Tile is invalid if there is already a tile in that position
    if (lastJsonMessage.board[boardPos]?.letter !== undefined) return false;

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
        lastJsonMessage.board[pos]?.letter !== undefined
      ) {
        return true;
      }
    }

    return false;
  }

  function handleBoardClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    let target = (e.target as HTMLElement).closest(".space");
    // If no target was found, return
    if (!target) return;
    let boardPos = Number(target.getAttribute("data-index") || "0");

    // TODO: If not user's turn, return
    // TODO: If space is taken up on gameData, return
    const newMap = new Map(boardPosToHeldTileMap);
    // If tile is selected, attempt to place at board pos or replace tile at board pos
    if (selectedTileIndex !== -1) {
      if (!validBoardPlacement(boardPos)) return;
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
              <p>
                {space.letter
                  ? space.letter
                  : boardPosToHeldTileMap.get(index) !== undefined
                  ? lastJsonMessage.userData.tiles[
                      boardPosToHeldTileMap.get(index)!
                    ]
                  : space.effect?.replace("-", " ").toUpperCase()}
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
              <p>{tile}</p>
            </div>
          ))}
        </div>

        <button onClick={() => endTurn()}>
          <h1>End turn</h1>
        </button>

        <button onClick={() => messageAPI("page_loaded")}>
          <h1>Re-send page loaded</h1>
        </button>

        <p>{JSON.stringify(Object.fromEntries(boardPosToHeldTileMap))}</p>
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
