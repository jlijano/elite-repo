const fs = require("fs");
const path = require("path");

const originalReadFile = fs.readFile;
const indexPath = path.join(__dirname, "public", "index.html");
const voiceButtonMarkup = '<button type="button" id="voiceMessageButton" role="menuitem"><span aria-hidden="true">●</span>Send voice message</button>';
const playgroundButtonMarkup = `${voiceButtonMarkup}\n              <button type="button" id="playgroundMenuButton" role="menuitem"><span aria-hidden="true">▦</span>Add playground</button>`;
const playgroundScript = `
    <script id="chatPlaygroundMenuScript">
      (() => {
        function closeMenu() {
          const menu = document.getElementById("plusMenu");
          const plusButton = document.getElementById("filePickerButton");
          if (menu) menu.hidden = true;
          plusButton?.setAttribute("aria-expanded", "false");
        }

        function wirePlaygroundMenuButton() {
          const button = document.getElementById("playgroundMenuButton");
          if (!button || button.dataset.playgroundWired === "true") return;
          button.dataset.playgroundWired = "true";
          button.addEventListener("click", (event) => {
            event.preventDefault();
            closeMenu();
            window.location.assign("/playground.html");
          });
        }

        document.addEventListener("DOMContentLoaded", wirePlaygroundMenuButton, { once: true });
        window.addEventListener("load", wirePlaygroundMenuButton, { once: true });
        setTimeout(wirePlaygroundMenuButton, 500);
      })();
    </script>`;

function isIndexHtml(filePath) {
  try {
    return path.resolve(String(filePath)) === indexPath;
  } catch (error) {
    return false;
  }
}

function enhanceIndexHtml(source) {
  if (typeof source !== "string") return source;
  let html = source;
  if (!html.includes('id="playgroundMenuButton"') && html.includes(voiceButtonMarkup)) {
    html = html.replace(voiceButtonMarkup, playgroundButtonMarkup);
  }
  if (!html.includes('id="chatPlaygroundMenuScript"')) {
    html = html.replace("</body>", `${playgroundScript}\n  </body>`);
  }
  return html;
}

fs.readFile = function patchedReadFile(filePath, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }
  if (typeof callback !== "function") return originalReadFile.call(this, filePath, options);

  return originalReadFile.call(this, filePath, options, (error, data) => {
    if (error || !isIndexHtml(filePath)) return callback(error, data);
    const wasBuffer = Buffer.isBuffer(data);
    const enhanced = enhanceIndexHtml(wasBuffer ? data.toString("utf8") : data);
    return callback(null, wasBuffer ? Buffer.from(enhanced) : enhanced);
  });
};
