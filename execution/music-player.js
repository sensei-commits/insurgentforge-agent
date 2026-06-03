// TOOL: Music player using discord-player (battle-tested library for Discord music bots).
const { useMainPlayer, useQueue } = require("discord-player");

// Initialize player once
function initPlayer() {
  try {
    const player = useMainPlayer();
    console.log("[music] discord-player initialized");
    return player;
  } catch (err) {
    console.error("[music] failed to init player:", err.message);
    return null;
  }
}

const player = initPlayer();

async function play(guildId, voiceChannel, query) {
  if (!player) throw new Error("Player not initialized");

  try {
    console.log(`[music] /play requested for: "${query}"`);

    // Get or create queue for this guild
    let queue = useQueue(guildId);
    if (!queue) {
      queue = player.nodes.create(guildId, {
        metadata: { channel: voiceChannel },
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 300_000,
      });
      console.log(`[music] created queue for guild ${guildId}`);
    }

    // Connect if not already connected
    if (!queue.connection) {
      await queue.connect(voiceChannel);
      console.log(`[music] connected to voice channel ${voiceChannel.id}`);
    }

    // Search and play
    console.log(`[music] searching for: "${query}"`);
    const results = await player.search(query, {
      requestedBy: "bot",
      searchEngine: "youtube",
    });

    if (!results || !results.tracks.length) {
      throw new Error(`No results found for "${query}"`);
    }

    const track = results.tracks[0];
    console.log(`[music] found track: "${track.title}" (${track.durationMS}ms)`);

    const isPlaying = queue.isPlaying();
    queue.addTrack(track);

    if (!isPlaying) {
      await queue.node.play();
      console.log(`[music] started playback`);
      return {
        title: track.title,
        duration: Math.floor(track.durationMS / 1000),
        queued: false,
      };
    } else {
      console.log(`[music] added to queue`);
      return {
        title: track.title,
        duration: Math.floor(track.durationMS / 1000),
        queued: true,
      };
    }
  } catch (err) {
    console.error(`[music] play error:`, err.message);
    throw err;
  }
}

function skip(guildId) {
  try {
    const queue = useQueue(guildId);
    if (!queue || !queue.isPlaying()) return false;
    queue.node.skip();
    console.log(`[music] skipped`);
    return true;
  } catch (err) {
    console.error(`[music] skip error:`, err.message);
    return false;
  }
}

function stop(guildId) {
  try {
    const queue = useQueue(guildId);
    if (!queue) return;
    queue.delete();
    console.log(`[music] stopped and cleared queue`);
  } catch (err) {
    console.error(`[music] stop error:`, err.message);
  }
}

function setVolume(guildId, percent) {
  try {
    const queue = useQueue(guildId);
    if (!queue) return 100;
    const level = Math.max(0, Math.min(100, percent));
    queue.node.setVolume(level);
    console.log(`[music] volume set to ${level}%`);
    return level;
  } catch (err) {
    console.error(`[music] setVolume error:`, err.message);
    return 100;
  }
}

function getNowPlaying(guildId) {
  try {
    const queue = useQueue(guildId);
    if (!queue || !queue.currentTrack) return null;
    return {
      title: queue.currentTrack.title,
      duration: Math.floor(queue.currentTrack.durationMS / 1000),
    };
  } catch (err) {
    console.error(`[music] getNowPlaying error:`, err.message);
    return null;
  }
}

function getQueueState(guildId) {
  try {
    const queue = useQueue(guildId);
    if (!queue) return { current: null, upcoming: [] };
    const upcoming = queue.tracks.toArray().slice(0, 10);
    return {
      current: queue.currentTrack
        ? {
            title: queue.currentTrack.title,
            duration: Math.floor(queue.currentTrack.durationMS / 1000),
          }
        : null,
      upcoming: upcoming.map((t) => ({
        title: t.title,
        duration: Math.floor(t.durationMS / 1000),
      })),
    };
  } catch (err) {
    console.error(`[music] getQueueState error:`, err.message);
    return { current: null, upcoming: [] };
  }
}

function formatDuration(sec) {
  if (!sec) return "??:??";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

module.exports = { play, skip, stop, setVolume, getNowPlaying, getQueueState, formatDuration };
