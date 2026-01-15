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

function rankingClass(rank: number): string {
  switch (rank) {
    case 0:
      return "first";
    case 1:
      return "second";
    case 2:
      return "third";
    default:
      return "";
  }
}

export function GameOverPopup({ users }: props) {
  return (
    <div className="game-over-popup">
      <h1>GAME OVER</h1>
      <ul>
        {/* todo: sorted doesnt work? */}
        {Object.entries(users)
          .toSorted((a, b) => {
            return b[1].score - a[1].score;
          })
          .map((user, index) => {
            return (
              <li key={user[0]}>
                <p className={rankingClass(index)}>
                  {rankingAndSuffix(index)}: {user[1].username} /{" "}
                  {user[1].score} points
                </p>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
