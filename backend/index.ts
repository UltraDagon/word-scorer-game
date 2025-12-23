import express from "express";
import type { Request, Response } from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import url from "url";

interface User {
  username: string;
  state: {
    cursorX: number;
    cursorY: number;
  };
}

interface GameData {
  roomID: string;
  users: Record<string, User>;
}

interface Room {
  users: Record<string, User>;
}

const app = express();
const port = process.env.PORT || 8000;

const __dirname = path.resolve();
const buildPath = path.join(__dirname, "..", "frontend", "dist");
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
  };

  const message = JSON.stringify(data);

  Object.keys(room.users).forEach((uuid) => {
    const conn = connections[uuid];
    if (conn && conn.socket.readyState === WebSocket.OPEN) {
      conn.socket.send(message);
    }
  });
};

const handleMessage = (bytes: Buffer, uuid: string) => {
  const message = JSON.parse(bytes.toString());
  const roomID = connections[uuid].room;
  const user = rooms[roomID].users[uuid];

  user.state = message;
  broadcastToRoom(roomID);

  // console.log(
  //   `${user.username} updated their state: ${JSON.stringify(user.state)}`
  // );
};

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
      rooms[cleanedRoomID] = { users: {} };
      console.log(`Created new room [${cleanedRoomID}]!`);
    }

    // Join the room
    rooms[cleanedRoomID].users[uuid] = {
      username: cleanedUsername,
      state: {
        cursorX: -1,
        cursorY: -1,
      },
    };

    console.log(
      `Room [${cleanedRoomID}]: ${JSON.stringify(rooms[cleanedRoomID])}`
    );

    connection.on("message", (message: Buffer) => handleMessage(message, uuid));
    connection.on("close", () => handleClose(uuid));
  }
);

server.on("upgrade", (request, socket, head) => {
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
