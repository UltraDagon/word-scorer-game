import "./UserList.css";

import { PublicUser } from "../../../backend/interfaces";

interface props {
  users: Record<string, PublicUser>;
  roomID: string;
  turn: number;
  round: number;
}

export function UserList({ users, roomID, turn, round }: props) {
  return (
    <>
      <div className="user-list">
        <p className="title">
          Lobby "{roomID}" -{" "}
          {round != -1 && round != -2 ? `Round ${round}` : "Final Round"}
        </p>
        <ul>
          {Object.entries(users).map((user, index) => {
            return (
              <li
                key={user[0]}
                className={turn === index ? "current-turn" : ""}
              >
                <p>
                  {user[1].username} / {user[1].score} points{" "}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
