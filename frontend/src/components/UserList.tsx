import "./UserList.css";

import { PublicUser } from "../../../backend/interfaces";

interface props {
  users: Record<string, PublicUser>;
  roomID: string;
  turn: number;
  round: number;
  selfUuid: string;
  claimUser: Function;
  kickUser: Function;
}

export function UserList({
  users,
  roomID,
  turn,
  round,
  selfUuid,
  claimUser,
  kickUser,
}: props) {
  return (
    <>
      <div className="user-list">
        <p className="title">
          Room "{roomID}" -{" "}
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
                  {user[1].username} / {user[1].score} points
                  {user[1].connected ? "" : " (Disconnected)"}
                  {!user[1].connected && selfUuid === Object.keys(users)[0] ? (
                    <button onClick={() => kickUser(user[0])}>Kick User</button>
                  ) : (
                    ""
                  )}
                  {!user[1].connected && users[selfUuid]?.score === 0 ? (
                    <button onClick={() => claimUser(user[0])}>
                      Claim User
                    </button>
                  ) : (
                    ""
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
