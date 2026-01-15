import { useState } from "react";

import "./Login.css";
import { Title } from "./../components/title";
import { News } from "../components/News";

interface props {
  onSubmit: Function;
}

export function Login({ onSubmit }: props) {
  const [username, setUsername] = useState("");
  const [roomID, setRoomID] = useState("");

  return (
    <div className="login">
      <Title />
      <div className="login-form-news-container">
        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(username, roomID);
          }}
        >
          <h1>Welcome to Word Scorer Game!!!</h1>
          <h1>Join a room here:</h1>
          <br />
          <p>Enter a username:</p>
          <input
            type="text"
            value={username}
            placeholder="Ex: John Winner"
            onChange={(e) => setUsername(e.target.value)}
          />
          <br />
          <p>Enter a Room ID to create/join a room:</p>
          <input
            type="text"
            value={roomID}
            placeholder="Ex: cool room 123"
            onChange={(e) => setRoomID(e.target.value)}
          />
          <br />
          <button type="submit">Create/Join Room</button>
        </form>
        <News />
      </div>
    </div>
  );
}
