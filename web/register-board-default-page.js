const express = require("express");

const originalListen = express.application.listen;
const attachedApps = new WeakSet();
const boardDefaultRoutes = ["/board", "/board.html", "/playground/board", "/playground/board.html"];

function attachBoardDefaultRoutes(app) {
  app.get(boardDefaultRoutes, (req, res) => {
    res.redirect(302, "/playground.html");
  });
}

express.application.listen = function patchedListen(...args) {
  if (!attachedApps.has(this)) {
    attachBoardDefaultRoutes(this);
    attachedApps.add(this);
  }
  return originalListen.apply(this, args);
};
