import { useState } from "react";

import "./Login.css";

export function Login({ onSubmit }) {
  const [username, setUsername] = useState("");
  const [roomID, setRoomID] = useState("");

  return (
    <>
      <form
        className="login-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(username, roomID);
        }}
      >
        <h1>Welcome to Word Scorer Game!!!</h1>
        <p>Enter a username:</p>
        <input
          type="text"
          value={username}
          placeholder="username"
          onChange={(e) => setUsername(e.target.value)}
        />
        <br />
        <p>Enter a Room ID to create/join a room:</p>
        <input
          type="text"
          value={roomID}
          placeholder="roomID (can be anything)"
          onChange={(e) => setRoomID(e.target.value)}
        />
        <br />
        <button type="submit">Create/Join Room</button>
      </form>
    </>
  );
}
