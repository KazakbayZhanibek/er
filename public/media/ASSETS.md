# Onboarding videos

Website copies of the completed Kompas editorial v2 videos, integrated on 2026-10-26. All files needed for playback are included in this directory. The separate video-production projects are not part of this repository; original export filenames are recorded below for provenance.

- `kompas-bienvenida.mp4`: originally exported as `Bienvenido-a-Kompas-Editorial-v2.mp4`; 40.1 s, 1920×1080, H.264/AAC. Matching `kompas-bienvenida-poster.png` comes from the final render's poster.
- `kompas-primer-dia.mp4`: originally exported as `Tu-primer-dia-Kompas-Editorial-v2.mp4`; 44.6 s, 1920×1080, H.264/AAC. Matching `kompas-primer-dia-poster.png` comes from the final render's poster.

Posters are served as WebP copies encoded at quality 88 without changing the artwork or dimensions. PNG originals are retained.

Spanish subtitles are integrated into the frames. Complete narration transcripts are rendered as accessible HTML in `src/ContentSections.jsx`. Native players use `controls`, `playsInline` and `preload="none"`, with no autoplay. Playing either video pauses the other.
