import { useState } from "react";

export function Login({ onSubmit }) {
  const [username, setUsername] = useState("");
  const [roomID, setRoomID] = useState("");

  return (
    <>
      <h1>Welcome!!!</h1>
      <p>Enter Username and Room ID:</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(username, roomID);
        }}
      >
        <input
          type="text"
          value={username}
          placeholder="username"
          onChange={(e) => setUsername(e.target.value)}
        />
        <br />
        <input
          type="text"
          value={roomID}
          placeholder="roomID (can be anything)"
          onChange={(e) => setRoomID(e.target.value)}
        />
        <br />
        <button type="submit">Submit</button>
      </form>
    </>
  );
}
