function getPlaylist() {
  const infoContainer = document.querySelector(
    '[data-name="Course Info Container"]'
  );

  const playlistName = infoContainer.querySelector(
    '[data-name="Title Area"]'
  ).textContent;

  const playlistNumber = infoContainer.querySelector(".css-sbbfp").textContent;

  const videos = [...document.querySelectorAll(".css-1xx220l")].map((item) => {
    return {
      id: item.href.split("/")[6],
      name: item.querySelector('[data-name="Title Container"]').textContent,
      number: item.querySelector('[data-name="Video Number"]').textContent,
    };
  });

  return {
    name: playlistName,
    number: playlistNumber,
    videos,
  };
}

JSON.stringify(getPlaylist());
