import "dotenv/config.js";
import WebSocket from "ws";
import path from "path";
import os from "os";
import fs from "fs-extra";
import child_process from "child_process";
import lzma from "lzma-native";
import fetch from "node-fetch";

const { TRACE_API_URL, TRACE_API_SECRET, TRACE_MEDIA_URL } = process.env;

let ws;
const openHandle = () => {
  console.log("connected");
  ws.send("");
};

const messageHandle = async (data) => {
  const { file, algo } = JSON.parse(data.toString());
  console.log(`Hashing ${file}`);

  const tempPath = path.join(os.tmpdir(), `sola-${process.pid}`);
  console.log(`Creating temp directory ${tempPath}`);
  fs.ensureDirSync(tempPath);
  fs.emptyDirSync(tempPath);

  const imageDescriptor = [
    "cl",
    "eh",
    "jc",
    "oh",
    "ph",
    "ac",
    "ad",
    "ce",
    "fc",
    "fo",
    "jh",
    "sc",
  ].includes(algo)
    ? algo
    : null;

  if (!imageDescriptor) {
    console.log(`Error: Unsupported image descriptor "${algo}"`);
    ws.send(data);
    return;
  }

  console.log(`Downloading ${file}`);
  const [anilistID, fileName] = file.split("/");
  const mp4FilePath = path.join(tempPath, "video.mp4");
  const video = await fetch(
    `${TRACE_MEDIA_URL}/file/${anilistID}/${encodeURIComponent(fileName)}`,
    {
      headers: { "x-trace-secret": TRACE_API_SECRET },
    },
  );
  if (video.status >= 400) {
    console.log(`Error: Fail to download video "${await video.text()}"`);
    ws.send(data);
    return;
  }
  await new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(mp4FilePath);
    video.body.pipe(fileStream);
    video.body.on("error", (err) => {
      reject(err);
    });
    fileStream.on("finish", function () {
      resolve();
    });
  });
  if (!fs.existsSync(mp4FilePath)) {
    console.log("Error: Fail to download video");
    return;
  }

  console.log("Extracting thumbnails");
  const { stderr: ffmpegLog } = child_process.spawnSync(
    "ffmpeg",
    [
      "-i",
      mp4FilePath,
      "-q:v",
      2,
      "-an",
      "-vf",
      "fps=12,scale=-2:180,showinfo",
      `${tempPath}/%08d.jpg`,
    ],
    { encoding: "utf-8", maxBuffer: 1024 * 1024 * 100 },
  );
  fs.unlinkSync(mp4FilePath);
  const myRe = /pts_time:\s*((\d|\.)+?)\s*pos/g;
  let temp = [];
  const timeCodeList = [];
  while ((temp = myRe.exec(ffmpegLog)) !== null) {
    timeCodeList.push(parseFloat(temp[1]).toFixed(4));
  }
  console.log(`Extracted ${timeCodeList.length} timecode`);

  const thumbnailList = fs.readdirSync(tempPath);
  console.log(`Extracted ${thumbnailList.length} thumbnails`);

  console.log("Preparing frame files for analysis");
  const thumbnailListPath = path.join(tempPath, "frames.txt");
  fs.writeFileSync(
    thumbnailListPath,
    thumbnailList
      .slice(0, timeCodeList.length)
      .map((each) => path.join(tempPath, each))
      .join("\n"),
  );

  console.log("Analyzing frames");
  const lireSolrXMLPath = path.join(tempPath, "output.xml");
  const { stdout, stderr } = child_process.spawnSync(
    "java",
    [
      "-cp",
      "jar/*",
      "net.semanticmetadata.lire.solr.indexing.ParallelSolrIndexer",
      "-i",
      thumbnailListPath,
      "-o",
      lireSolrXMLPath,
      "-f", // force to overwrite output file
      // "-a", // use both BitSampling and MetricSpaces
      // "-l", // disable bitSampling and use MetricSpaces instead
      "-n", // number of threads
      16,
      "-y", // defines which feature classes are to be extracted, comma separated
      imageDescriptor, // cl,eh,jc,oh,ph,ac,ad,ce,fc,fo,jh,sc
    ],
    { encoding: "utf-8", maxBuffer: 1024 * 1024 * 100 },
  );
  console.log(stdout);
  console.log(stderr);

  console.log("Post-Processing XML");
  // replace frame numbers with timecode
  // and sort by timecode in ascending order
  const parsedXML = [
    "<add>",
    fs
      .readFileSync(lireSolrXMLPath, "utf-8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.indexOf("<doc>") === 0)
      .map((line) =>
        line.replace(
          /<field name="id">.*\/(.*?\.jpg)<\/field>/g,
          (match, p1) => `<field name="id">${timeCodeList[thumbnailList.indexOf(p1)]}</field>`,
        ),
      )
      .sort(
        (a, b) =>
          parseFloat(a.match(/<field name="id">(.*?)<\/field>/)[1]) -
          parseFloat(b.match(/<field name="id">(.*?)<\/field>/)[1]),
      )
      .join("\n"),
    "</add>",
  ].join("\n");
  // fs.writeFileSync("debug.xml", parsedXML);
  console.log("Removing temp files");
  fs.removeSync(tempPath);

  console.log("Compressing XML");
  const compressedXML = await lzma.compress(parsedXML, { preset: 6 });

  console.log(`Uploading ${file}`);
  await fetch(`${TRACE_API_URL}/hash/${anilistID}/${encodeURIComponent(fileName)}`, {
    method: "PUT",
    body: compressedXML,
    headers: { "x-trace-secret": TRACE_API_SECRET },
  });
  ws.send(data);
  console.log(`Uploaded ${file}`);
};

const closeHandle = async () => {
  console.log(`Connecting to ${TRACE_API_URL.replace(/^http/, "ws")}/ws`);
  ws = new WebSocket(`${TRACE_API_URL.replace(/^http/, "ws")}/ws`, {
    headers: { "x-trace-secret": TRACE_API_SECRET, "x-trace-worker-type": "hash" },
  });
  ws.on("open", openHandle);
  ws.on("message", messageHandle);
  ws.on("error", async (e) => {
    console.log(e);
  });
  ws.on("close", async (e) => {
    console.log(`WebSocket closed (Code: ${e})`);
    console.log("Reconnecting in 5 seconds");
    await new Promise((resolve) => setTimeout(resolve, 5000));
    closeHandle();
  });
};

closeHandle();
