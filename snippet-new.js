const courseId = window.location.href.split("/")[7];
const scData = SCDATA.initialDump.data;

const course = scData.courses.find(({ uuid }) => uuid === courseId);
const videoIds = new Set();

scData.videosToCourses[course.title].chapters[0].vids.forEach(({ uuid }) =>
  videoIds.add(uuid)
);

let rawVideos = scData.videos.filter(({ uuid }) => videoIds.has(uuid));
let videos = [];
let i = 1;

for (const videoId of videoIds.values()) {
  const video = rawVideos.find(({ uuid }) => uuid === videoId);
  videos.push({
    id: video.uuid,
    name: video.title,
    number: i++,
  });
}

const playlist = {
  name: course.title,
  number: courseId,
  videos,
};

playlist;
