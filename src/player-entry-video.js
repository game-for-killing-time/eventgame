import './player-entry-video.css';

let video;
let active = false;

function syncPlayback() {
 if (!video) return;
 if (!active || document.hidden) video.pause();
 else if (video.paused) {
  video.muted = true;
  video.play().catch(() => {});
 }
}

// Keep one player outside the game root so form updates never restart the video.
export function setEntryVideo(visible) {
 active = !!visible;
 if (active && !video) {
  video = document.createElement('video');
  video.className = 'player-entry-video';
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.poster = './art/island-campfire-wide-1920.png';
  video.setAttribute('aria-hidden', 'true');
  video.tabIndex = -1;
  video.disablePictureInPicture = true;
  for (const type of ['webm', 'mp4']) {
   const source = document.createElement('source');
   source.src = `./art/bg-video.${type}`;
   source.type = `video/${type}`;
   video.append(source);
  }
  document.body.prepend(video);
  document.addEventListener('visibilitychange', syncPlayback);
 }
 document.body.classList.toggle('has-entry-video', active);
 if (video) video.hidden = !active;
 syncPlayback();
}
