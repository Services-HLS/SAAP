import { Navigate, Route, Routes } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import Shell from "./components/Shell";
import Home from "./pages/Home";
import {
  About,
  Achievements,
  AppsPage,
  Associations,
  Auction,
  CalendarPage,
  Contact,
  Facilities,
  Gallery,
  Legal,
  Manual,
  News,
  Orders,
  Organogram,
  Policy,
  Recruitment,
  SchemePage,
  Tenders,
  Tournaments,
  Training,
} from "./pages/Info";
import { Amaravati, Certificates, CertificateView, Dsc, League, PayAndPlay, Register } from "./pages/Services";
import CertificateVerify from "./pages/CertificateVerify";
import { Audit, Dashboard, Desk, Ledger, Login } from "./pages/Secure";
import Platform from "./pages/Platform";
import PlayLoader from "./components/PlayLoader";
import { usePlatform } from "./context";

function Boot({ children }) {
  const { ready } = usePlatform();
  if (!ready) {
    return (
      <div className="boot">
        <PlayLoader />
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <Boot>
      <ScrollToTop />
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="organogram" element={<Organogram />} />
          <Route path="policy" element={<Policy />} />
          <Route path="schemes/:slug" element={<SchemePage />} />
          <Route path="gallery/:slug" element={<Gallery />} />
          <Route path="gallery" element={<Navigate to="/gallery/photos" replace />} />
          <Route path="news" element={<News />} />
          <Route path="contact" element={<Contact />} />
          <Route path="facilities" element={<Facilities />} />
          <Route path="associations" element={<Associations />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="achievements" element={<Achievements />} />
          <Route path="tournaments" element={<Tournaments />} />
          <Route path="recruitment" element={<Recruitment />} />
          <Route path="tenders" element={<Tenders />} />
          <Route path="orders" element={<Orders />} />
          <Route path="open-auction" element={<Auction />} />
          <Route path="manual" element={<Manual />} />
          <Route path="apps" element={<AppsPage />} />
          <Route path="training" element={<Training />} />
          <Route path="dsc" element={<Dsc />} />
          <Route path="league" element={<League />} />
          <Route path="amaravati" element={<Amaravati />} />
          <Route path="pay-and-play" element={<PayAndPlay />} />
          <Route path="register" element={<Register />} />
          <Route path="certificates" element={<Certificates />} />
          <Route path="certificates/:id" element={<CertificateView />} />
          <Route path="cert/:referenceNo" element={<CertificateVerify />} />
          <Route path="login" element={<Login />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="audit" element={<Audit />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="desk" element={<Desk />} />
          <Route path="platform" element={<Platform />} />
          <Route path="legal/:slug" element={<Legal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Boot>
  );
}
