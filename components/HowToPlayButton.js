"use client";
// Reef Muncher: button that opens the How to play modal (used on the Main Menu).

import { useState } from "react";
import HowToPlayModal from "./HowToPlayModal.js";

export default function HowToPlayButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(true)}>How to play</button>
      {open && <HowToPlayModal onClose={() => setOpen(false)} />}
    </>
  );
}