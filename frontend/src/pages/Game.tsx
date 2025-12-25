import useWebSocket from "react-use-websocket";
import { useEffect, useRef } from "react";
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
  let WS_URL;

  if (import.meta.env.DEV) {
    WS_URL = import.meta.env.VITE_DEV_WS_URL || "ws://localhost:8000/ws";
  } else {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    WS_URL = `${protocol}//${host}/ws`;
  }

  const { sendJsonMessage, lastJsonMessage } = useWebSocket<GameData>(WS_URL, {
    share: true,
    queryParams: { username, roomID },
  });

  const THROTTLE_MS = 50;
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

  if (lastJsonMessage) {
    let board = lastJsonMessage.board;

    return (
      <div className="game">
        <div className="board">
          {board.map((space) => (
            <div
              className={
                "space" +
                (space.letter ? " tile" : "") +
                (space.effect ? " effect " + space.effect : "")
              }
            >
              <p>{space.letter}</p>
            </div>
          ))}
        </div>
        <button onClick={() => messageAPI("hello_world")}>Hello, World!</button>
        <UserList users={lastJsonMessage.users || {}} />
      </div>
    );
  } else {
    return <p>Loading...</p>;
  }
}
