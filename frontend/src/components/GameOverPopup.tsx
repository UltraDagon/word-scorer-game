import "./GameOverPopup.css";

import { PublicUser } from "../../../backend/interfaces";

interface props {
  users: Record<string, PublicUser>;
  // roomID: string;
  // turn: number;
  // round: number;
}

function rankingAndSuffix(rank: number): string {
  let suffix = rank % 100 >= 20 ? ((rank % 100) + 1) % 10 : (rank % 100) + 1;

  switch (suffix) {
    case 1:
      return `${rank + 1}st`;
    case 2:
      return `${rank + 1}nd`;
    case 3:
      return `${rank + 1}rd`;
    default:
      return `${rank + 1}th`;
  }
}

export function GameOverPopup({ users }: props) {
  return (
    <div className="game-over-popup">
      <h1>GAME OVER</h1>
      {Object.entries(users)
        .toSorted((a, b) => {
          return Math.max(a[1].score, b[1].score);
        })
        .map((user, index) => {
          return (
            <li key={user[0]}>
              {rankingAndSuffix(index)}: {user[1].username} -- {user[1].score}{" "}
              points.
            </li>
          );
        })}
    </div>
  );
}
