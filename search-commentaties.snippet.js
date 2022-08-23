const scData = SCDATA.initialDump.data;
const search = "vex";

let videos = scData.commentaries.filter(({ title }) =>
  title.toLowerCase().includes(search)
);

videos = videos.map(({ title, uuid }, i) => {
  return {
    id: uuid,
    name: title,
    number: i + 1,
  };
});

const playlist = {
  name: `Commentaries for ${search}`,
  number: courseId,
  videos,
};

playlist;
