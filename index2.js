const { request } = require("undici");
const fs = require("fs");
const { spawn } = require("child_process");
// https://d13z5uuzt1wkbz.cloudfront.net/scwxykcqhl/HIDDEN4500-00058.ts
const url = "https://d13z5uuzt1wkbz.cloudfront.net";
const courses = require("./download.json");

const template = fs.readFileSync("./template.m3u8").toString("utf-8");

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

async function saveVideo(video, course, courseDir) {
  console.log(`Video with name ${video.name} started`);
  const lastNumber = await getLastPartNumber(video.id);
  console.log(`Last part number is: ${lastNumber}`);

  let result = new Array(lastNumber)
    .fill()
    .map((_, number) => {
      return buildUrl(number + 1, video.id);
    })
    .join("\n#EXTINF:10,\n");

  result = template.replace(/{{data}}/g, result);

  const m3u8Path = `./tmp/${video.id}.m3u8`;

  fs.writeFileSync(m3u8Path, result, { encoding: "utf-8" });

  await combine(video, course, courseDir, m3u8Path);

  console.log("success");
}

async function combine(video, course, courseDir, m3u8Path) {
  const number = `${video.number}`.padStart(2, "0");
  const name = `${number} ${video.name} (${video.id})`;
  const outputFile = `${courseDir}/${name}.mp4`;

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
