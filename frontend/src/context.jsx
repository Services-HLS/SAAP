import { createContext, useContext, useEffect, useState } from "react";
import * as platform from "./lib/platform";

const Ctx = createContext(null);

export function PlatformProvider({ children }) {
  const [state, setState] = useState(null);
  const [lang, setLang] = useState(() => localStorage.getItem("saap-lang") || "en");

  useEffect(() => {
    let unsub = () => {};
    platform.initPlatform().then((s) => {
      setState({ ...s });
      unsub = platform.subscribe((next) => setState({ ...next }));
    });
    return () => unsub();
  }, []);

  function setLanguage(next) {
    localStorage.setItem("saap-lang", next);
    setLang(next);
  }

  const user = state?.users.find((u) => u.id === state.session) || null;

  const value = {
    ready: Boolean(state),
    state,
    user,
    lang,
    setLanguage,
    can: (action) => (user ? platform.can(user.role, action) : false),
    login: platform.login,
    logout: platform.logout,
    submitApplication: platform.submitApplication,
    decideApplication: platform.decideApplication,
    sendWhatsApp: platform.sendWhatsApp,
    anchorNote: platform.anchorNote,
    verifyChain: platform.verifyChain,
    findCertificate: platform.findCertificate,
    verifyCertificateRecord: platform.verifyCertificateRecord,
    resetDemo: platform.resetDemo,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlatform() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlatform outside provider");
  return ctx;
}
