import express, { raw } from "express";
import type { Request, Response } from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import url from "url";
import * as dotenv from "dotenv";

import {
  PrivateUser,
  PublicUser,
  GameData,
  Room,
  WSMessage,
  Space,
} from "./interfaces.ts";
import { randomInt } from "crypto";

dotenv.config();

const isLocalEnv = process.env.LOCAL === "true";

const app = express();
const port = process.env.PORT || 8000;

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const buildPath = path.resolve(__dirname, "../frontend/dist");
app.use(express.static(buildPath));

app.get("/*", (req: Request, res: Response) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

const server = http.createServer(app);

const keepAliveCooldown = 300000; // 5 minutes
let prevKeepAliveTime: number = new Date().valueOf() - keepAliveCooldown - 1;

// Websocket stuff
const wsServer = new WebSocketServer({ noServer: true });
const connections: Record<string, { socket: WebSocket; room: string }> = {};
const rooms: Record<string, Room> = {};

// Keeps the render service active on free tier
async function keepAlive() {
  if (new Date().valueOf() - keepAliveCooldown > prevKeepAliveTime.valueOf()) {
    prevKeepAliveTime = new Date().valueOf();
    console.log(
      `${
        isLocalEnv ? "[NOT REALLY, LOCAL ENV] " : ""
      }Keeping render service alive | ${new Date()}`
    );
    // Don't keep it alive if testing during development
    // Todo: Change link once url is changed
    if (!isLocalEnv) await fetch("https://one-shot-dnd.onrender.com/");
  }
}

const broadcastToRoom = (roomID: string) => {
  const room = rooms[roomID];

  // Return if room does not exist
  if (!room) return;

  const data: GameData = {
    roomID: roomID,
    users: room.users as Record<string, PublicUser>,
    board: room.board,
    // UserData default values, they will be replaced later
    userData: { tiles: [], uuid: "" },
    turn: room.turn,
    round: room.round,
    tilesRemaining: room.tileBag.length,
  };

  Object.keys(room.users).forEach((uuid) => {
    const conn = connections[uuid];
    const user = rooms[roomID].users[uuid];

    // Add user-specific data
    data.userData = { tiles: user.tiles, uuid: uuid };

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

  keepAlive();

  try {
    const rawMessage: WSMessage = JSON.parse(bytes.toString());

    const message: string = rawMessage.message;
    const data: any = rawMessage.data;

    // Dev: Ensure that the data format is known before adding a new case.
    switch (message) {
      case "page_loaded":
        // If game has started, give new player their tiles
        if (rooms[roomID].turn !== -1)
          refillTiles(user.tiles, roomID, user.tileLimit);

        break;

      // Todo: see endTurn() function in game.tsx
      case "play_turn":
        // Todo: if not users turn, break early
        // Todo: validate turn, if it doesn't work, don't play anything

        // Update board spaces to have played tiles
        for (let i = 0; i < data[0].length; i++) {
          let boardPos = data[0][i][0];
          let tile = user.tiles[data[0][i][1]];

          rooms[roomID].board[boardPos].letter = tile;
          rooms[roomID].board[boardPos].owner = uuid;

          // Set tile to blank space to be later removed
          user.tiles[data[0][i][1]] = " ";
        }

        // Remove all used tiles
        for (let i = user.tiles.length - 1; i >= 0; i--) {
          if (user.tiles[i] === " ") user.tiles.splice(i, 1);
        }

        // Refill tiles
        refillTiles(user.tiles, roomID, user.tileLimit);

        // Update users score
        user.score += data[1];

        // TODO: move this to an external function as it's shared between here and swap tiles
        // Increment turn, loop if reached end of players
        rooms[roomID].turn =
          (rooms[roomID].turn + 1) % Object.keys(rooms[roomID].users).length;

        // If turn loops, increment the round
        if (rooms[roomID].turn === 0) {
          // If it is the final turn of the final round, the game has ended.
          if (rooms[roomID].round === -1) {
            rooms[roomID].round = -2;
            break;
          }
          rooms[roomID].round += 1;
        }

        // Check if the tile bag is empty, if so, the round is now the final round (round -1)
        if (rooms[roomID].tileBag.length === 0) rooms[roomID].round = -1;

        break;

      case "swap_tiles":
        let swappedTiles = data.map((x: number) => user.tiles[x]);

        // Remove all swapped tiles
        for (let i = user.tiles.length - 1; i >= 0; i--) {
          if (data.indexOf(i) !== -1) user.tiles.splice(i, 1);
        }

        let tilesInBag = rooms[roomID].tileBag.length;

        refillTiles(user.tiles, roomID, user.tileLimit);

        // Refill room tilebag with tiles swapped but only up to the amount of tiles available in the bag
        for (let i = 0; i < Math.min(swappedTiles.length, tilesInBag); i++)
          rooms[roomID].tileBag.push(swappedTiles[i]);

        // TODO: move this to an external function as it's shared between here and swap tiles
        // Increment turn, loop if reached end of players
        rooms[roomID].turn =
          (rooms[roomID].turn + 1) % Object.keys(rooms[roomID].users).length;

        // If turn loops, increment the round
        if (rooms[roomID].turn === 0) {
          // If it is the final turn of the final round, the game has ended.
          if (rooms[roomID].round === -1) {
            rooms[roomID].round = -2;
            break;
          }
          rooms[roomID].round += 1;
        }

        // Check if the tile bag is empty, if so, the round is now the final round (round -1)
        if (rooms[roomID].tileBag.length === 0) rooms[roomID].round = -1;

        break;

      case "start_game":
        // If user was the first to join the room, they are the owner
        if (uuid === Object.keys(rooms[roomID].users)[0])
          rooms[roomID].turn = 0;

        // Refill all user's tiles
        for (let userUuid of Object.keys(rooms[roomID].users)) {
          refillTiles(
            rooms[roomID].users[userUuid].tiles,
            roomID,
            rooms[roomID].users[userUuid].tileLimit
          );
        }

        break;

      case "claim_user":
        // Prevent claiming if the claimed user is not actually disconnected
        // Or if the claimee user has any points accumulated
        if (
          rooms[roomID].users[data].connected === true ||
          rooms[roomID].users[uuid].score > 0
        )
          break;

        console.log(`User ${uuid} has claimed user ${data}`);

        // Copy disconnected user's data to the claiming user
        rooms[roomID].users[uuid] = JSON.parse(
          JSON.stringify(rooms[roomID].users[data])
        );

        rooms[roomID].users[uuid].connected = true;

        // Todo: reorder users record to match previous order

        // Remove old user
        removeUser(data);
        break;

      case "kick_user":
        // If user is not the earliest in the room, they are not allowed to kick other users
        // Also, if kicked user is not disconnected, they cannot be kicked
        if (
          uuid !== Object.keys(rooms[roomID].users)[0] ||
          rooms[roomID].users[data].connected === true
        )
          break;

        removeUser(data);
        break;

      default:
        console.log('[WARNING] Unknown message: "' + message + '"');
        break;
    }

    broadcastToRoom(roomID);
  } catch (e) {
    console.log(
      `Error from user "${user.username}" with uuid [${uuid}]:\n${e}`
    );
  }
};

// Remove user from room
const removeUser = (uuid: string) => {
  const roomID = connections[uuid].room;

  console.log(
    `User ${rooms[roomID].users[uuid].username} has been removed from room "${roomID}"`
  );

  // Put player's tiles back into the bag
  rooms[roomID].tileBag = [
    ...rooms[roomID].tileBag,
    ...rooms[roomID].users[uuid].tiles,
  ];

  delete connections[uuid];
  delete rooms[roomID].users[uuid];

  // If room is empty, delete it
  if (Object.keys(rooms[roomID].users).length == 0) {
    console.log(`Deleted room "${roomID}"`);
    delete rooms[roomID];
  }
};

// On user disconnection
const handleClose = (uuid: string) => {
  const roomID = connections[uuid].room;
  rooms[roomID].users[uuid].connected = false;

  console.log(`User ${rooms[roomID].users[uuid].username} has disconnected`);

  // If the game hasn't started, just remove the user from the room
  if (rooms[roomID].turn === -1) {
    removeUser(uuid);
    broadcastToRoom(roomID);
    return;
  }

  let connectedUsers = 0;
  for (let user of Object.values(rooms[roomID].users)) {
    if (user.connected) connectedUsers += 1;
  }

  // If there are no connected users in a room, delete the users and room
  if (connectedUsers === 0) {
    for (let user of Object.keys(rooms[roomID].users)) {
      removeUser(user);
    }
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
      rooms[cleanedRoomID] = {
        users: {},
        board: generateBoard(),
        turn: -1,
        round: -1, // -1 to start at final round
        tileBag:
          "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ".split(
            ""
          ),
        // tileBag: "WORDSAQ".split(""),
      };
      console.log(`Created new room [${cleanedRoomID}]!`);
    }

    // Join the room and initialize user data
    rooms[cleanedRoomID].users[uuid] = {
      username: cleanedUsername,
      tileLimit: 7,
      tiles: [],
      score: 0,
      connected: true,
    };

    connection.on("message", (message: Buffer) => handleMessage(message, uuid));
    connection.on("close", () => handleClose(uuid));
  }
);

// Create websocket
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

function refillTiles(
  tiles: Array<string>,
  roomID: string,
  tileLimit: number
): void {
  // Todo: Note that there should be 2 ? tiles once the feature is implemented

  let tileBag = rooms[roomID].tileBag;
  while (tiles.length < tileLimit) {
    // Use tiles from the tilebag first, otherwise use random tiles
    if (tileBag.length > 0) {
      let randomIndex = randomInt(tileBag.length);

      tiles.push(tileBag[randomIndex]);
      tileBag.splice(randomIndex, 1);
    } else {
      let tileOdds =
        "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ".split(
          ""
        );
      let randomIndex = randomInt(tileOdds.length);

      tiles.push(tileOdds[randomIndex]);
    }
  }
}
