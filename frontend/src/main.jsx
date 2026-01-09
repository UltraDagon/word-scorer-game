import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Thanks to https://gist.github.com/deostroll/7693b6f3d48b44a89ee5f57bf750bd32 for the scrabble word list

createRoot(document.getElementById("root")).render(
  // Note that StrictMode causes two page_loaded messages to be sent to the server upon page load
  <StrictMode>
    <App />
  </StrictMode>
);
