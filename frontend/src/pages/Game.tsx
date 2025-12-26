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

  function handleBoardClick(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    let target = (e.target as HTMLElement).closest(".space");
    // If no target was found, return
    if (!target) return;
    let boardPos = Number(target.getAttribute("data-index") || "0");

    // If not user's turn, return
    const newMap = new Map(boardPosToHeldTileMap);
    // If tile is selected, attempt to place at board pos or replace tile at board pos
    if (selectedTileIndex !== -1) {
      newMap.set(boardPos, selectedTileIndex);
      // Reset selected tile
      selectTileIndex(-1);
    }
    // If no tile is selected, attempt to take back tile placed during the current turn
    else {
    }
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
        <button onClick={() => messageAPI("hello_world")}>Hello, World!</button>

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
