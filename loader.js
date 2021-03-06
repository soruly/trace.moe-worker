import "dotenv/config.js";
import WebSocket from "ws";
import xmldoc from "xmldoc";
import lzma from "lzma-native";
import fetch from "node-fetch";

const { TRACE_API_URL, TRACE_API_SECRET } = process.env;

let ws;
const openHandle = () => {
  console.log("connected");
};

const messageHandle = async (message) => {
  const { file, core } = JSON.parse(message);

  console.log(`Downloading ${file}`);
  const [anilistID, fileName] = file.split("/");
  const res = await fetch(
    `${TRACE_API_URL}/hash/${anilistID}/${encodeURIComponent(fileName)}.xml.xz`,
    {
      headers: { "x-trace-secret": TRACE_API_SECRET },
    }
  );
  if (res.status >= 400) {
    console.log(`Error: Fail to download "${await res.text()}"`);
    ws.send(message);
    return;
  }

  console.log("Unzipping hash");
  const data = await lzma.decompress(await res.buffer());

  console.log("Parsing xml");
  const hashList = new xmldoc.XmlDocument(data).children
    .filter((child) => child.name === "doc")
    .map((doc) => {
      const fields = doc.children.filter((child) => child.name === "field");
      return {
        time: parseFloat(fields.filter((field) => field.attr.name === "id")[0].val),
        cl_hi: fields.filter((field) => field.attr.name === "cl_hi")[0].val,
        cl_ha: fields.filter((field) => field.attr.name === "cl_ha")[0].val,
      };
    })
    .sort((a, b) => a.time - b.time);

  const dedupedHashList = [];
  hashList.forEach((currentFrame) => {
    if (
      !dedupedHashList
        .slice(-24) // get last 24 frames
        .filter((frame) => currentFrame.time - frame.time < 2) // select only frames within 2 sec
        .some((frame) => frame.cl_hi === currentFrame.cl_hi) // check for exact match frames
    ) {
      dedupedHashList.push(currentFrame);
    }
  });

  const xml = [
    "<add>",
    dedupedHashList
      .map((doc) =>
        [
          "<doc>",
          '<field name="id">',
          `<![CDATA[${file}/${doc.time.toFixed(2)}]]>`,
          "</field>",
          '<field name="cl_hi">',
          doc.cl_hi,
          "</field>",
          '<field name="cl_ha">',
          doc.cl_ha,
          "</field>",
          "</doc>",
        ].join("")
      )
      .join("\n"),
    "</add>",
  ].join("\n");

  console.log(`Uploading xml to ${core}`);
  await fetch(`${core}/update?wt=json&commit=true`, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body: xml,
  });

  await fetch(`${TRACE_API_URL}/loaded/${anilistID}/${encodeURIComponent(fileName)}`, {
    headers: { "x-trace-secret": TRACE_API_SECRET },
  });
  ws.send(message);
  console.log(`Loaded ${file}`);
};

const closeHandle = async () => {
  console.log("connecting");
  ws = new WebSocket(`${TRACE_API_URL}/ws`, {
    headers: { "x-trace-secret": TRACE_API_SECRET, "x-trace-worker-type": "load" },
  });
  ws.on("open", openHandle);
  ws.on("message", messageHandle);
  ws.on("close", async () => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    closeHandle();
  });
};

closeHandle();
