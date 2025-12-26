import express, { raw } from "express";
import type { Request, Response } from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import url from "url";

import { User, GameData, Room, WSMessage, Space } from "./interfaces.ts";
import { randomInt } from "crypto";

const app = express();
const port = process.env.PORT || 8000;

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const buildPath = path.resolve(__dirname, "../frontend/dist");
app.use(express.static(buildPath));

app.get("/*", (req: Request, res: Response) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

const server = http.createServer(app);

// Websocket stuff
const wsServer = new WebSocketServer({ noServer: true });
const connections: Record<string, { socket: WebSocket; room: string }> = {};
const rooms: Record<string, Room> = {};

const broadcastToRoom = (roomID: string) => {
  const room = rooms[roomID];

  // Return if room does not exist
  if (!room) return;

  const data: GameData = {
    roomID: roomID,
    users: room.users,
    board: room.board,
    // UserData default values, they will be replaced later
    userData: { tiles: [] },
  };

  Object.keys(room.users).forEach((uuid) => {
    const conn = connections[uuid];
    const user = rooms[roomID].users[uuid];

    // Add user-specific data
    data.userData = { tiles: user.tiles };

    // Stringify and send message
    const message = JSON.stringify(data);
    if (conn && conn.socket.readyState === WebSocket.OPEN) {
      conn.socket.send(message);
    }
  });
};

const handleMessage = (bytes: Buffer, uuid: string) => {
  const roomID = connections[uuid].room;
  const user = rooms[roomID].users[uuid];
  const rawMessage: WSMessage = JSON.parse(bytes.toString());

  const message: string = rawMessage.message;
  const data: any = rawMessage.data;

  // Ensure that the data format is known before adding a new case.
  switch (message) {
    case "page_loaded":
      user.state = { cursorX: -1, cursorY: -1 };
      break;

    // Todo: Remove mouse_move, it was only for testing
    case "mouse_move":
      user.state = { cursorX: data[0], cursorY: data[1] };
      break;

    case "hello_world":
      refillTiles(user.tiles, user.tileLimit);
      break;

    default:
      console.log('[WARNING] Unknown message: "' + message + '"');
      break;
  }

  broadcastToRoom(roomID);
};

// On user disconnection
const handleClose = (uuid: string) => {
  const roomID = connections[uuid].room;
  const user = rooms[roomID].users[uuid];

  console.log(`User ${rooms[roomID].users[uuid].username} has disconnected`);

  delete connections[uuid];
  delete rooms[roomID].users[uuid];

  // If room is empty, delete it
  if (Object.keys(rooms[roomID].users).length == 0) {
    delete rooms[roomID];
  }

  broadcastToRoom(roomID);
};

// On new user connection
wsServer.on(
  "connection",
  (connection: WebSocket, request: http.IncomingMessage) => {
    const parsedUrl = url.parse(request.url || "", true);
    const { username, roomID } = parsedUrl.query;

    const cleanedUsername =
      (Array.isArray(username) ? username[0] : username) || "guest";
    const cleanedRoomID =
      (Array.isArray(roomID) ? roomID[0] : roomID) || "error_room";

    const uuid = uuidv4();

    console.log(`[${cleanedRoomID}] New connection from ${cleanedUsername}`);

    connections[uuid] = { socket: connection, room: cleanedRoomID };

    // If room doesn't exist, create it
    if (!rooms[cleanedRoomID]) {
      rooms[cleanedRoomID] = { users: {}, board: generateBoard() };
      console.log(`Created new room [${cleanedRoomID}]!`);
    }

    // Join the room and initialize user data
    rooms[cleanedRoomID].users[uuid] = {
      username: cleanedUsername,
      state: {
        cursorX: -1,
        cursorY: -1,
      },
      tileLimit: 7,
      tiles: [],
    };

    console.log(
      `Room [${cleanedRoomID}]: ${JSON.stringify(rooms[cleanedRoomID])}`
    );

    connection.on("message", (message: Buffer) => handleMessage(message, uuid));
    connection.on("close", () => handleClose(uuid));
  }
);

// Create websocket (I think)
server.on("upgrade", (request, socket, head) => {
  // TODO: https://stackoverflow.com/questions/59375013/node-legacy-url-parse-deprecated-what-to-use-instead
  const pathname = url.parse(request.url || "").pathname;

  // Handle websocket requests
  if (pathname === "/ws") {
    wsServer.handleUpgrade(request, socket, head, (websocket: WebSocket) => {
      wsServer.emit("connection", websocket, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, () => {
  console.log(`Websocket is running on port ${port}`);
});

function generateBoard(): Array<Space> {
  // Create default board
  const board: Array<Space> = [];
  for (let i = 0; i < 225; i++) {
    let x = i % 15;
    let y = Math.floor(i / 15);

    const space: Space = { letter: undefined, effect: undefined };

    if (x % 7 == 0 && y % 7 == 0 && !(x == 7 && y == 7)) {
      space.effect = "triple-word";
    } else if (
      x % 4 == 1 &&
      y % 4 == 1 &&
      !(Math.abs(7 - x) == 6 && Math.abs(7 - y) == 6)
    ) {
      space.effect = "triple-letter";
    } else if (
      Math.abs(7 - x) * Math.abs(7 - y) == 1 ||
      Math.abs(7 - x) * Math.abs(7 - y) == 5 ||
      Math.abs(7 - x) * Math.abs(7 - y) == 28 ||
      (Math.abs(7 - x) == 4 && y == 7) ||
      (Math.abs(7 - y) == 4 && x == 7)
    ) {
      space.effect = "double-letter";
    } else if (x == y || x == 14 - y) {
      space.effect = "double-word";
    }

    board.push(space);

    board;
  }

  return board;
}

function refillTiles(tiles: Array<string>, tileLimit: number): void {
  let tileBag =
    "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ??".split(
      ""
    );

  while (tiles.length < tileLimit) {
    let randomIndex = randomInt(tileBag.length);
    tiles.push(tileBag[randomIndex]);
  }
}
