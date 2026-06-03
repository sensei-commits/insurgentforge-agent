// TOOL: Music slash commands — registration + interaction handler.
const { REST, Routes, SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { play, skip, stop, setVolume, getNowPlaying, getQueueState, formatDuration } = require("./music-player");

// ── Command definitions ──────────────────────────────────────────────────────
const MUSIC_COMMAND_DEFS = [
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from YouTube")
    .addStringOption((o) =>
      o.setName("query").setDescription("Song name or YouTube URL").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop playback and clear the queue"),
  new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song"),
  new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current queue"),
  new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Set the volume (1-100)")
    .addIntegerOption((o) =>
      o.setName("level").setDescription("Volume level (1-100)").setMinValue(1).setMaxValue(100).setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Show what's currently playing"),
].map((c) => c.toJSON());

const MUSIC_COMMAND_NAMES = new Set(MUSIC_COMMAND_DEFS.map((c) => c.name));

// ── Registration ─────────────────────────────────────────────────────────────
async function registerMusicCommands(clientId) {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    console.warn("[music] DISCORD_GUILD_ID not set — skipping slash command registration.");
    return;
  }
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: MUSIC_COMMAND_DEFS,
    });
    console.log("[music] Slash commands registered ✅");
  } catch (err) {
    console.error("[music] Failed to register slash commands:", err.message);
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────
async function handleMusicCommand(interaction) {
  const { commandName, member, guild } = interaction;

  const voiceChannel = member?.voice?.channel;
  const needsVoice = ["play", "stop", "skip", "volume"];

  if (needsVoice.includes(commandName) && !voiceChannel) {
    return interaction.reply({
      content: "You need to be in a voice channel first.",
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  try {
    if (commandName === "play") {
      const query = interaction.options.getString("query");
      console.log(`[music] /play requested: "${query}"`);

      // Timeout after 12 seconds so Discord doesn't hang
      const song = await Promise.race([
        play(guild.id, voiceChannel, query),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out searching YouTube — try again or use a direct URL")), 12_000)),
      ]);

      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle(song.queued ? "📋 Added to queue" : "🎵 Now playing")
        .setDescription(`**${song.title}**`)
        .addFields({ name: "Duration", value: formatDuration(song.duration), inline: true });
      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "stop") {
      stop(guild.id);
      return interaction.editReply("⏹️ Stopped and cleared the queue.");
    }

    if (commandName === "skip") {
      const skipped = skip(guild.id);
      return interaction.editReply(skipped ? "⏭️ Skipped." : "Nothing is playing right now.");
    }

    if (commandName === "volume") {
      const level = interaction.options.getInteger("level");
      const actual = setVolume(guild.id, level);
      return interaction.editReply(`🔊 Volume set to ${actual}%`);
    }

    if (commandName === "nowplaying") {
      const song = getNowPlaying(guild.id);
      if (!song) return interaction.editReply("Nothing is playing right now.");
      const embed = new EmbedBuilder()
        .setColor(0x1db954)
        .setTitle("🎵 Now Playing")
        .setDescription(`**${song.title}**`)
        .addFields({ name: "Duration", value: formatDuration(song.duration), inline: true });
      return interaction.editReply({ embeds: [embed] });
    }

    if (commandName === "queue") {
      const { current, upcoming } = getQueueState(guild.id);
      if (!current && !upcoming.length) {
        return interaction.editReply("The queue is empty.");
      }
      const embed = new EmbedBuilder().setColor(0x1db954).setTitle("🎵 Queue");
      if (current) {
        embed.addFields({
          name: "Now Playing",
          value: `**${current.title}** (${formatDuration(current.duration)})`,
        });
      }
      if (upcoming.length) {
        const list = upcoming
          .slice(0, 10)
          .map((s, i) => `${i + 1}. **${s.title}** (${formatDuration(s.duration)})`)
          .join("\n");
        embed.addFields({ name: `Up Next (${upcoming.length})`, value: list });
      }
      return interaction.editReply({ embeds: [embed] });
    }
  } catch (err) {
    console.error(`[music] command error (${commandName}):`, err.message);
    return interaction.editReply(`⚠️ ${err.message}`);
  }
}

module.exports = { registerMusicCommands, handleMusicCommand, MUSIC_COMMAND_NAMES };
