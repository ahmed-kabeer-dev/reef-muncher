"use client";
// Reef Muncher: "How to play" modal (reused on Login, Menu and the pause screen later).

import { useEffect, useRef } from "react";

export default function HowToPlayModal({ onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="how-title">How to play</h2>
        <ul>
          <li>A red tide has poisoned the reef. Only <strong>one</strong> numbered fish is safe to eat.</li>
          <li>Look at the sonar picture. <strong>Count the fish.</strong> That number is the safe tag.</li>
          <li>Swim with the <strong>arrow keys</strong> (or WASD) and eat the small fish carrying that number.</li>
          <li>Eating a poisoned fish, a bigger fish or a sea mine costs a heart. You have 3.</li>
          <li>Big fish with a green crown are edible. Red warning plates mean danger.</li>
          <li>Reach size 100 before you lose all your hearts. Press <strong>P</strong> or <strong>Esc</strong> to pause, <strong>R</strong> to rescan.</li>
        </ul>
        <button ref={closeRef} className="btn" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}