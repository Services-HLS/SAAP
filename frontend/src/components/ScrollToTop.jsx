import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function resetScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  const root = document.getElementById("root");
  if (root) root.scrollTop = 0;

  const content = document.getElementById("content");
  if (content) content.scrollTop = 0;

  document.querySelectorAll(".saap-desk-body, .saap-desk-main, .pbi-canvas").forEach((node) => {
    node.scrollTop = 0;
    node.scrollLeft = 0;
  });
}

export default function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    resetScroll();
    const id = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(id);
  }, [pathname, search]);

  return null;
}
