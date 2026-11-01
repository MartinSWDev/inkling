import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { RoomView, assignStickers, useRoomAssets } from "./Room";
import { fetchSubjects } from "./api";
import { decodeShare } from "./share";
import { popUp } from "./design/motion";

/** Plays a shared result at /r/<code> without any game state. */
export default function ShareReplay({ code }: { code: string }) {
  const data = useMemo(() => decodeShare(code), [code]);
  const assets = useRoomAssets();
  const [names, setNames] = useState<Record<string, string>>({});
  const [shown, setShown] = useState(0);
  const [topShown, setTopShown] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    fetchSubjects().then((d) => setNames(Object.fromEntries(d.subjects.map((s) => [s.code, s.display_name])))).catch(() => null);
  }, []);
  const room = data?.r ?? [];
  useEffect(() => {
    if (!data) return;
    const timers: number[] = [];
    const n = Math.max(1, room.length);
    for (let i = 1; i <= room.length; i++)
      timers.push(window.setTimeout(() => setShown(i), 900 + (i * 3800) / n));
    for (let i = 1; i <= data.t.length; i++)
      timers.push(window.setTimeout(() => setTopShown(i), 4900 + i * 900));
    timers.push(window.setTimeout(() => setFlipped(true), 7900));
    timers.push(window.setTimeout(() => setEnded(true), 9300));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data) return (<div className="app" data-mode="intro"><section className="landing">
    <h1 className="wordmark">Inkling</h1>
    <p className="lede">That share link doesn't look right.</p>
    <a className="btn alt bigbtn" href="/">Find yours</a></section></div>);

  const assigned = assets ? assignStickers(room.slice(0, shown), assets.stickers, assets.layout, 1.25) : [];
  const nameOf = (c: string) => names[c] || c;
  return (
    <div className="app" data-mode="reveal" lang="en-GB">
      <div className="room-wrap"><RoomView assigned={assigned} viewId={data.v} viewTime={data.vt} /></div>
      {!ended && topShown > 0 && (<div className="top3wrap">
        {data.t.slice(0, topShown).map((c, i) => (
          <motion.div key={c} className="top3card" variants={popUp} custom={i} initial="hidden" animate="shown">
            <img src={`/stickers/${c}.webp`} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} /><div><h3>{nameOf(c)}</h3></div>
          </motion.div>))}
      </div>)}
      {!ended && flipped && data.w && (<div className="wildwrap">
        <motion.div className="wildcard replaywild" initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }}>
          <span className="wildface wildfront static"><b>{nameOf(data.w)}</b>
            <small>Never on a card — it scored from everything around it.</small></span>
        </motion.div></div>)}
      {ended && (<section className="landing replayend">
        <h1 className="wordmark">Inkling</h1>
        <p className="lede">What's your inkling?</p>
        <a className="btn alt bigbtn" href="/">Find yours</a>
      </section>)}
    </div>
  );
}
