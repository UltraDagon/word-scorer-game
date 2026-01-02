import "./UserList.css";

import { User } from "../../../backend/interfaces";

interface props {
  users: Record<string, User>;
  roomID: string;
}

export function UserList({ users, roomID }: props) {
  return (
    <>
      <div className="user-list">
        <p>Lobby "{roomID}":</p>
        <ul>
          {
            // user[0] is uuid, user[1] is User TODO: possible security issue?
            Object.entries(users).map((user) => {
              return (
                <li key={user[0]}>
                  ({user[1].username}) {user[1].score} points. x:{" "}
                  {user[1].state.cursorX}, y: {user[1].state.cursorY}
                </li>
              );
            })
          }
        </ul>
      </div>
    </>
  );
}
