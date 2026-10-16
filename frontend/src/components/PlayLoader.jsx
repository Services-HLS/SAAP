import { useMemo } from "react";

const GIFS = ["/tennis-racket.gif", "/cricket-bat.gif"];

export default function PlayLoader({ label = "Loading SAAP…" }) {
  const src = useMemo(() => GIFS[Math.floor(Math.random() * GIFS.length)], []);

  return (
    <div className="play-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="play-orb" aria-hidden="true">
        <div className="play-ring" />
        <div className="play-ring is-delay" />
        <div className="play-icon">
          <img src={src} alt="" width={96} height={96} className="play-gif" />
        </div>
      </div>
      <p className="play-note">{label}</p>
      <div className="play-dots" aria-hidden="true"><span /><span /><span /></div>
    </div>
  );
}
