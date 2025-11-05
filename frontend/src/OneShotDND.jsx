import useWebSocket from "react-use-websocket";
import React, { useEffect, useState, useRef } from "react";
import throttle from "lodash.throttle";

const renderUsersList = (users) => {
  return (
    <ul>
      {Object.keys(users).map((uuid) => {
        return <li key={uuid}>{JSON.stringify(users[uuid])}</li>;
      })}
    </ul>
  );
};

export function OneShotDND({ username }) {
  const WS_URL = "ws://127.0.0.1:10000/ws";

  const { sendJsonMessage, lastJsonMessage } = useWebSocket(WS_URL, {
    share: true,
    queryParams: { username },
  });

  const THROTTLE_MS = 50;
  const sendJsonMessageThrottled = useRef(
    throttle(sendJsonMessage, THROTTLE_MS)
  );

  useEffect(() => {
    sendJsonMessage({
      x: -1,
      y: -1,
    });

    window.addEventListener("mousemove", (e) => {
      sendJsonMessageThrottled.current({
        x: e.clientX,
        y: e.clientY,
      });
    });
  }, []);

  if (lastJsonMessage) {
    return <>{renderUsersList(lastJsonMessage)}</>;
  }
}
