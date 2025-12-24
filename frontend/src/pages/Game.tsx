import useWebSocket from "react-use-websocket";
import { useEffect, useRef } from "react";
import throttle from "lodash.throttle";

import { UserList } from "../components/UserList";
import "./Game.css";

import { User, GameData, GameProps, Space } from "../../../backend/interfaces";

function generateBoard(): Array<Space> {
  // Create default board
  const board: Array<Space> = [];
  for (let i = 0; i < 225; i++) {
    let x = i % 15;
    let y = Math.floor(i / 15);

    const space: Space = { letter: undefined, effect: undefined };

    if (x % 7 == 0 && y % 7 == 0 && !(x == 7 && y == 7)) {
      space.effect = "triple-word";
    } else if (
      x % 4 == 1 &&
      y % 4 == 1 &&
      !(Math.abs(7 - x) == 6 && Math.abs(7 - y) == 6)
    ) {
      space.effect = "triple-letter";
    } else if (
      Math.abs(7 - x) * Math.abs(7 - y) == 1 ||
      Math.abs(7 - x) * Math.abs(7 - y) == 5 ||
      Math.abs(7 - x) * Math.abs(7 - y) == 28 ||
      (Math.abs(7 - x) == 4 && y == 7) ||
      (Math.abs(7 - y) == 4 && x == 7)
    ) {
      space.effect = "double-letter";
    } else if (x == y || x == 14 - y) {
      space.effect = "double-word";
    }

    board.push(space);

    board;
  }

  return board;
}

export function Game({ roomID, username }: GameProps) {
  let WS_URL;
  let board: Array<Space> = generateBoard();
  board[112] = { letter: "H", effect: board[112]!.effect };
  board[113] = { letter: "E", effect: board[113]!.effect };
  board[114] = { letter: "L", effect: board[114]!.effect };
  board[115] = { letter: "L", effect: board[115]!.effect };
  board[116] = { letter: "O", effect: board[116]!.effect };
  board[117] = { letter: "K", effect: board[117]!.effect };
  board[118] = { letter: "A", effect: board[118]!.effect };
  board[119] = { letter: "T", effect: board[119]!.effect };

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
    sendJsonMessage({
      cursorX: -1,
      cursorY: -1,
    });

    window.addEventListener("mousemove", (e) => {
      sendJsonMessageThrottled.current({
        cursorX: e.clientX,
        cursorY: e.clientY,
      });
    });
  }, []);

  if (lastJsonMessage) {
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
        <UserList users={lastJsonMessage.users || {}} />
      </div>
    );
  }
}
