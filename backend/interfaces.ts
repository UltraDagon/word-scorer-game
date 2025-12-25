export interface User {
  username: string;
  state: {
    cursorX: number;
    cursorY: number;
  };
}

export interface GameData {
  roomID: string;
  users: Record<string, User>;
  board: Array<Space>;
}

export interface Room {
  users: Record<string, User>;
  board: Array<Space>;
}

export interface GameProps {
  roomID: string;
  username: string;
}

export interface Space {
  letter?: string | undefined;
  effect?: string | undefined;
  owner?: string | undefined;
}

// WebSocket Message
export interface WSMessage {
  message: string;
  data: any;
}
