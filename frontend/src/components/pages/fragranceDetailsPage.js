import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import API_URL from "../../utilities/api";

const FragranceDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [fragrance, setFragrance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/fragrances/${id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Fragrance could not be found.");
        }
  
        return res.json();
      })
      .then((data) => {
        console.log("Fragrance data:", data);
        setFragrance(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching fragrance:", error);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <p style={styles.status}>Loading fragrance...</p>;
  }

  if (!fragrance || fragrance.message) {
    return <p style={styles.status}>Fragrance not found.</p>;
  }

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.overlay}></div>

        <div style={styles.heroContent}>
          <Button
            style={styles.backButton}
            onClick={() => navigate("/")}
          >
            ← Back to Search
          </Button>

          <div style={styles.bottleBox}>
            {fragrance.imageUrl ? (
              <img
                src={fragrance.imageUrl}
                alt={`${fragrance.brand || ""} ${
                  fragrance.name || "Fragrance"
                }`}
                style={styles.bottleImage}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                  event.currentTarget.nextElementSibling.style.display =
                    "flex";
                }}
              />
            ) : null}

            <div
              style={{
                ...styles.imagePlaceholder,
                display: fragrance.imageUrl ? "none" : "flex",
              }}
            >
              🧴
            </div>
          </div>

          <p style={styles.badge}>
            {fragrance.brand || "Unknown Brand"}
          </p>

          <h1 style={styles.title}>{fragrance.name}</h1>

          <p style={styles.subtitle}>
            {fragrance.gender || "Unknown"} fragrance
            {fragrance.year
              ? ` • Released in ${fragrance.year}`
              : ""}
          </p>

          <div style={styles.heroStats}>
            <div style={styles.statBox}>
              <strong style={styles.statValue}>
                {fragrance.ratingValue || "N/A"}
              </strong>
              <span style={styles.statLabel}>Rating</span>
            </div>

            <div style={styles.statBox}>
              <strong style={styles.statValue}>
                {fragrance.ratingCount || 0}
              </strong>
              <span style={styles.statLabel}>Votes</span>
            </div>

            <div style={styles.statBox}>
              <strong style={styles.statValue}>
                {fragrance.country || "N/A"}
              </strong>
              <span style={styles.statLabel}>Country</span>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.content}>
        <Card style={styles.sectionCard}>
          <Card.Body>
            <h2 style={styles.sectionTitle}>Scent Notes</h2>

            <div style={styles.notesGrid}>
              <div style={styles.noteBox}>
                <h4>Top Notes</h4>
                <p>
                  {fragrance.notes?.top?.length
                    ? fragrance.notes.top.join(", ")
                    : "N/A"}
                </p>
              </div>

              <div style={styles.noteBox}>
                <h4>Middle Notes</h4>
                <p>
                  {fragrance.notes?.middle?.length
                    ? fragrance.notes.middle.join(", ")
                    : "N/A"}
                </p>
              </div>

              <div style={styles.noteBox}>
                <h4>Base Notes</h4>
                <p>
                  {fragrance.notes?.base?.length
                    ? fragrance.notes.base.join(", ")
                    : "N/A"}
                </p>
              </div>
            </div>
          </Card.Body>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Body>
            <h2 style={styles.sectionTitle}>Main Accords</h2>

            <div style={styles.accords}>
              {fragrance.accords?.length ? (
                fragrance.accords.map((accord, index) => (
                  <span key={index} style={styles.accord}>
                    {accord}
                  </span>
                ))
              ) : (
                <p>N/A</p>
              )}
            </div>
          </Card.Body>
        </Card>

        <Card style={styles.sectionCard}>
          <Card.Body>
            <h2 style={styles.sectionTitle}>
              Fragrance Details
            </h2>

            <div style={styles.detailsGrid}>
              <p>
                <strong>Brand:</strong>{" "}
                {fragrance.brand || "N/A"}
              </p>

              <p>
                <strong>Name:</strong>{" "}
                {fragrance.name || "N/A"}
              </p>

              <p>
                <strong>Gender:</strong>{" "}
                {fragrance.gender || "N/A"}
              </p>

              <p>
                <strong>Year:</strong>{" "}
                {fragrance.year || "N/A"}
              </p>

              <p>
                <strong>Country:</strong>{" "}
                {fragrance.country || "N/A"}
              </p>

              <p>
                <strong>Perfumers:</strong>{" "}
                {fragrance.perfumers?.length
                  ? fragrance.perfumers.join(", ")
                  : "N/A"}
              </p>
            </div>

            {fragrance.url && (
              <a
                href={fragrance.url}
                target="_blank"
                rel="noreferrer"
                style={styles.sourceLink}
              >
                View Source Page
              </a>
            )}
          </Card.Body>
        </Card>
      </section>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#fbf7f1",
    color: "#1f1a17",
  },

  hero: {
    position: "relative",
    minHeight: "65vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "70px 20px",
    background:
      "radial-gradient(circle at top left, #f3d7b7 0%, transparent 30%), linear-gradient(135deg, #2b1b13 0%, #7b5136 55%, #f4dcc1 100%)",
    overflow: "hidden",
  },

  overlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(90deg, rgba(20,12,8,0.78), rgba(20,12,8,0.38), rgba(255,255,255,0.04))",
  },

  heroContent: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: "900px",
    textAlign: "center",
    color: "white",
  },

  backButton: {
    backgroundColor: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.28)",
    borderRadius: "999px",
    padding: "8px 18px",
    marginBottom: "25px",
  },

  bottleBox: {
    width: "210px",
    height: "240px",
    borderRadius: "32px",
    background: "linear-gradient(135deg, #f5e6d3, #fff8ef)",
    color: "#2b1b13",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 25px",
    padding: "18px",
    overflow: "hidden",
    boxShadow: "0 20px 50px rgba(0,0,0,0.22)",
  },

  bottleImage: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "contain",
  },

  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "72px",
  },

  badge: {
    display: "inline-block",
    padding: "8px 18px",
    borderRadius: "999px",
    backgroundColor: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.25)",
    marginBottom: "18px",
    letterSpacing: "1px",
    textTransform: "uppercase",
    fontSize: "13px",
  },

  title: {
    fontSize: "56px",
    fontWeight: "800",
    textTransform: "capitalize",
    lineHeight: "1.05",
    marginBottom: "16px",
  },

  subtitle: {
    fontSize: "20px",
    color: "rgba(255,255,255,0.88)",
    marginBottom: "30px",
    textTransform: "capitalize",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "15px",
    maxWidth: "650px",
    margin: "0 auto",
  },

  statBox: {
    display: "flex",
    flexDirection: "column",
    padding: "14px",
    backgroundColor: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: "16px",
  },

  statValue: {
    fontSize: "18px",
  },

  statLabel: {
    marginTop: "4px",
    fontSize: "13px",
    color: "rgba(255,255,255,0.75)",
  },

  content: {
    padding: "45px 8% 80px",
    marginTop: "-45px",
    position: "relative",
    zIndex: 2,
  },

  sectionCard: {
    border: "none",
    borderRadius: "24px",
    boxShadow: "0 12px 35px rgba(0,0,0,0.08)",
    marginBottom: "25px",
  },

  sectionTitle: {
    fontSize: "28px",
    marginBottom: "22px",
    color: "#2b1b13",
  },

  notesGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "18px",
  },

  noteBox: {
    backgroundColor: "#fbf7f1",
    borderRadius: "18px",
    padding: "22px",
    border: "1px solid #efe1cf",
  },

  accords: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  accord: {
    backgroundColor: "#efe1cf",
    color: "#6d4328",
    padding: "8px 13px",
    borderRadius: "999px",
    fontSize: "14px",
    textTransform: "capitalize",
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "10px",
  },

  sourceLink: {
    display: "inline-block",
    marginTop: "20px",
    color: "#6d4328",
    fontWeight: "700",
  },

  status: {
    textAlign: "center",
    marginTop: "80px",
    color: "#6c5b4d",
    fontSize: "20px",
  },
};

export default FragranceDetailsPage;
