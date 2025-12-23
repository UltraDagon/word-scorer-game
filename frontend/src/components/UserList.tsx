import "./UserList.css";

interface User {
  username: string;
  state: {
    cursorX: number;
    cursorY: number;
  };
}

interface props {
  users: Record<string, User>;
}

export function UserList({ users }: props) {
  return (
    <>
      <div className="user-list">
        <p>Lobby:</p>
        <ul>
          {
            // user[0] is uuid, user[1] is User
            Object.entries(users).map((user) => {
              return (
                <li key={user[0]}>
                  ({user[1].username}) x: {user[1].state.cursorX}, y:{" "}
                  {user[1].state.cursorY}
                </li>
              );
            })
          }
        </ul>
      </div>
    </>
  );
}
