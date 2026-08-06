import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import API_URL from "../../utilities/api";
import { UserContext } from "../../App";

const DEFAULT_FRAGRANCE_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" role="img" aria-label="WaterScent fragrance placeholder">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f5e6d3"/>
          <stop offset="58%" stop-color="#fff8ef"/>
          <stop offset="100%" stop-color="#efe1cf"/>
        </linearGradient>
        <linearGradient id="bottle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#fffaf3"/>
          <stop offset="100%" stop-color="#d8b995"/>
        </linearGradient>
      </defs>
      <rect width="420" height="420" rx="28" fill="url(#background)"/>
      <rect x="178" y="86" width="64" height="54" rx="12" fill="#7b5136" opacity="0.9"/>
      <rect x="154" y="132" width="112" height="166" rx="34" fill="url(#bottle)" stroke="#7b5136" stroke-width="8"/>
      <rect x="184" y="172" width="52" height="62" rx="14" fill="#fff8ef" opacity="0.86"/>
      <text x="210" y="342" text-anchor="middle" fill="#6d4328" font-family="Arial, sans-serif" font-size="28" font-weight="700">WaterScent</text>
    </svg>
  `);

const getFragranceImage = (fragrance) =>
  fragrance?.imageUrl || fragrance?.image || DEFAULT_FRAGRANCE_IMAGE;

const handleImageError = (event) => {
  event.currentTarget.onerror = null;
  event.currentTarget.src = DEFAULT_FRAGRANCE_IMAGE;
};

const SavedFragrancesPage = () => {
  const { setUser } = useContext(UserContext);
  const [fragrances, setFragrances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      navigate("/login");
      return;
    }

    fetch(`${API_URL}/api/saved-fragrances`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((response) => {
        if (response.status === 401) {
          localStorage.removeItem("accessToken");
          setUser(undefined);
          navigate("/login");
          return null;
        }

        if (!response.ok) {
          throw new Error("Unable to load saved fragrances.");
        }

        return response.json();
      })
      .then((data) => {
        if (data) {
          setFragrances(Array.isArray(data) ? data : []);
        }
      })
      .catch((error) => {
        setError(error.message || "Unable to load saved fragrances.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate, setUser]);

  const unsaveFragrance = async (event, fragranceId) => {
    event.stopPropagation();
    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      navigate("/login");
      return;
    }

    try {
      setError("");
      const response = await fetch(`${API_URL}/api/saved-fragrances/${fragranceId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Unable to unsave fragrance.");
      }

      setFragrances((current) =>
        current.filter((fragrance) => fragrance._id !== fragranceId)
      );
    } catch (error) {
      setError(error.message || "Unable to unsave fragrance.");
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <p style={styles.kicker}>Your Collection</p>
        <h1 style={styles.title}>Saved Fragrances</h1>

        {loading && <p style={styles.status}>Loading saved fragrances...</p>}
        {error && <p style={styles.error}>{error}</p>}

        {!loading && !error && fragrances.length === 0 && (
          <p style={styles.status}>You have not saved any fragrances yet.</p>
        )}

        {fragrances.length > 0 && (
          <div style={styles.grid}>
            {fragrances.map((fragrance) => (
              <Card
                key={fragrance._id}
                style={styles.card}
                onClick={() => navigate(`/fragrance/${fragrance._id}`)}
              >
                <Card.Body>
                  <div style={styles.imageWrap}>
                    <img
                      src={getFragranceImage(fragrance)}
                      alt={`${fragrance.name || "Fragrance"} by ${
                        fragrance.brand || "Unknown brand"
                      }`}
                      loading="lazy"
                      onError={handleImageError}
                      style={styles.bottleImage}
                    />
                  </div>

                  <Card.Title style={styles.cardTitle}>
                    {fragrance.name || "Unknown Fragrance"}
                  </Card.Title>

                  <Card.Subtitle style={styles.brand}>
                    {fragrance.brand || "Unknown Brand"}
                  </Card.Subtitle>

                  <p style={styles.meta}>
                    {fragrance.gender || "Unknown"} •{" "}
                    {fragrance.year || "Year N/A"}
                  </p>

                  <p style={styles.rating}>
                    Rating: {fragrance.ratingValue || "N/A"}
                  </p>

                  <Button
                    type="button"
                    style={styles.saveButton}
                    onClick={(event) => unsaveFragrance(event, fragrance._id)}
                  >
                    Saved
                  </Button>
                </Card.Body>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--ws-page-bg)",
    color: "var(--ws-text)",
    padding: "48px 8% 70px",
  },

  shell: {
    maxWidth: "1180px",
    margin: "0 auto",
  },

  kicker: {
    margin: 0,
    color: "var(--ws-muted-strong)",
    fontSize: "12px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },

  title: {
    color: "var(--ws-text-strong)",
    fontSize: "42px",
    fontWeight: "850",
    margin: "6px 0 28px",
  },

  status: {
    color: "var(--ws-muted)",
    fontSize: "18px",
  },

  error: {
    color: "#d85c98",
    fontWeight: "800",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "24px",
  },

  card: {
    border: "none",
    borderRadius: "22px",
    background: "var(--ws-card-elevated)",
    boxShadow: "var(--ws-soft-shadow)",
    overflow: "hidden",
    cursor: "pointer",
  },

  imageWrap: {
    width: "100%",
    height: "220px",
    borderRadius: "18px",
    background: "var(--ws-image-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "18px",
    marginBottom: "18px",
    overflow: "hidden",
  },

  bottleImage: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "contain",
    filter: "drop-shadow(0 16px 18px rgba(43, 27, 19, 0.16))",
  },

  cardTitle: {
    textTransform: "capitalize",
    fontWeight: "700",
  },

  brand: {
    textTransform: "capitalize",
    color: "var(--ws-brown-soft)",
    marginBottom: "12px",
  },

  meta: {
    color: "var(--ws-muted)",
    fontSize: "14px",
  },

  rating: {
    color: "var(--ws-brown)",
    fontWeight: "600",
  },

  saveButton: {
    background: "var(--ws-button-bg)",
    border: "none",
    borderRadius: "999px",
    color: "var(--ws-button-text)",
    fontWeight: "800",
    padding: "8px 16px",
  },
};

export default SavedFragrancesPage;
