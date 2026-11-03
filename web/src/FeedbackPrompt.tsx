import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { feedbackPayload, sendFeedback } from "./feedback";
import "./feedback.css";

type Props = {
  gameId: string;
  top: { code: string; name: string }[];
  wildcard: string | null;
  answers: unknown;
};

type State = "ask" | "thanks" | "which" | "done";

export default function FeedbackPrompt({ gameId, top, wildcard, answers }: Props) {
  const [state, setState] = useState<State>("ask");

  const topCodes = top.map((t) => t.code);

  const handleUp = () => {
    const body = feedbackPayload({
      gameId,
      kind: "vote",
      vote: "up",
      top: topCodes,
      wildcard,
      answers,
    });
    void sendFeedback(body);
    setState("thanks");
  };

  const handleDown = () => {
    const body = feedbackPayload({
      gameId,
      kind: "vote",
      vote: "down",
      top: topCodes,
      wildcard,
      answers,
    });
    void sendFeedback(body);
    setState("which");
  };

  const handleOff = (code: string) => {
    const body = feedbackPayload({
      gameId,
      kind: "off",
      offCode: code,
      top: topCodes,
      wildcard,
      answers,
    });
    void sendFeedback(body);
    setState("thanks");
  };

  if (state === "thanks") {
    return (
      <div className="feedback-card">
        <p className="feedback-thanks">Thanks, that helps tune Inkling.</p>
      </div>
    );
  }

  if (state === "which") {
    return (
      <div className="feedback-card">
        <h3 className="feedback-title">Which one felt off?</h3>
        <div className="feedback-chips">
          {top.map((t) => (
            <button key={t.code} className="feedback-chip" onClick={() => handleOff(t.code)}>
              {t.name}
            </button>
          ))}
          <button className="feedback-chip" onClick={() => handleOff("all")}>
            All of them
          </button>
        </div>
        <button className="feedback-skip" onClick={() => setState("thanks")}>
          Skip
        </button>
      </div>
    );
  }

  return (
    <div className="feedback-card">
      <h3 className="feedback-title">Does this feel like you?</h3>
      <div className="feedback-actions">
        <button className="feedback-btn" aria-label="Yes, it feels like me" onClick={handleUp}>
          <ThumbsUp size={20} strokeWidth={2} />
        </button>
        <button className="feedback-btn" aria-label="No, not really" onClick={handleDown}>
          <ThumbsDown size={20} strokeWidth={2} />
        </button>
      </div>
      <p className="feedback-note">Anonymous: sends your vote, answers and result. No names or accounts.</p>
    </div>
  );
}
