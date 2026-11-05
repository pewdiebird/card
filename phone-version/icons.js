// Icon artwork and account data for the phone card.
//
// Each icon is drawn on a 512 canvas. Color is the color of the glass and
// opacity is how dense that piece of glass is, so a thin pane lets the wallpaper
// light through while a solid glyph reads as thick, raised glass. script.js
// does the actual glass rendering; this file only says what's on each pane.

(function () {
  "use strict";

  const stops = (list) => list.map(([o, c, a = 1]) =>
    `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("");
  const vgrad = (id, list) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops(list)}</linearGradient>`;
  const pane = (id, top, bottom, op = .72) =>
    `<defs>${vgrad(id, [[0, top], [1, bottom]])}</defs><rect width="512" height="512" fill="url(#${id})" opacity="${op}"/>`;
  const glyph = (x, y, s, d, fill = "#fff", op = .96) =>
    `<path transform="translate(${x} ${y}) scale(${s})" fill="${fill}" opacity="${op}" d="${d}"/>`;

  const PATHS = {
    twitter: "M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z",
    kick: "M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z",
    rumble: "M14.4528 13.5458c.8064-.6542.9297-1.8381.2756-2.6445a1.8802 1.8802 0 0 0-.2756-.2756 21.2127 21.2127 0 0 0-4.3121-2.776c-1.066-.51-2.256.2-2.4261 1.414a23.5226 23.5226 0 0 0-.14 5.5021c.116 1.23 1.292 1.964 2.372 1.492a19.6285 19.6285 0 0 0 4.5062-2.704v-.008zm6.9322-5.4002c2.0335 2.228 2.0396 5.637.014 7.8723A26.1487 26.1487 0 0 1 8.2946 23.846c-2.6848.6713-5.4168-.914-6.1662-3.5781-1.524-5.2002-1.3-11.0803.17-16.3045.772-2.744 3.3521-4.4661 6.0102-3.832 4.9242 1.174 9.5443 4.196 13.0764 8.0121v.002z",
    github: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
    bluesky: "M5.202 2.857C7.954 4.922 10.913 9.11 12 11.358c1.087-2.247 4.046-6.436 6.798-8.501C20.783 1.366 24 .213 24 3.883c0 .732-.42 6.156-.667 7.037-.856 3.061-3.978 3.842-6.755 3.37 4.854.826 6.089 3.562 3.422 6.299-5.065 5.196-7.28-1.304-7.847-2.97-.104-.305-.152-.448-.153-.327 0-.121-.05.022-.153.327-.568 1.666-2.782 8.166-7.847 2.97-2.667-2.737-1.432-5.473 3.422-6.3-2.777.473-5.899-.308-6.755-3.369C.42 10.04 0 4.615 0 3.883c0-3.67 3.217-2.517 5.202-1.026",
    tumblr: "M14.563 24c-5.093 0-7.031-3.756-7.031-6.411V9.747H5.116V6.648c3.63-1.313 4.512-4.596 4.71-6.469C9.84.051 9.941 0 9.999 0h3.517v6.114h4.801v3.633h-4.82v7.47c.016 1.001.375 2.371 2.207 2.371h.09c.631-.02 1.486-.205 1.936-.419l1.156 3.425c-.436.636-2.4 1.374-4.156 1.404h-.178l.011.002z",
    deviantart: "M19.207 4.794l.23-.43V0H15.07l-.436.44-2.058 3.925-.646.436H4.58v5.993h4.04l.36.436-4.175 7.98-.24.43V24H8.93l.436-.44 2.07-3.925.644-.436h7.35v-5.993h-4.05l-.36-.438 4.186-7.977z",
    tiktok: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
    askfm: "M12 24c-2.172 0-4.195-.547-6.07-1.64a12.003 12.003 0 01-4.29-4.29A11.842 11.842 0 010 12c0-2.172.547-4.195 1.64-6.07a12.003 12.003 0 014.29-4.29A11.842 11.842 0 0112 0c2.172 0 4.195.547 6.07 1.64a12.003 12.003 0 014.29 4.29A11.842 11.842 0 0124 12c0 2.172-.547 4.195-1.64 6.07a12.003 12.003 0 01-4.29 4.29A11.842 11.842 0 0112 24zm2.133-14.227c-.39.282-.664.688-.82 1.22-.157.53-.188 1.109-.094 1.734s.312 1.222.656 1.793c.344.57.754 1.027 1.23 1.37.477.344.961.54 1.454.587.492.046.933-.07 1.324-.352.39-.281.664-.688.82-1.219.156-.531.188-1.11.094-1.734a4.839 4.839 0 00-.656-1.793 4.564 4.564 0 00-1.23-1.371c-.477-.344-.962-.54-1.454-.586a1.887 1.887 0 00-1.324.351zm2.484 5.18c-.469.188-.937.152-1.406-.105-.469-.258-.813-.66-1.031-1.207a3.082 3.082 0 01-.164-.797h.023c.063 0 .14-.016.234-.047h-.023c.188-.063.316-.211.387-.445a.92.92 0 00-.012-.633.842.842 0 00-.164-.305v.024c.187-.235.406-.399.656-.493.469-.203.938-.175 1.406.082.47.258.809.668 1.02 1.23.21.563.227 1.106.047 1.63-.18.523-.504.879-.973 1.066zm-3.586.235a.825.825 0 00-.515-.106.768.768 0 00-.47.27l-.187.234a.348.348 0 00-.093.258c0 .062.015.125.046.187.391.735.711 1.242.961 1.524a.124.124 0 00.13.058.18.18 0 00.128-.082c.094-.234.219-.734.375-1.5l.047-.258v-.07a.38.38 0 00-.164-.328zm-4.804-4.641c-.47.062-.891.289-1.266.68-.375.39-.664.882-.867 1.476a5.391 5.391 0 00-.282 1.887c.016.664.149 1.262.399 1.793.25.531.574.93.973 1.195.398.266.832.367 1.3.305.47-.063.891-.285 1.266-.668.375-.383.664-.871.867-1.465a5.391 5.391 0 00.281-1.887c-.015-.664-.148-1.261-.398-1.793-.25-.53-.574-.933-.973-1.207a1.806 1.806 0 00-1.3-.316zm1.828 3.633c.03.593-.102 1.113-.399 1.558-.297.446-.68.692-1.148.739-.469.046-.883-.118-1.242-.493-.36-.375-.563-.851-.61-1.43v-.187c0-.219.024-.43.07-.633v.024a.822.822 0 00.235.023.703.703 0 00.469-.316.81.81 0 00.14-.598.725.725 0 00-.07-.328c.203-.156.445-.258.727-.305.468-.047.882.121 1.242.504s.554.864.586 1.442zM5.602 7.547a1.17 1.17 0 00-.329-.305c-.156-.094-.304-.125-.445-.094a.489.489 0 00-.328.258.961.961 0 00-.117.375l-.281 2.766.304-.516c.25-.39.516-.726.797-1.008.406-.406.797-.671 1.172-.796a1.54 1.54 0 01-.445-.329c-.12-.104-.227-.243-.328-.351zM17.25 5.016a.55.55 0 00-.48-.141c-.18.031-.34.164-.48.398-.08.157-.142.32-.188.493-.027.058-.032.125-.047.187l-.024.07c-.11.25-.21.43-.304.54.453.015.89.101 1.312.257a4.83 4.83 0 011.594.961l.21.211-1.265-2.578a.925.925 0 00-.328-.398Z"
  };

  const ART = {
    // Traced from the real icon: brown rim, cream cabinet, bulging green-gray
    // tube with its own gloss line, two knobs and the speaker slots.
    youtube(p) {
      const speaker = [18, 28, 38, 50, 38, 28, 18].map((h, i) =>
        `<rect x="${203 + i * 17.5}" y="${437 - h / 2}" width="6.5" height="${h}" rx="3" fill="#1a120b"/>`).join("");
      const knob = (x) => `
        <circle cx="${x}" cy="424" r="34" fill="#241a13" opacity=".96"/>
        <circle cx="${x}" cy="424" r="25" fill="none" stroke="#b08a5c" stroke-width="8" stroke-dasharray="3 3.6" opacity=".95"/>
        <circle cx="${x}" cy="424" r="16" fill="url(#${p}k)"/>`;
      return `<defs>
        ${vgrad(p + "r", [[0, "#8a5a31"], [1, "#5b3619"]])}
        ${vgrad(p + "c", [[0, "#e2c27f"], [.55, "#f2dca6"], [1, "#fff4d6"]])}
        ${vgrad(p + "s", [[0, "#b9c0b9"], [.46, "#8e9a8e"], [.47, "#4c5c48"], [1, "#7f966c"]])}
        ${vgrad(p + "k", [[0, "#f4f4f4"], [1, "#868686"]])}
      </defs>
      <rect width="512" height="512" fill="url(#${p}r)" opacity=".98"/>
      <rect x="36" y="36" width="440" height="440" rx="56" fill="url(#${p}c)" opacity=".88"/>
      <path d="M256 58C388 58 442 76 442 226S388 394 256 394 70 376 70 226 124 58 256 58Z" fill="url(#${p}s)" stroke="#463825" stroke-width="6" opacity=".93"/>
      <path d="M73 202C74 100 128 63 256 63s182 37 183 139c-54 16-116 24-183 24s-129-8-183-24Z" fill="#fff" opacity=".2"/>
      ${knob(108)}${knob(404)}${speaker}`;
    },

    // Traced from the real icon: leather cover, torn paper line, ruled yellow
    // legal pad with the red double margin.
    notes(p) {
      let seed = 7, grain = "";
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 90; i++) {
        const x = rnd() * 512, y = rnd() * 138, a = rnd() * 16 - 8, b = rnd() * 16 - 8;
        grain += `M${x.toFixed(0)} ${y.toFixed(0)}q${a.toFixed(0)} ${b.toFixed(0)} ${(a * 1.7).toFixed(0)} ${(b * .4).toFixed(0)}`;
      }
      let rules = "";
      for (let y = 222; y < 512; y += 49) rules += `<rect y="${y}" width="512" height="3" fill="#6f9cb2" opacity=".62"/>`;
      return `<defs>
        ${vgrad(p + "l", [[0, "#6c4a3a"], [1, "#3f281e"]])}
        ${vgrad(p + "y", [[0, "#f8ee9c"], [1, "#efe07a"]])}
      </defs>
      <rect y="150" width="512" height="362" fill="url(#${p}y)" opacity=".8"/>
      ${rules}
      <rect x="71" y="150" width="3" height="362" fill="#c9553c" opacity=".85"/>
      <rect x="93" y="150" width="3" height="362" fill="#c9553c" opacity=".85"/>
      <path d="M0 146H512V150L470 154 410 149 356 156 300 151 235 160 170 156 120 165 74 170 30 168 0 172Z" fill="#d8dbaa" opacity=".95"/>
      <rect width="512" height="148" fill="url(#${p}l)" opacity=".94"/>
      <path d="${grain}" fill="none" stroke="#1d110b" stroke-width="2" opacity=".55"/>
      <rect y="145" width="512" height="5" fill="#1d110b" opacity=".65"/>`;
    },

    // Traced from the real icon: brown top plate with the rainbow stripe and
    // name label, viewfinder at the right, cream body, big teal lens.
    instagram(p) {
      const rainbow = [["#e8364f", 36], ["#f4cc35", 64], ["#55ad50", 88], ["#5b93dd", 112]].map(([c, x], i) =>
        `<rect x="${x}" y="0" width="${i ? 24 : 28}" height="146" fill="${c}" opacity=".97"/>`).join("");
      return `<defs>
        ${vgrad(p + "t", [[0, "#b07f5c"], [1, "#84532f"]])}
        ${vgrad(p + "b", [[0, "#f6f0e4"], [.6, "#ebe2d0"], [1, "#d3c6ae"]])}
        ${vgrad(p + "r", [[0, "#fffdf8"], [1, "#c9bda6"]])}
        <radialGradient id="${p}s">${stops([[.72, "#3a2a18", .55], [1, "#3a2a18", 0]])}</radialGradient>
        <radialGradient id="${p}g" cx=".5" cy=".24" r=".86">${stops([[0, "#8fd2e2"], [.2, "#357f96"], [.42, "#0d2a33"], [.74, "#070f13"], [.92, "#1d5a6c"], [1, "#2d7f95"]])}</radialGradient>
        <radialGradient id="${p}c">${stops([[0, "#8a58a8"], [.45, "#3d2352"], [1, "#3d2352", 0]])}</radialGradient>
        <radialGradient id="${p}v" cx=".5" cy=".5" r=".6">${stops([[0, "#6b4a86"], [.28, "#274650"], [.72, "#3f7484"], [1, "#16262c"]])}</radialGradient>
      </defs>
      <rect y="150" width="512" height="362" fill="url(#${p}b)" opacity=".9"/>
      <rect width="512" height="152" fill="url(#${p}t)" opacity=".92"/>
      ${rainbow}
      <rect y="149" width="512" height="7" fill="#5c3518" opacity=".85"/>
      <rect x="31" y="146" width="108" height="44" rx="11" fill="#efe7d7" stroke="#5b5146" stroke-width="5" opacity=".97"/>
      <rect x="50" y="161" width="70" height="13" rx="6" fill="#5b5146" opacity=".82"/>
      <rect x="367" y="31" width="108" height="106" rx="22" fill="#1c262a" opacity=".97"/>
      <rect x="380" y="44" width="82" height="80" rx="15" fill="url(#${p}v)"/>
      <circle cx="256" cy="262" r="150" fill="url(#${p}s)"/>
      <circle cx="256" cy="250" r="130" fill="url(#${p}r)"/>
      <circle cx="256" cy="250" r="116" fill="#06090b" opacity=".98"/>
      <circle cx="256" cy="250" r="106" fill="url(#${p}g)"/>
      <circle cx="256" cy="250" r="52" fill="url(#${p}c)"/>
      <circle cx="303" cy="214" r="9" fill="#fff" opacity=".82"/>
      <circle cx="318" cy="229" r="5" fill="#fff" opacity=".6"/>`;
    },

    twitter: (p) => pane(p + "a", "#a9e8ff", "#27a6e8") + glyph(64, 62, 16, PATHS.twitter),

    // White f running off the bottom edge, like the old app icon.
    facebook: (p) => pane(p + "a", "#6f8cc6", "#2f4a87", .82) +
      `<rect y="446" width="512" height="66" fill="#8fa8d8" opacity=".6"/>
       <path fill="#fff" opacity=".97" d="M336 512V306h70l11-84h-81v-54c0-24 7-41 42-41h45V52c-8-1-34-3-65-3-65 0-110 40-110 113v60h-74v84h74v206z"/>`,

    // The real 2012 logo: a square-cut frame with the two eyes, screen left as
    // darker glass so it reads as a raised frame.
    twitch: (p) => pane(p + "a", "#9872de", "#4c2d92", .86) +
      `<g transform="translate(105 84) scale(2.7)">
         <g transform="matrix(1.3333 0 0 -1.3333 101.3933 67.5893)">
           <path fill="#22104f" opacity=".58" d="m0 0-13.652-13.651h-21.445l-11.699-11.697v11.697H-64.344V42.893H0Z"/>
           <path fill="#fff" opacity=".97" fill-rule="evenodd" d="m0 0-13.652-13.651h-21.445l-11.699-11.697v11.697H-64.344V42.893H0Zm-72.146 50.692-3.899-15.599v-70.19h17.55v-9.751h9.746l9.752 9.751h15.596L7.795-3.905v54.597z"/>
         </g>
         <path fill="#fff" opacity=".97" d="M44.197 62.394h10.399V31.193H44.197zm28.595 0h10.399V31.193H72.792z"/>
       </g>`,

    kick: (p) => `<defs>${vgrad(p + "g", [[0, "#9dff6e"], [1, "#27c607"]])}</defs>` +
      pane(p + "a", "#27331f", "#090d07", .84) + glyph(88, 88, 14, PATHS.kick, `url(#${p}g)`),

    rumble: (p) => pane(p + "a", "#b4e578", "#559a23", .78) + glyph(84, 74, 15, PATHS.rumble),

    soundcloud: (p) => {
      const bars = [[70, 62], [100, 92], [130, 112], [160, 134], [190, 146]].map(([x, h]) =>
        `<rect x="${x}" y="${338 - h}" width="14" height="${h}" rx="7" fill="#fff" opacity=".95"/>`).join("");
      return pane(p + "a", "#ffb247", "#fb4e00", .8) + bars +
        `<path fill="#fff" opacity=".97" d="M220 338V192c14-8 32-12 50-12 58 0 106 44 112 100 7-3 14-4 22-4 33 0 60 28 60 62 0 0-244 0-244 0Z"/>`;
    },

    github: (p) => pane(p + "a", "#f5f7f9", "#a4adb6", .78) + glyph(76, 74, 15, PATHS.github, "#191c20", .95),

    bluesky: (p) => pane(p + "a", "#79c8ff", "#0b6ee8") + glyph(76, 78, 15, PATHS.bluesky),

    // Old reddit's pale blue header with the original alien.
    reddit: (p) => `${pane(p + "a", "#eaf3fc", "#b3d1ef", .74)}
      <g stroke="#111" stroke-width="12" stroke-linejoin="round">
        <path d="M256 196l24-96 76 18" fill="none" stroke-linecap="round"/>
        <circle cx="378" cy="122" r="28" fill="#fff"/>
        <circle cx="106" cy="262" r="36" fill="#fff"/>
        <circle cx="406" cy="262" r="36" fill="#fff"/>
        <ellipse cx="256" cy="304" rx="158" ry="112" fill="#fff"/>
      </g>
      <circle cx="198" cy="282" r="30" fill="#ff4500"/>
      <circle cx="314" cy="282" r="30" fill="#ff4500"/>
      <path d="M186 346c42 32 98 32 140 0" fill="none" stroke="#111" stroke-width="12" stroke-linecap="round"/>`,

    tumblr: (p) => pane(p + "a", "#4f7196", "#1f3045", .84) + glyph(52, 56, 17, PATHS.tumblr),

    deviantart: (p) => pane(p + "a", "#657f6d", "#26352c", .84) + glyph(52, 52, 17, PATHS.deviantart, "#2fe36b"),

    younow: (p) => pane(p + "a", "#4df0b4", "#059a62") +
      `<rect x="82" y="168" width="238" height="176" rx="40" fill="#fff" opacity=".96"/>
       <path fill="#fff" opacity=".96" d="M340 234l78-52c14-9 26-2 26 14v120c0 16-12 23-26 14l-78-52z"/>`,

    // White pane so the two dots read like the real one.
    flickr: (p) => pane(p + "a", "#ffffff", "#cdd3da", .82) +
      `<circle cx="160" cy="256" r="94" fill="#0063dc"/><circle cx="352" cy="256" r="94" fill="#ff0084"/>`,

    // Traced from the real icon: the "g" runs off the left and bottom, the plus off the right.
    gplus: (p) => pane(p + "a", "#e8482a", "#b82709", .9) +
      `<path fill="#fff" opacity=".97" fill-rule="evenodd" d="M104.5 42.5L91.3 43.9L72.5 47.6L53.6 53.1L31.1 62.7L17.9 70.3L4.7 79.7L-2.8 79.7L-3.4 80.3L-3.7 280.6L-2.8 281.9L4.7 281.9L12.2 286.9L27.3 294.3L38.6 298.2L46.1 300.1L55.5 302.0L70.6 303.5L85.6 303.5L100.7 302.4L101.5 303.2L96.7 314.6L94.5 325.9L94.7 335.4L96.6 346.7L102.0 359.9L106.4 367.2L116.0 380.7L113.9 381.7L83.8 383.9L55.5 387.8L29.2 393.3L4.7 401.0L-2.8 401.0L-3.7 403.4L-3.5 439.3L-2.8 440.1L4.7 440.1L16.0 430.5L23.5 425.4L31.1 421.3L48.0 414.1L61.2 410.3L80.0 406.5L112.0 402.9L130.8 402.4L142.1 403.1L191.1 437.1L208.0 450.2L222.4 463.8L230.6 474.4L235.2 482.7L238.5 494.1L239.2 499.7L239.1 514.8L240.0 515.6L241.9 515.6L281.4 515.7L283.8 514.8L284.1 505.4L287.6 492.2L289.4 480.8L289.5 467.6L287.4 454.4L285.3 446.8L281.5 437.4L276.1 427.9L268.2 417.3L256.9 405.0L244.5 393.9L180.6 342.9L173.7 335.4L171.4 331.6L167.9 322.1L167.4 316.5L167.9 307.0L169.7 301.3L173.5 293.8L177.8 288.1L187.3 278.1L206.1 262.5L218.6 250.3L230.8 235.2L236.6 225.8L242.6 212.5L246.5 199.3L248.3 189.9L249.6 176.6L249.6 165.3L248.4 152.1L244.3 133.2L240.7 123.7L233.1 108.6L225.5 97.3L215.9 86.0L197.7 69.0L200.5 68.2L243.8 68.0L289.3 42.5L287.1 41.4L285.2 41.3L121.4 41.3ZM381.2 41.8L380.6 42.5L380.7 133.2L379.3 134.3L290.8 134.2L289.7 135.1L289.6 137.0L289.6 172.9L290.8 174.1L379.3 174.0L380.4 174.8L380.7 176.6L380.6 263.6L381.2 265.4L383.1 266.1L418.8 266.1L420.1 265.4L420.7 262.7L420.5 176.6L421.2 174.8L422.6 174.0L514.8 174.1L515.7 172.9L515.6 135.1L514.8 134.2L422.6 134.3L420.7 133.2L420.7 42.5L418.8 41.3ZM79.2 67.1L83.8 66.4L95.1 66.5L106.4 68.5L112.0 70.6L119.5 73.9L128.9 79.8L140.5 89.7L150.1 101.1L154.1 106.7L165.5 127.5L171.1 140.8L174.8 152.1L180.4 174.8L182.3 188.0L182.9 197.4L182.6 218.2L180.3 231.4L176.2 242.8L173.2 248.4L169.4 254.1L164.5 259.8L157.2 266.1L151.5 269.9L140.2 275.5L134.6 277.5L128.9 279.2L121.4 280.3L117.6 281.0L108.2 281.0L96.9 279.2L91.3 277.5L78.1 271.5L70.6 266.4L61.2 258.3L52.7 248.4L47.2 240.9L37.6 223.9L30.5 206.9L26.9 195.5L23.1 180.4L20.9 167.2L19.3 144.5L21.2 125.6L23.3 116.2L28.4 103.0L35.8 91.6L40.9 86.0L48.0 79.9L53.6 76.1L61.2 72.2L72.5 68.3Z"/>`,

    askfm: (p) => pane(p + "a", "#f15c77", "#ad1b38", .82) + glyph(76, 76, 15, PATHS.askfm),

    tiktok: (p) => pane(p + "a", "#34343a", "#040405", .86) +
      glyph(84, 72, 15, PATHS.tiktok, "#25f4ee", .95) + glyph(100, 88, 15, PATHS.tiktok, "#fe2c55", .95) +
      glyph(92, 80, 15, PATHS.tiktok, "#fff", 1),

    truth: (p) => pane(p + "a", "#7a6ff8", "#3226c0", .84) +
      `<g transform="scale(21.33)">
         <path fill="#fff" opacity=".97" d="M4 6.5h2.75v2.25H4zM8 6.5h9.5v2.25h-3.4V17.5h-2.5V8.75H8z"/>
         <rect x="16" y="14.5" width="3.25" height="3" fill="#3cdbb4"/>
       </g>`,

    globe: (p) => pane(p + "a", "#8fd0ff", "#1560c4", .78) +
      `<g fill="none" stroke="#fff" stroke-width="20" opacity=".96">
         <circle cx="256" cy="256" r="162"/>
         <ellipse cx="256" cy="256" rx="72" ry="162"/>
         <path d="M94 256H418M118 174H394M118 338H394"/>
       </g>`
  };

  // Linen folder with the silver rim, showing tiny versions of what's inside.
  const folder = (contents) => (p) => {
    const cells = contents.map((name, i) => {
      const s = 112, x = 70 + (i % 3) * 130, y = 70 + Math.floor(i / 3) * 130, id = `${p}m${i}`;
      return `<clipPath id="${id}c"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="26"/></clipPath>
        <g clip-path="url(#${id}c)"><svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 512 512">${ART[name](id)}</svg></g>`;
    }).join("");
    return `<defs>
        ${vgrad(p + "r", [[0, "#eef0f2"], [1, "#868a8f"]])}
        ${vgrad(p + "n", [[0, "#2c3342"], [1, "#1c212c"]])}
        <pattern id="${p}w" width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M0 1H7M0 4.500H7" stroke="#fff" stroke-width="1.100" opacity=".09"/>
          <path d="M1 0V7M4.500 0V7" stroke="#000" stroke-width="1.100" opacity=".32"/>
        </pattern>
      </defs>
      <rect width="512" height="512" fill="url(#${p}r)" opacity=".86"/>
      <rect x="28" y="28" width="456" height="456" rx="64" fill="url(#${p}n)" opacity=".86"/>
      <rect x="28" y="28" width="456" height="456" rx="64" fill="url(#${p}w)"/>
      ${cells}`;
  };

  ART.folderAlts = folder(["youtube", "twitter", "bluesky", "twitch", "github", "reddit"]);
  ART.folderDomains = folder(["globe", "globe", "globe", "globe", "globe", "globe", "globe", "globe", "globe"]);

  const svgFor = (name) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${ART[name]("i")}</svg>`;
  const uriCache = {};
  const artUri = (name) =>
    uriCache[name] || (uriCache[name] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgFor(name)));

  const yt = (handle, label) => ({ art: "youtube", label, url: `https://www.youtube.com/@${handle}` });
  const tw = (handle) => ({ art: "twitter", label: handle, url: `https://twitter.com/${handle}` });
  // Handles too long for one line that have no natural place to wrap.
  const WRAPS = {
    "womenlovethisguy.com": "womenlove​thisguy.com",
    "thecompanycompanyco.co": "thecompany​companyco.co",
    thecompanycompany: "thecompany​company"
  };
  const dom = (name) => ({ art: "globe", label: name, url: `https://${name}`, wrap: WRAPS[name] });

  window.PHONE_DATA = {
    artUri,
    artNames: Object.keys(ART),
    pages: [
      {
        title: "Active Profiles",
        items: [
          { art: "youtube", label: "Randy Lent", url: "https://www.youtube.com/user/randyviewer" },
          { art: "twitter", label: "@QwertysAdvocate", url: "https://twitter.com/QwertysAdvocate" },
          { art: "instagram", label: "@instantlent", url: "https://instagram.com/instantlent" },
          { art: "facebook", label: "Randy Lenk", url: "https://facebook.com/randy.lenk.7" },
          { art: "twitch", label: "TheCoolGuyMaxTwitch", url: "https://twitch.tv/thecoolguymaxtwitch/profile" },
          { art: "kick", label: "pewdiebird", url: "https://kick.com/pewdiebird" },
          { art: "rumble", label: "pewdiebird", url: "https://rumble.com/user/pewdiebird" },
          { art: "soundcloud", label: "TheFaithfullGamers", url: "https://soundcloud.com/thefaithfullgamers" },
          { art: "github", label: "pewdiebird", url: "https://github.com/pewdiebird" },
          { art: "bluesky", label: "@pewdiebird.bsky.social", url: "https://bsky.app/profile/pewdiebird.bsky.social" },
          { art: "reddit", label: "u/pewdiebird", url: "https://www.reddit.com/user/pewdiebird/" },
          { art: "notes", label: "About Me", action: "notes" }
        ]
      },
      {
        title: "Legacy & Reserved",
        items: [
          { art: "tumblr", label: "tumblerlent", url: "https://www.tumblr.com/tumblerlent" },
          { art: "deviantart", label: "randtartlent", url: "https://randtartlent.deviantart.com" },
          { art: "younow", label: "TheFaithfullGamers", url: "https://younow.com/TheFaithfullGamers" },
          { art: "flickr", label: "Flickr Lent", url: "https://flickr.com/photos/148410777@N08" },
          { art: "gplus", label: "Randy Lent", url: "https://plus.google.com/u/0/103695807154772767579" },
          { art: "askfm", label: "AskLent2 (Defunct)", url: "https://ask.fm/AskLent2" },
          { art: "twitch", label: "coolguymax (Defunct)", url: "https://www.twitch.tv/coolguymax" },
          { art: "tiktok", label: "musiclent", url: "https://www.tiktok.com/@musiclent" },
          // Truth Social always stays last.
          { art: "truth", label: "@RandyJoeCent (banned lol)", url: "https://truthsocial.com/@RandyJoeCent" }
        ]
      },
      {
        title: "Everything Else",
        items: [
          { art: "folderAlts", label: "Alts & Misc", action: "folder", folder: "alts" },
          { art: "folderDomains", label: "Domains", action: "folder", folder: "domains" }
        ]
      }
    ],
    folders: {
      alts: {
        title: "Alts & Misc",
        note: "It's a long list!",
        groups: [
          {
            title: "YouTube",
            items: [
              yt("randyviewerLIVE", "Live Lent"), yt("TheFaithfullGamers", "TheFaithfullGamers"),
              yt("FaithfullStudios", "FaithfullStudios"), yt("IsaiahEspinoza", "Isaiah Espinoza"),
              yt("Memealicious", "Memealicious"), yt("Memealicious.", "Memealicious Archives"),
              yt("LegoLent", "LegoLent"), yt("EverythingGooglePro", "EverythingGooglePro"),
              yt("3dumbstooges140", "3 dumbstooges"), yt("thecourthouseramblers5291", "The Courthouse Ramblers"),
              yt("PewDieBird", "PewDieBird"), yt("Internet.Explorer", "Internet Explorer"),
              yt("Sprite14", "Sprite14"), yt("LD-hu7wx", "LD2020"),
              yt("TheRatterreesMC", "TheRatterreesMC"), yt("AcerClass", "AcerClass"),
              yt("therattatatatatataterrees6005", "TheRattatatata..."), yt("corpselent9363", "Corpse Lent"),
              yt("SKRILET", "SKRILET"), yt("user-cl5dg9dt1r", "user-cl5dg9dt1r"),
              yt("TheGemmyGroup", "TheGemmyGroup"), yt("KIONNewsChannel46", "KION NewsChannel 46"),
              yt("omqxcookies", "omqxcookies"), yt("8bitminecrafters92", "8Bit Minecrafters"),
              yt("Sythrickdotpng", "Sythrickdotpng")
            ]
          },
          {
            title: "Twitter",
            items: [tw("realPewDieBird"), tw("randydanklent"), tw("FaithfullStudio"), tw("RodeBasedNews"), tw("AnscoAutoTwt"), tw("BlinkyGPT")]
          },
          {
            title: "Bluesky",
            items: [{ art: "bluesky", label: "BlinkyGPT", url: "https://bsky.app/profile/blinkygpt.bsky.social" }]
          },
          {
            title: "Twitch",
            items: [{ art: "twitch", label: "pewdiebird", url: "https://www.twitch.tv/pewdiebird" }]
          },
          {
            title: "GitHub",
            items: [
              { art: "github", label: "BlinkyGPT", url: "https://github.com/BlinkyGPT" },
              { art: "github", label: "Faithfull Studios", url: "https://github.com/FaithfullStudios" },
              { art: "github", label: "Blinky Ink", url: "https://github.com/Blinky-AI" },
              { art: "github", label: "thecompanycompany", wrap: WRAPS.thecompanycompany, url: "https://github.com/thecompanycompany" },
              { art: "github", label: "Tinted Software", url: "https://github.com/tinted-software" }
            ]
          },
          {
            title: "Reddit",
            items: [{ art: "reddit", label: "u/FaithfullStudios", url: "https://www.reddit.com/user/FaithfullStudios/" }]
          }
        ]
      },
      domains: {
        title: "Domains",
        note: "also a long list!",
        groups: [{
          items: [
            "faithfullstudios.com", "faithfullstudios.net", "faithfullstudios.org", "faithfullstudios.store",
            "faithfullstudios.shop", "faithfullstudios.info", "faithfullstudios.life", "faithfullstudios.ai",
            "faithfullstudios.co", "faithfullstudios.xyz", "faithfullrecords.com", "faithfullrecords.net",
            "faithfullrecords.xyz", "faithfullrecords.info", "faithfullrecords.store", "pewdiebird.com",
            "pewdiebird.io", "faithfullrecords.music", "randylent.yt", "randyviewer.yt", "randylent.com",
            "randylent.net", "randyviewer.com", "randyplush.com", "randyviewer.tv", "faithfull.studio",
            "faithfullstudios.jp", "tinted.dev", "tintedos.com", "womenlovethisguy.com", "twiffer.net",
            "thecompanycompanyco.co", "cookiexrandy.com"
          ].map(dom)
        }]
      }
    }
  };
})();
