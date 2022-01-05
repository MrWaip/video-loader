const { request } = require("undici");
const fs = require("fs");
const cliProgress = require("cli-progress");
const { spawn, exec } = require("child_process");
// https://d13z5uuzt1wkbz.cloudfront.net/scwxykcqhl/HIDDEN4500-00058.ts
const url = "https://d13z5uuzt1wkbz.cloudfront.net";
const id = process.argv[2];
const chunkSize = 15;

// create new progress bar
const b1 = new cliProgress.SingleBar({
  format: "{bar} | {percentage}% || {value}/{total} Chunk download started",
  barCompleteChar: "\u2588",
  barIncompleteChar: "\u2591",
  hideCursor: true,
});

const b2 = new cliProgress.SingleBar({
  format: "{bar} | {percentage}% || {value}/{total} Saving chunks",
  barCompleteChar: "\u2588",
  barIncompleteChar: "\u2591",
  hideCursor: true,
});

if (!id) throw new Error("Video id must be specified");

/**
 *
 * @param {number} partNumber
 * @returns
 */
function buildUrl(partNumber) {
  partNumber = partNumber.toString().padStart(5, "0");
  return `${url}/${id}/HIDDEN2500-${partNumber}.ts`;
}

async function downloadPart(number) {
  const partUrl = buildUrl(number);
  const response = await request(partUrl, {
    // headers: { "accept-encoding": "gzip, deflate, br" },
  });

  b1.increment();

  if (response.statusCode === 200) {
    return response;
  } else {
    throw new Error(`Failed to download ${partUrl}`);
  }
}

(async () => {
  const lastNumber = await getLastPartNumber();
  console.log(`Last part number is: ${lastNumber}`);

  const parts = [];
  let chunkIndex = 0;
  let chunkCount = Math.floor(lastNumber / chunkSize);
  let lastChunkLength = lastNumber % chunkSize;

  b1.start(lastNumber, 0);

  while (chunkIndex <= chunkCount) {
    const chunk = [];
    const length = chunkIndex === chunkCount ? lastChunkLength : chunkSize;

    for (let i = 1; i <= length; i++) {
      const partNumber = chunkIndex * chunkSize + i;
      chunk.push(downloadPart(partNumber));
    }

    parts.push(...(await Promise.all(chunk)).map((response) => response.body));
    chunkIndex++;
  }

  b1.stop();

  b2.start(lastNumber, 0);

  const partsPromise = parts.map((response, index) =>
    save(response, index + 1)
  );

  const paths = await Promise.all(partsPromise);

  b2.stop();

  const partList = paths.map((path) => `file '${path}'`).join("\n");

  fs.writeFileSync("./tmp/list.txt", partList, { encoding: "utf-8" });

  await combine(id);

  await clear();

  console.log("success");
})();

async function save(stream, index) {
  const filename = `output_${index}.ts`;
  const outputDir = `./tmp/${filename}`;
  const writeStream = fs.createWriteStream(outputDir);

  await pipe(stream, writeStream);

  b2.increment();

  return filename;
}

async function clear() {
  return new Promise((resolve, reject) => {
    exec(
      `find ./tmp -type f -name "*" ! -name "*.mp4" -delete`,
      (err, data) => {
        if (err) reject(err);

        resolve(data);
      }
    );
  });
}

async function combine(id) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "./tmp/list.txt",
      "-c",
      "copy",
      `./tmp/${id}.mp4`,
    ]);

    proc.stdout.on("data", console.log);

    proc.stderr.setEncoding("utf8");

    proc.stderr.on("data", console.log);

    proc.on("close", resolve);
  });
}

function pipe(inStream, outStream) {
  return new Promise((resolve, reject) => {
    inStream.pipe(outStream);
    inStream.on("end", resolve);
    inStream.on("error", reject);
  });
}

async function getLastPartNumber() {
  return await binarySearch(async (number) => {
    const url = buildUrl(number);
    const res = await request(url);

    if (res.statusCode === 200) {
      return 1;
    } else {
      return -1;
    }
  });
}

async function binarySearch(compare) {
  let min = 0;
  let max = 1000;

  while (min <= max) {
    const current = (max + min) >> 1;
    const result = await compare(current);

    if (result > 0) {
      min = current + 1;
    } else if (result < 0) {
      max = current - 1;
    } else {
      return current;
    }
  }

  return min - 1;
}
