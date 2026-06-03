// TOOL: Music player — per-guild queue, YouTube streaming via play-dl + @discordjs/voice.
const {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior,
} = require("@discordjs/voice");
const playdl = require("play-dl");
const ffmpegPath = require("ffmpeg-static");

// Per-guild state map
const queues = new Map();

function getState(guildId) {
  if (!queues.has(guildId)) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    const state = { connection: null, player, songs: [], current: null, currentResource: null, volume: 0.5 };
    player.on(AudioPlayerStatus.Idle, () => {
      console.log(`[music] player idle in ${guildId}, playing next`);
      playNext(guildId);
    });
    player.on(AudioPlayerStatus.Playing, () => {
      console.log(`[music] player now playing in ${guildId}`);
    });
    player.on("error", (err) => {
      console.error(`[music] player error in ${guildId}:`, err.message, err);
      playNext(guildId);
    });
    queues.set(guildId, state);
  }
  return queues.get(guildId);
}

async function playNext(guildId) {
  const state = getState(guildId);
  if (!state.songs.length) {
    state.current = null;
    return;
  }
  const song = state.songs.shift();
  state.current = song;
  try {
    console.log(`[music] starting stream for "${song.title}" (${song.url})`);
    const stream = await Promise.race([
      playdl.stream(song.url),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Stream request timed out")), 10_000)),
    ]);
    console.log(`[music] stream acquired for "${song.title}" (type: ${stream.type})`);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true,
      ffmpegOptions: {
        '-acodec': 'libopus',
        '-ar': '48000',
        '-ac': '2',
      },
    });
    resource.volume.setVolume(state.volume);
    state.currentResource = resource;
    state.player.play(resource);
    console.log(`[music] now playing "${song.title}"`);
  } catch (err) {
    console.error(`[music] stream error for "${song.title}":`, err.message);
    playNext(guildId); // skip broken track and try next
  }
}

async function play(guildId, voiceChannel, query) {
  const state = getState(guildId);

  // Join voice channel if not already connected
  if (!state.connection) {
    console.log(`[music] joining voice channel ${voiceChannel.id}`);
    state.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });
    console.log(`[music] connection created, status: ${state.connection.state.status}`);

    state.connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`[music] voice connection ready in ${guildId}`);
    });
    state.connection.on(VoiceConnectionStatus.Connecting, () => {
      console.log(`[music] voice connection connecting in ${guildId}`);
    });
    state.connection.on(VoiceConnectionStatus.Signalling, () => {
      console.log(`[music] voice connection signalling in ${guildId}`);
    });

    const subscription = state.connection.subscribe(state.player);
    console.log(`[music] subscribed player to connection, subscription:`, subscription ? "OK" : "FAILED");

    state.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log(`[music] voice connection disconnected in ${guildId}`);
      try {
        await Promise.race([
          entersState(state.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(state.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        console.log(`[music] reconnect timeout, destroying connection in ${guildId}`);
        state.connection.destroy();
        queues.delete(guildId);
      }
    });
  }

  // Resolve YouTube URL or search query
  let songInfo;
  try {
    if (playdl.yt_validate(query) === "video") {
      console.log(`[music] fetching video info for URL: ${query}`);
      const info = await Promise.race([
        playdl.video_info(query),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Video info lookup timed out")), 8_000)),
      ]);
      songInfo = {
        title: info.video_details.title,
        url: query,
        duration: info.video_details.durationInSec,
      };
      console.log(`[music] video info resolved: "${songInfo.title}"`);
    } else {
      console.log(`[music] searching YouTube for: "${query}"`);
      const results = await Promise.race([
        playdl.search(query, { limit: 1, source: { youtube: "video" } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("YouTube search timed out")), 8_000)),
      ]);
      if (!results.length) throw new Error("No results found on YouTube");
      songInfo = {
        title: results[0].title,
        url: results[0].url,
        duration: results[0].durationInSec,
      };
      console.log(`[music] search resolved: "${songInfo.title}"`);
    }
  } catch (err) {
    throw new Error(`Could not find "${query}" — ${err.message}`);
  }

  console.log(`[music] queuing "${songInfo.title}", status: ${state.player.state.status}`);

  state.songs.push(songInfo);

  // Start playing if idle
  if (state.player.state.status === AudioPlayerStatus.Idle) {
    await playNext(guildId);
    return { ...songInfo, queued: false };
  }

  return { ...songInfo, queued: true };
}

function skip(guildId) {
  const state = getState(guildId);
  if (!state.current) return false;
  state.player.stop(); // triggers Idle event → playNext
  return true;
}

function stop(guildId) {
  const state = queues.get(guildId);
  if (!state) return;
  state.songs = [];
  state.current = null;
  state.player.stop(true);
  if (state.connection) state.connection.destroy();
  queues.delete(guildId);
}

function setVolume(guildId, percent) {
  const state = getState(guildId);
  state.volume = Math.max(0, Math.min(100, percent)) / 100;
  if (state.currentResource?.volume) {
    state.currentResource.volume.setVolume(state.volume);
  }
  return Math.round(state.volume * 100);
}

function getNowPlaying(guildId) {
  return getState(guildId).current || null;
}

function getQueueState(guildId) {
  const state = getState(guildId);
  return { current: state.current, upcoming: [...state.songs] };
}

function formatDuration(sec) {
  if (!sec) return "??:??";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

module.exports = { play, skip, stop, setVolume, getNowPlaying, getQueueState, formatDuration };
