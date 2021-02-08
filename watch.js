import "dotenv/config.js";
import fetch from "node-fetch";
import fs from "fs-extra";
import path from "path";
import chokidar from "chokidar";

const { TRACE_API_URL, TRACE_API_SECRET, TRACE_MEDIA_URL, TRACE_WATCH_PATH } = process.env;

console.log(`Watching ${TRACE_WATCH_PATH} for new files`);
chokidar
  .watch(TRACE_WATCH_PATH, {
    persistent: true,
    ignoreInitial: true,
    usePolling: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
    atomic: true, // or a custom 'atomicity delay', in milliseconds (default 100)
  })
  .on("add", async (filePath) => {
    console.log(`[chokidar] add ${filePath}`);
    if (!fs.existsSync(filePath)) {
      console.log(`Gone ${filePath}`);
      return;
    }
    if (filePath.replace(TRACE_WATCH_PATH, "").split("/").length < 2) return;

    const anilistID = filePath.replace(TRACE_WATCH_PATH, "").split("/")[0];
    const fileName = filePath.replace(TRACE_WATCH_PATH, "").split("/").pop();

    if (![".mp4"].includes(path.extname(fileName).toLowerCase())) {
      console.log(`Delete ${filePath}`);
      fs.removeSync(filePath);
      return;
    }

    console.log(`Uploading ${anilistID}/${fileName}`);
    const res = await fetch(`${TRACE_MEDIA_URL}/${anilistID}/${encodeURIComponent(fileName)}`, {
      method: "PUT",
      body: fs.createReadStream(filePath),
      headers: { "x-trace-secret": TRACE_API_SECRET },
    });
    if (res.status === 201 || res.status === 204) {
      console.log(`Uploaded ${anilistID}/${fileName}`);
      const response = await fetch(
        `${TRACE_API_URL}/uploaded/${anilistID}/${encodeURIComponent(fileName)}`,
        {
          headers: { "x-trace-secret": TRACE_API_SECRET },
        }
      );
      if (response.status !== 204) {
        console.log(`Error: API update failed. HTTP ${response.status}`);
      } else {
        console.log("Completed");
      }
    } else {
      console.log(`Error: upload failed. HTTP ${res.status}`);
    }
  })
  .on("unlink", (filePath) => {
    console.log(`[chokidar] unlink ${filePath}`);
    if (fs.readdirSync(path.dirname(filePath)).length === 0) {
      console.log(`Removing ${path.dirname(filePath)}`);
      fs.removeSync(path.dirname(filePath));
    }
  })
  .on("unlinkDir", (dirPath) => {
    console.log(`[chokidar] unlinkDir ${dirPath}`);
    if (
      fs.readdirSync(path.dirname(dirPath)).length === 0 &&
      `${path.dirname(dirPath)}/` !== TRACE_WATCH_PATH
    ) {
      console.log(`Removing ${path.dirname(dirPath)}`);
      fs.removeSync(path.dirname(dirPath));
    }
  });
