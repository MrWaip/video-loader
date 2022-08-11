// ffmpeg  -protocol_whitelist file,http,https,tcp,tls -i "./test.m3u8" -bsf:a aac_adtstoasc -vcodec copy -c copy -crf 50 file.mp4

const { request } = require("undici");
const fs = require("fs");
const cliProgress = require("cli-progress");
const { spawn, exec } = require("child_process");
// https://d13z5uuzt1wkbz.cloudfront.net/scwxykcqhl/HIDDEN4500-00058.ts
const url = "https://d13z5uuzt1wkbz.cloudfront.net";
const chunkSize = 15;
const courses = require("./download.json");
const { join } = require("path");
const { tmpdir } = require("os");

const template = fs.readFileSync("./template.m3u8").toString("utf-8");

// create new progress bar
const b1 = new cliProgress.SingleBar({
  format: "{bar} | {percentage}% || {value}/{total} Chunk download",
  barCompleteChar: "\u2588",
  barIncompleteChar: "\u2591",
  hideCursor: true,
});

(async () => {
  for (const course of courses) {
    console.log(`Started download course ${course.name}`);

    const dir = `./video/${course.name}`;

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    for (const video of course.videos) {
      try {
        await saveVideo(video, course, dir);
      } catch (error) {
        console.error(error);
        console.log(`Download video with name ${video.name} is failed`);
      }
    }
  }
})();

/**
 *
 * @param {number} partNumber
 * @returns
 */
function buildUrl(partNumber, id) {
  partNumber = partNumber.toString().padStart(5, "0");
  return `${url}/${id}/HIDDEN2500-${partNumber}.ts`;
}

async function downloadPart(number, id) {
  const partUrl = buildUrl(number, id);
  const response = await request(partUrl);

  if (response.statusCode === 200) {
    return response;
  } else {
    throw new Error(`Failed to download ${partUrl}`);
  }
}

async function saveVideo(video, course, courseDir) {
  console.log(`Video with name ${video.name} started`);
  const lastNumber = await getLastPartNumber(video.id);
  console.log(`Last part number is: ${lastNumber}`);

  let result = new Array(lastNumber)
    .fill()
    .map((_, number) => {
      number = (number + 1).toString().padStart(5, "0");
      return `https://d13z5uuzt1wkbz.cloudfront.net/${video.id}/HIDDEN2500-${number}.ts`;
    })
    .join("\n#EXTINF:10,\n");

  result = template.replace(/{{data}}/g, result);

  const m3u8Path = `./tmp/${video.id}.m3u8`;

  fs.writeFileSync(m3u8Path, result, { encoding: "utf-8" });

  //   const paths = [];
  //   let chunkIndex = 0;
  //   let chunkCount = Math.floor(lastNumber / chunkSize);
  //   let lastChunkLength = lastNumber % chunkSize;

  //   b1.start(lastNumber, 0);

  //   while (chunkIndex <= chunkCount) {
  //     const length = chunkIndex === chunkCount ? lastChunkLength : chunkSize;
  //     const chunk = [];

  //     for (let i = 1; i <= length; i++) {
  //       const partNumber = chunkIndex * chunkSize + i;

  //       chunk.push(downloadPart(partNumber, video.id));
  //     }

  //     const chunkResults = (await Promise.all(chunk)).map(
  //       (response) => response.body
  //     );

  //     paths.push(
  //       ...(await Promise.all(
  //         chunkResults.map((response, i) =>
  //           save(response, chunkIndex * chunkSize + i + 1, video.id)
  //         )
  //       ))
  //     );

  //     chunkIndex++;
  //   }

  //   b1.stop();

  //   const partList = paths.map((path) => `file '${path}'`).join("\n");

  //   console.log(partList);

  //   fs.writeFileSync("./tmp/list.txt", partList, { encoding: "utf-8" });

  await combine(video, course, courseDir, m3u8Path);

  console.log("success");
}

async function save(stream, index, id) {
  const filename = `output_${id}_${index}.ts`;
  const outputDir = join(tmpdir(), filename);
  const writeStream = fs.createWriteStream(outputDir);

  await pipe(stream, writeStream);

  b1.increment();

  return outputDir;
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

async function combine(video, course, courseDir, m3u8Path) {
  const number = `${video.number}`.padStart(2, "0");
  const name = `${number} ${video.name} (${video.id})`;
  const outputFile = `${courseDir}/${name}.mp4`;

  //   ffmpeg  -protocol_whitelist file,http,https,tcp,tls -i "./test.m3u8" -bsf:a aac_adtstoasc -vcodec copy -c copy -crf 50 file.mp4
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", [
      "-protocol_whitelist",
      "file,http,https,tcp,tls",
      "-i",
      m3u8Path,
      "-bsf:a",
      "aac_adtstoasc",
      "-y",
      "-vcodec",
      "copy",
      "-c",
      "copy",
      "-crf",
      "50",
      outputFile,
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

async function getLastPartNumber(id) {
  return await binarySearch(async (number) => {
    const url = buildUrl(number, id);
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
