export interface PrivateUser {
  username: string;
  tileLimit: number;
  tiles: Array<string>;
  score: number;
  connected: boolean;
}

export interface PublicUser {
  username: string;
  score: number;
  connected: boolean;
}

export interface GameData {
  roomID: string;
  users: Record<string, PublicUser>;
  board: Array<Space>;
  userData: UserData;
  turn: number;
  round: number;
  tilesRemaining: number;
}

export interface UserData {
  tiles: Array<string>;
  uuid: string;
}

export interface Room {
  users: Record<string, PrivateUser>;
  board: Array<Space>;
  /** Turn is the index of the user of whos turn it is. If turn is -1, the game has not yet begun */
  turn: number;
  /** How many times the turn order has looped, beginning at 1. -1: Final round, -2: Game is over */
  round: number;
  tileBag: Array<string>;
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

/** WebSocket Message */
export interface WSMessage {
  message: string;
  data: any;
}

export const tileValues: Map<string, number> = new Map([
  ["A", 1],
  ["B", 3],
  ["C", 3],
  ["D", 2],
  ["E", 1],
  ["F", 4],
  ["G", 2],
  ["H", 4],
  ["I", 1],
  ["J", 8],
  ["K", 5],
  ["L", 1],
  ["M", 3],
  ["N", 1],
  ["O", 1],
  ["P", 3],
  ["Q", 10],
  ["R", 1],
  ["S", 1],
  ["T", 1],
  ["U", 1],
  ["V", 4],
  ["W", 4],
  ["X", 8],
  ["Y", 4],
  ["Z", 10],
]);
