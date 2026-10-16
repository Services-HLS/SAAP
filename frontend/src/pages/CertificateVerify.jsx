import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CertificateTemplate,
  CertificateVerifyPanel,
  loadLocalCerts,
  makeLocalQr,
} from "../components/AdminCertificatePanel";

export default function CertificateVerify() {
  const { referenceNo } = useParams();
  const [cert, setCert] = useState(null);
  const [missing, setMissing] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setMissing("");
      setCert(null);
      const ref = decodeURIComponent(referenceNo || "").trim();
      if (!ref) {
        setMissing("Missing certificate reference.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/certificates/verify/${encodeURIComponent(ref)}`);
        const data = await res.json();
        if (res.ok) {
          if (!cancelled) {
            setCert({
              ...data,
              qr: data.qr || `/api/certificates/verify/${data.reference_no}/qr`,
              issued_by_name: data.issued_by_name || data.issued_by?.name || "",
            });
          }
          setLoading(false);
          return;
        }
      } catch {
        /* fall through to local */
      }
      const local = loadLocalCerts().find((row) => row.reference_no === ref);
      if (local && !cancelled) {
        setCert({
          ...local,
          qr: local.qr || makeLocalQr(local.reference_no),
          issued_by_name: local.issued_by_name || local.issued_by?.name || "",
        });
      } else if (!cancelled) {
        setMissing("No certificate matches this reference.");
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [referenceNo]);

  return (
    <section className="wrap cert-verify-page">
      <p className="cert-verify-kicker">SAAP certificate verification</p>
      <h1>Certificate</h1>
      <p className="muted">Official certificate preview, with verification details below.</p>

      {loading && <p className="muted">Checking certificate…</p>}
      {missing && (
        <div className="admin-alert" role="alert">
          <p>{missing}</p>
          <p><Link to="/platform">Open registration platform</Link></p>
        </div>
      )}

      {cert && !missing && (
        <div className="cert-page-stack">
          <CertificateTemplate cert={cert} issuerName={cert.issued_by_name} templateId={cert.template || "classic"} />
          <CertificateVerifyPanel cert={cert} issuerName={cert.issued_by_name} />
        </div>
      )}
    </section>
  );
}
