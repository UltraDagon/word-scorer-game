const express = require("express");
const path = require("path");

const http = require("http");
const { WebSocketServer } = require("ws");

const url = require("url");
const uuidv4 = require("uuid").v4;

// Express app stuff
const app = express();
const port = 8000;

const buildPath = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(buildPath));

app.get("/*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

const server = http.createServer(app);

// Websocket stuff
const wsServer = new WebSocketServer({ noServer: true });
const connections = {};
const users = {};

const handleMessage = (bytes, uuid) => {
  const message = JSON.parse(bytes.toString());
  const user = users[uuid];

  user.state = message;

  broadcast();

  console.log(
    `${user.username} updated their state: ${JSON.stringify(user.state)}`
  );
};

const handleClose = (uuid) => {
  console.log(`User ${users[uuid].username} has disconnected`);

  delete connections[uuid];
  delete users[uuid];

  broadcast();
};

const broadcast = () => {
  Object.keys(connections).forEach((uuid) => {
    const connection = connections[uuid];
    const message = JSON.stringify(users);
    connection.send(message);
  });
};

wsServer.on("connection", (connection, request) => {
  const { username } = url.parse(request.url, true).query;
  const uuid = uuidv4();
  console.log(`New connection from ${username}`);

  connections[uuid] = connection;

  users[uuid] = {
    username: username,
    state: {
      cursorX: -1,
      cursorY: -1,
    },
  };

  connection.on("message", (message) => handleMessage(message, uuid));
  connection.on("close", () => handleClose(uuid));
});

server.on("upgrade", (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;

  // Handle websocket requests
  if (pathname === "/ws") {
    wsServer.handleUpgrade(request, socket, head, (websocket) => {
      wsServer.emit("connection", websocket, request);
    });
  } else {
    socket.destroy;
  }
});

server.listen(port, () => {
  console.log(`Websocket is running on port ${port}`);
});
