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

// Per-guild state map
const queues = new Map();

function getState(guildId) {
  if (!queues.has(guildId)) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    const state = { connection: null, player, songs: [], current: null, currentResource: null, volume: 0.5 };
    player.on(AudioPlayerStatus.Idle, () => playNext(guildId));
    player.on("error", (err) => {
      console.error(`[music] player error in ${guildId}:`, err.message);
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
    const stream = await playdl.stream(song.url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true,
    });
    resource.volume.setVolume(state.volume);
    state.currentResource = resource;
    state.player.play(resource);
  } catch (err) {
    console.error(`[music] stream error for "${song.title}":`, err.message);
    playNext(guildId); // skip broken track and try next
  }
}

async function play(guildId, voiceChannel, query) {
  const state = getState(guildId);

  // Join voice channel if not already connected
  if (!state.connection) {
    state.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });
    state.connection.subscribe(state.player);
    state.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(state.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(state.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        state.connection.destroy();
        queues.delete(guildId);
      }
    });
  }

  // Resolve YouTube URL or search query
  let songInfo;
  try {
    if (playdl.yt_validate(query) === "video") {
      const info = await playdl.video_info(query);
      songInfo = {
        title: info.video_details.title,
        url: query,
        duration: info.video_details.durationInSec,
      };
    } else {
      const results = await playdl.search(query, { limit: 1, source: { youtube: "video" } });
      if (!results.length) throw new Error("No results found on YouTube");
      songInfo = {
        title: results[0].title,
        url: results[0].url,
        duration: results[0].durationInSec,
      };
    }
  } catch (err) {
    throw new Error(`Could not find "${query}" — ${err.message}`);
  }

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
