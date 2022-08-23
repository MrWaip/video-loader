const videoId = window.location.href.split("/").slice(-1)[0];
const scData = SCDATA.initialDump.data;

const rawVideo = scData.commentaries.find(({ uuid }) => uuid === videoId);

video = {
  id: rawVideo.uuid,
  name: rawVideo.title,
  number: 1
};

video;
