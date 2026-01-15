import "./UserList.css";

import { PublicUser } from "../../../backend/interfaces";

interface props {
  users: Record<string, PublicUser>;
  roomID: string;
  turn: number;
  round: number;
  tilesRemaining: number;
  selfUuid: string;
  claimUser: Function;
  kickUser: Function;
}

function ableToKick(
  uuid: string,
  user: PublicUser,
  selfUuid: string,
  users: Record<string, PublicUser>
): boolean {
  return true;

  // If user is disconnected and self is owner, self can kick
  if (!user.connected && selfUuid !== Object.keys(users)[0]) return true;

  // If owner is disconnected and self is player two, self can kick
  if (
    !user.connected &&
    uuid === Object.keys(users)[0] &&
    selfUuid === Object.keys(users)[1]
  )
    return true;

  return false;
}

export function UserList({
  users,
  roomID,
  turn,
  round,
  tilesRemaining,
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
                  {ableToKick(user[0], user[1], selfUuid, users) ? (
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
        <p className="tiles-remaining">
          Tiles remaining in bag: {tilesRemaining}
        </p>
      </div>
    </>
  );
}
