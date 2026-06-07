const fs = require("fs");
const path = require("path");

const originalReadFile = fs.readFile;
const playgroundPath = path.join(__dirname, "public", "playground.html");
const adminScript = '<script src="admin.js"></script>';
const notificationBellScript = '<script src="admin-notification-bell.js?v=20260607-board-bell"></script>';

function isPlaygroundHtml(filePath) {
  try {
    return path.resolve(String(filePath)) === playgroundPath;
  } catch (error) {
    return false;
  }
}

function enhancePlaygroundHtml(source) {
  if (typeof source !== "string" || source.includes("admin-notification-bell.js")) return source;
  if (source.includes(adminScript)) {
    return source.replace(adminScript, `${adminScript}\n    ${notificationBellScript}`);
  }
  return source.replace("</body>", `    ${notificationBellScript}\n  </body>`);
}

fs.readFile = function patchedReadFile(filePath, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  if (typeof callback !== "function") return originalReadFile.call(this, filePath, options);

  return originalReadFile.call(this, filePath, options, (error, data) => {
    if (error || !isPlaygroundHtml(filePath)) return callback(error, data);
    const wasBuffer = Buffer.isBuffer(data);
    const enhanced = enhancePlaygroundHtml(wasBuffer ? data.toString("utf8") : data);
    return callback(null, wasBuffer ? Buffer.from(enhanced) : enhanced);
  });
};
