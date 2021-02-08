import "dotenv/config.js";
import fetch from "node-fetch";
import fs from "fs-extra";

const { TRACE_API_URL, TRACE_API_SECRET, TRACE_MEDIA_URL } = process.env;

const fileToUpload = "/mnt/data/anime/1/[KANI][Charlotte][NCED][MP4][1920x1080].mp4";
const anilistID = "1";
const filename = "[KANI][Charlotte][NCED][MP4][1920x1080].mp4";

console.log(`Uploading ${fileToUpload}`);
const res = await fetch(`${TRACE_MEDIA_URL}/${anilistID}/${encodeURIComponent(filename)}`, {
  method: "PUT",
  body: fs.createReadStream(fileToUpload),
  headers: { "x-trace-secret": TRACE_API_SECRET },
});
if (res.status === 201 || res.status === 204) {
  console.log(`Uploaded ${fileToUpload}`);
  const response = await fetch(
    `${TRACE_API_URL}/uploaded/${anilistID}/${encodeURIComponent(filename)}`,
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
