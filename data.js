/*
  All content lives here. Edit this file, commit, and the site updates.

  Each category should have 3 or 6 cards (one or two rows of three).

  Card types
  ----------
  repo     { type, repo: "owner/name", note?, image? }        live stars, language, last push from the GitHub API
  link     { type, title, url, text?, source?, image?, alt? } any post, artwork, article, activity
  embed    { type, title, provider, src, text?, ratio? }      iframe, only loaded after a click
  lichess  { type, username, perfs?: ["rapid","blitz","puzzle"] }  live ratings from the Lichess API
  lichess-history { type, username, perfs?: ["Rapid","Blitz"], months?: 12 }  rating chart, up to 3 lines
  lichess-game    { type, username }                             your latest finished game, board loads on click
  note     { type, title, text?, items?: [] }                  plain text card
*/
window.SITE = {
  owner: {
    name: "Steven Taing",
    tagline:
      "I write software, read and tinker around AI safety, draw, play music, do sports and have recently rekindled by interest for chess.",
    links: [
      { label: "GitHub", url: "https://github.com/stetai" },
      { label: "Lichess", url: "https://lichess.org/@/stetai" },
      { label: "Email", url: "mailto:taing@web.de" }
    ]
  },

  categories: [
    {
      id: "coding",
      title: "Coding",
      glyph: "</>",
      accent: "#0f766e",
      intro: "Projects I maintain, experiments I learned from, and the tools I reach for.",
      cards: [
        { type: "repo", repo: "stetai/stedule" },
        { type: "repo", repo: "octocat/Spoon-Knife" },
        { type: "repo", repo: "github/gitignore", note: "Replace these three with your own repositories." },
        { type: "link", title: "Write-up of a side project", url: "https://example.com", text: "What I built, what broke, what I would do differently.", source: "Blog" },
        { type: "note", title: "Toolbox", items: ["Python and TypeScript", "Neovim", "Docker", "GitHub Actions"] },
        { type: "link", title: "A useful gist", url: "https://gist.github.com", text: "Small snippets worth sharing.", source: "GitHub Gist" }
      ]
    },
    {
      id: "ai-safety",
      title: "AI Safety",
      glyph: "\u2696\uFE0E",
      accent: "#4338ca",
      intro: "Notes, reading and small experiments on making AI systems reliable and aligned.",
      cards: [
        { type: "link", title: "Reading notes", url: "https://example.com", text: "Summaries of papers and posts I have worked through.", source: "Blog" },
        { type: "note", title: "Questions I keep coming back to", items: ["How do we evaluate what a model can do?", "What makes oversight scale?", "How do we read a model's internals?"] },
        { type: "link", title: "Small interpretability experiment", url: "https://example.com", text: "Notebook and results.", source: "GitHub" }
      ]
    },
    {
      id: "arts",
      title: "Arts",
      glyph: "\u270E\uFE0E",
      accent: "#be185d",
      intro: "Sketches, prints and paintings. Add an image path to show the piece itself.",
      cards: [
        // artworks
        { type: "link", title: "Sketchbook, spring", url: "https://example.com", text: "Pencil and ink studies.", source: "Instagram" },
        { type: "link", title: "Linocut print", url: "https://example.com", text: "Two-colour reduction print.", source: "Instagram" },
        { type: "link", title: "Watercolour landscape", url: "https://example.com", text: "Plein air, one hour.", source: "Instagram" },
        // OCs
        { type: "link", title: "Figure drawing", url: "https://example.com", text: "Five-minute poses.", source: "Mastodon" },
        { type: "link", title: "Digital painting", url: "https://example.com", text: "Colour study.", source: "Bluesky" },
        { type: "link", title: "Gallery", url: "https://example.com", text: "Everything in one place.", source: "Portfolio" }
        // with an image: { type: "link", ..., image: "assets/img/linocut.jpg", alt: "Two-colour linocut of a heron" }
      ]
    },
    {
      id: "sports",
      title: "Sports",
      glyph: "\u2691\uFE0E",
      accent: "#c2410c",
      intro: "Training, races and the club I play for.",
      cards: [
        { type: "link", title: "Half marathon", url: "https://example.com", text: "Race report and splits.", source: "Strava" },
        { type: "note", title: "This season", items: ["Three runs a week", "Climbing on Sundays", "Goal: a sub-50 10k"] },
        { type: "link", title: "My club", url: "https://example.com", text: "Where I train.", source: "Club website" }
      ]
    },
    {
      id: "music",
      title: "Music",
      glyph: "\u266A\uFE0E",
      accent: "#7c3aed",
      intro: "What I play and what I listen to.",
      cards: [
        { type: "embed", title: "A recording of mine", provider: "YouTube", src: "https://www.youtube-nocookie.com/embed/VIDEO_ID", text: "Replace VIDEO_ID with your video." },
        { type: "embed", title: "On repeat", provider: "Spotify", src: "https://open.spotify.com/embed/playlist/PLAYLIST_ID", text: "Replace PLAYLIST_ID with your playlist." },
        { type: "note", title: "Practising", items: ["Scales in all keys", "A Bach invention", "Sight-reading, 10 minutes a day"] }
      ]
    },
    {
      id: "chess",
      title: "Chess",
      glyph: "\u265E\uFE0E",
      accent: "#4d7c0f",
      intro: "Ratings and my most recent game",
      cards: [
        { type: "lichess", username: "stetai", perfs: ["blitz", "classical", "puzzle"] },
        { type: "lichess-game", username: "stetai" },
        { type: "lichess-history", username: "stetai", perfs: ["Blitz", "Classical", "Puzzle"], months: 12 }
      ]
    }
  ]
};

