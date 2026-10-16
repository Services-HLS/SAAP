import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ABOUT, DSC_PDF, HOME_HIGHLIGHTS, HOME_PHOTOS, HOME_SPONSORS, HOME_SPORTS, HOME_VIDEOS, NEWS, photoFullUrl, POLICY_PDF, youtubeEmbed, youtubeThumb } from "../data/content";

const SITE = "https://sports.ap.gov.in";
const SLIDES = [
  `${SITE}/assets/images/slider4.jpg`,
  `${SITE}/assets/images/slider-13.jpg`,
  `${SITE}/assets/images/slider-18.jpg`,
  `${SITE}/assets/images/slider-17.jpg`,
  `${SITE}/assets/images/slider-14.jpg`,
  `${SITE}/assets/images/slider-16.jpg`,
  `${SITE}/assets/images/slider-15.jpg`,
];

const SERVICES = [
  { title: "Sports DSC - 2025 Schedule", icon: `${SITE}/assets/image/aplogo.png`, href: DSC_PDF },
  { title: "Pay and Play", icon: `${SITE}/assets/images/icons/pay-play.png`, to: "/pay-and-play" },
  { title: "Sports Policy", icon: `${SITE}/assets/images/icons/badminton.png`, href: POLICY_PDF },
  { title: "Training & Coaching", icon: `${SITE}/assets/images/icons/coaching.png`, to: "/training" },
  { title: "Sports League", icon: `${SITE}/assets/images/icons/league.png`, to: "/league" },
  { title: "E-Office", icon: `${SITE}/assets/images/icons/e-office.png`, href: "https://eoffice.ap.gov.in/" },
];

const OFFICERS = [
  { name: "Sri Animini Ravi Naidu", role: "Chairman,", org: "Sports Authority of Andhra Pradesh", photo: "https://sportsapi.ap.gov.in/imgs/Menuadd_Img/20250919//IMG2025091913041360161_cm_DP.jpg" },
  { name: "Sri Shamsheer Singh Rawat IAS", role: "Special Chief Secretary,", org: "YAT&C(S) Department", photo: "https://sportsapi.ap.gov.in/imgs/Menuadd_Img/20260908//IMG2026090814434814870_cm_DP.png" },
  { name: "Smt S Bharani IFS", role: "Vice Chairman & Managing Director,", org: "Sports Authority of Andhra Pradesh", photo: "https://sportsapi.ap.gov.in/imgs/Menuadd_Img/20250919//IMG2025091911005939235_cm_DP.jpg" },
];

const QRS = [
  { title: "Kreeda App", text: "Scan to download", img: `${SITE}/assets/images/kreeda-app-qr.png`, href: "https://sportsapi.ap.gov.in/imgs/apk/SAAP.apk" },
  { title: "SAAP Leagues", text: "Scan to register now", img: `${SITE}/assets/images/sl-reg-qr.png`, to: "/league" },
  { title: "Amaravati Championship", text: "Scan to register now", img: `${SITE}/assets/images/ac-qr-code.png`, to: "/amaravati" },
];

const POPUP = "/1775527685084.jpg";
const ABOUT_IMAGES = [
  { src: `${SITE}/assets/images/about-2.png`, spot: "a" },
  { src: `${SITE}/assets/images/about-3.png`, spot: "b" },
];
const DEFAULT_BG = "/assets/image/bg/prakasam-barrage.jpg";
const DISTRICT_BG = {
  Chittor: "chittor.jpg",
  Chittoor: "chittor.jpg",
  Annamayya: "annamayya.jpg",
  Tirupati: "thirupati.jpg",
  "SRI Potti Sriramulu Nellore": "Nellore.jpg",
  "Sri Sathya Sai": "satyasai.jpg",
  Satyasai: "satyasai.jpg",
  Ananthpuramu: "anantpuram.jpg",
  "Alluri Seetarama Raju": "alluri-sitharamaraju.jpg",
  "YSR (20)": "kadapa.jpg",
  "Y.S.R.": "kadapa.jpg",
  "Y.S.R.  (20)": "kadapa.jpg",
  Ananthapuramu: "anantpuram.jpg",
  Kurnool: "kurnool.jpg",
  Nandyal: "nandyala.jpg",
  Prakasam: "prakasam.jpg",
  Palnadu: "palnadu.jpg",
  NTR: "ntr.jpg",
  Ntr: "ntr.jpg",
  Krishna: "krishna.jpg",
  "West Godavari": "westgodavari.jpg",
  Konaseema: "konaseema.jpg",
  "East Godavai": "eastgodavari.jpg",
  "East Godavari": "eastgodavari.jpg",
  Eluru: "eluru.jpg",
  Kakinada: "kakinada.jpg",
  Anakapalli: "anakapalli.jpg",
  "Parvathipuram Manyam": "parvathipuram.jpg",
  "Alluri Sitharama Raju": "alluri-sitharamaraju.jpg",
  Vizianagaram: "vizianagaram.jpg",
  Visakhapatnam: "visakhapatnam.jpg",
  Srikakulam: "srikakulam.jpg",
  Bapatla: "bapatla.jpg",
  Guntur: "guntur.jpg",
};

function CardLink({ item, children }) {
  if (item.href) return <a href={item.href} target="_blank" rel="noreferrer">{children}</a>;
  return <Link to={item.to}>{children}</Link>;
}

export default function Home() {
  const [slide, setSlide] = useState(0);
  const [video, setVideo] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [popup, setPopup] = useState(true);
  const [mapHtml, setMapHtml] = useState("");
  const [bg, setBg] = useState(DEFAULT_BG);
  const [district, setDistrict] = useState("All districts");
  const [sport, setSport] = useState("");
  const activeVideo = HOME_VIDEOS[video] || HOME_VIDEOS[0];
  const highlightLoop = [...HOME_HIGHLIGHTS, ...HOME_HIGHLIGHTS];
  useEffect(() => {
    const id = setInterval(() => setSlide((n) => (n + 1) % SLIDES.length), 4000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (videoPlaying) return undefined;
    const clips = setInterval(() => setVideo((n) => (n + 1) % HOME_VIDEOS.length), 9000);
    return () => clearInterval(clips);
  }, [videoPlaying]);
  useEffect(() => {
    fetch("/ap-map.svg").then((response) => response.text()).then(setMapHtml);
  }, []);

  function onMapOver(event) {
    const link = event.target.closest("a[title]");
    if (!link) return;
    const title = link.getAttribute("title");
    const file = DISTRICT_BG[title];
    if (!file) return;
    setBg(`/assets/image/bg/${file}`);
    setDistrict(title);
  }

  function onMapLeave() {
    setBg(DEFAULT_BG);
    setDistrict("All districts");
  }

  function closePopup() {
    setPopup(false);
  }

  return (
    <>
      {popup && (
        <div className="home-popup" role="dialog" aria-modal="true" aria-label="AP Thanks India">
          <button type="button" className="home-popup-backdrop" onClick={closePopup} aria-label="Close announcement" />
          <div className="home-popup-dialog">
            <button type="button" className="home-popup-close" onClick={closePopup} aria-label="Close">×</button>
            <img src={POPUP} alt="#APThanksIndia — Amaravati" width="1280" height="640" />
          </div>
        </div>
      )}
      <section className="slider">
        <div className="carousel slide">
          <div className="carousel-indicators">
            {SLIDES.map((src, i) => (
              <button key={src} type="button" className={i === slide ? "active" : ""} aria-label={`Slide ${i + 1}`} onClick={() => setSlide(i)} />
            ))}
          </div>
          <div className="carousel-inner">
            {SLIDES.map((src, i) => (
              <div key={src} className={i === slide ? "carousel-item active" : "carousel-item"}>
                <img src={src} alt="" className="d-block w-100" />
              </div>
            ))}
          </div>
          <button type="button" className="carousel-control-prev" onClick={() => setSlide((n) => (n + SLIDES.length - 1) % SLIDES.length)}>
            <span className="carousel-control-prev-icon" />
          </button>
          <button type="button" className="carousel-control-next" onClick={() => setSlide((n) => (n + 1) % SLIDES.length)}>
            <span className="carousel-control-next-icon" />
          </button>
        </div>
      </section>

      <section className="department-section">
        <div className="container">
          <div className="department-section-inner">
            <div className="row row-gutter-y-40">
              {SERVICES.map((item) => (
                <div key={item.title} className="col-xl-2 col-lg-4 col-md-6 col-4">
                  <div className="department-card">
                    <div className="department-card-icon">
                      <CardLink item={item}><img src={item.icon} alt="" className="img-fluid" /></CardLink>
                    </div>
                    <div className="department-card-content">
                      <h5><CardLink item={item}>{item.title}</CardLink></h5>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="department-search-section">
            <div className="row row-gutter-y-40 justify-content-center align-items-center">
              {OFFICERS.map((person) => (
                <div key={person.name} className="col-xl-4 col-lg-4 col-md-6 col-12">
                  <div className="minister">
                    <img src={person.photo} alt="" />
                    <div className="content">
                      <h4>{person.name}</h4>
                      <p>{person.role}<br />{person.org}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="fc-wrapper">
        <div className="fc-container">
          {QRS.map((card) => (
            <div key={card.title} className="fc-card">
              <img src={card.img} alt="" className="fc-img" />
              <div className="fc-content">
                <h2 className="fc-title">{card.title}</h2>
                <p className="fc-sub">{card.text}</p>
                <div className="fc-actions">
                  {card.href ? <a className="fc-search-btn" href={card.href}>Scan the QR</a> : <Link className="fc-search-btn" to={card.to}>Scan the QR</Link>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <section className="about home-about">
        <div className="home-about-copy">
          <h3 className="heading">ABOUT SAAP</h3>
          <strong className="sub-heading">Sports Authority of Andhra Pradesh</strong>
          <p>{ABOUT[0]} {ABOUT[1]}</p>
          <Link to="/about" className="readmore">Read More <i className="fa fa-arrow-right" /></Link>
        </div>
        <div className="home-about-frame">
          {ABOUT_IMAGES.map((item) => (
            <img key={item.spot} src={item.src} alt="" className={`about-pic about-pic-${item.spot} is-on`} />
          ))}
        </div>
      </section>

      <section className="announced-section">
        <div className="announce-scroll">
          <div className="announce-news"><h5>Latest News</h5></div>
          <div className="ann-list">
            <div className="scrolling-wrapper">
              <div className="scrolling-content">
                {[...NEWS, ...NEWS].map((item, index) => (
                  <div key={`${item.id}-${index}`} className="news-item">
                    {item.href ? <a className="scroll-item" href={item.href} target="_blank" rel="noreferrer">{item.title}</a> : <Link className="scroll-item" to={item.to}>{item.title}</Link>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="photos-videos home-band">
        <div className="home-wrap">
          <div className="band-head">
            <h3 className="heading">Photos</h3>
            <Link to="/gallery/photos" className="viewmore">View More</Link>
          </div>
          <div className="home-photos">
            {HOME_PHOTOS.slice(0, 8).map((src, index) => (
              <a key={src} href={photoFullUrl(src)} target="_blank" rel="noreferrer" style={{ animationDelay: `${index * 40}ms` }}>
                <img src={src} alt="" loading="lazy" decoding="async" />
              </a>
            ))}
          </div>
          <div className="band-head">
            <h3 className="heading">Videos</h3>
            <Link to="/gallery/videos" className="viewmore">View More</Link>
          </div>
          <div className="saap-video-frame">
            {videoPlaying ? (
              <iframe
                title={activeVideo.title}
                src={youtubeEmbed(activeVideo.id, { autoplay: true })}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                className="saap-video-poster"
                onClick={() => setVideoPlaying(true)}
                aria-label={`Play ${activeVideo.title}`}
              >
                <img src={youtubeThumb(activeVideo.id)} alt={activeVideo.title} />
                <span className="saap-video-play" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="home-dots">
            {HOME_VIDEOS.map((clip, index) => (
              <button
                key={clip.id}
                type="button"
                className={index === video ? "is-on" : ""}
                aria-label={`Video ${index + 1}: ${clip.title}`}
                onClick={() => {
                  setVideo(index);
                  setVideoPlaying(false);
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="highlights home-band">
        <div className="home-wrap">
          <div className="band-head">
            <h3 className="heading">Highlights</h3>
            <Link to="/achievements" className="viewmore">View More</Link>
          </div>
          <div className="saap-highlight-viewport" aria-label="Athlete highlights">
            <div className="saap-highlight-track">
              {highlightLoop.map((item, index) => (
                <article key={`${item.name}-${index}`} className="item">
                  <div className="saap-highlight-media">
                    <img
                      src={item.src}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      style={{ objectPosition: item.fit === "top" ? "center top" : "center center" }}
                    />
                  </div>
                  <div className="content">
                    <h4>{item.name}</h4>
                    {item.text ? <p>{item.text}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="counter-section home-band">
        <div className="home-wrap">
          <h3 className="heading">Stats</h3>
          <div className="home-stats">
            <div className="counter pink"><div className="counter-icon"><i className="fas fa-city" /></div><span className="counter-value">286</span><h3>TRAINING CENTERS</h3></div>
            <div className="counter"><div className="counter-icon"><i className="fas fa-person-running" /></div><span className="counter-value">39,367</span><h3>ATHLETES</h3></div>
            <div className="counter purple"><div className="counter-icon"><i className="fas fa-user-tie" /></div><span className="counter-value">247</span><h3>COACHES</h3></div>
            <div className="counter blue"><div className="counter-icon"><i className="fas fa-person-skating" /></div><span className="counter-value">31</span><h3>DISCIPLINE</h3></div>
          </div>
        </div>
      </section>

      <section className="map-section home-map" onMouseLeave={onMapLeave}>
        <div className="bg-image show" style={{ backgroundImage: `url("${bg}")` }} />
        <div className="home-map-grid">
          <div className="home-map-copy counts">
            <h3 className="heading mt-2 text-white">Sports Facilities</h3>
            <h2 key={district} className="home-district">{district}</h2>
            <div className="home-stat-row">
              <div>
                <p className="funfact-text">Grounds &amp; Play fields</p>
                <div className="d-flex align-items-center">
                  <div className="icon"><i className="mdi mdi-stadium" /></div>
                  <h3 className="counter-number">131</h3>
                </div>
              </div>
              <div>
                <p className="funfact-text">Sports</p>
                <div className="d-flex align-items-center">
                  <div className="icon"><i className="mdi mdi-handball" /></div>
                  <h3 className="counter-number">31</h3>
                </div>
              </div>
              <div>
                <p className="funfact-text">Coaches</p>
                <div className="d-flex align-items-center">
                  <div className="icon"><i className="mdi mdi-account-group" /></div>
                  <h3 className="counter-number">245</h3>
                </div>
              </div>
            </div>
            <div className="sport-pills">
              {HOME_SPORTS.map((name) => (
                <p key={name} className="funfact-text">
                  <span className={sport === name ? "is-on" : ""} onClick={() => setSport(name)}>{name}</span>
                </p>
              ))}
            </div>
          </div>
          <div className="service-card home-map-card" onMouseOver={onMapOver} onClick={(event) => event.preventDefault()}>
            {mapHtml ? <div dangerouslySetInnerHTML={{ __html: mapHtml }} /> : null}
          </div>
        </div>
      </section>

      <section className="sponsors home-band">
        <div className="home-wrap">
          <div className="saap-sponsor-viewport" aria-label="Partner logos">
            <div className="saap-sponsor-track">
              {[...HOME_SPONSORS, ...HOME_SPONSORS].map((src, index) => (
                <div key={`${src}-${index}`} className="saap-sponsor-slot">
                  <img src={src} alt="" loading="lazy" decoding="async" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="socialmedia home-band" id="social">
        <div className="home-wrap">
          <div className="band-head">
            <h3 className="heading">Social media</h3>
          </div>
          <div className="saap-social">
            <a href="https://x.com/sportsinap" target="_blank" rel="noreferrer" aria-label="SAAP on X">
              <i className="fa-brands fa-x-twitter" aria-hidden="true" />
              <span>Twitter</span>
            </a>
            <a href="https://www.facebook.com/profile.php?id=61561017312498" target="_blank" rel="noreferrer" aria-label="SAAP on Facebook">
              <i className="fa-brands fa-facebook-f" aria-hidden="true" />
              <span>Facebook</span>
            </a>
            <a href="https://www.instagram.com/sportsinap2024/" target="_blank" rel="noreferrer" aria-label="SAAP on Instagram">
              <i className="fa-brands fa-instagram" aria-hidden="true" />
              <span>Instagram</span>
            </a>
            <a href="https://www.youtube.com/@sportsinap" target="_blank" rel="noreferrer" aria-label="SAAP on YouTube">
              <i className="fa-brands fa-youtube" aria-hidden="true" />
              <span>YouTube</span>
            </a>
          </div>
        </div>
      </section>

    </>
  );
}
