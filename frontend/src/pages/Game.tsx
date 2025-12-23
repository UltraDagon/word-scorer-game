import useWebSocket from "react-use-websocket";
import { useEffect, useRef } from "react";
import throttle from "lodash.throttle";

import { UserList } from "../components/UserList";

interface User {
  username: string;
  state: {
    cursorX: number;
    cursorY: number;
  };
}

interface GameData {
  roomID: string;
  users?: Record<string, User>;
}

interface GameProps {
  roomID: string;
  username: string;
}

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
      <>
        <UserList users={lastJsonMessage.users || {}} />
      </>
    );
  }
}
