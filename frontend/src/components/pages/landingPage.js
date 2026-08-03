import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
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

const normalizeSearchTerm = (value) => value.trim().replace(/\s+/g, " ");

const Landingpage = () => {
  const [search, setSearch] = useState("");
  const [fragrances, setFragrances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const { user, setUser } = useContext(UserContext);
  const latestSearchId = useRef(0);
  const searchAbortController = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      setCurrentUser(null);
      return;
    }

    fetch(`${API_URL}/user/profile`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((response) => {
        if (response.status === 401) {
          localStorage.removeItem("accessToken");
          setCurrentUser(null);
          setUser(undefined);
          return null;
        }

        if (!response.ok) {
          throw new Error("Unable to load user profile.");
        }

        return response.json();
      })
      .then((user) => {
        if (user) {
          setCurrentUser(user);
        }
      })
      .catch((error) => {
        console.error("Profile error:", error);
        setCurrentUser(null);
      });
  }, [setUser]);

  useEffect(() => {
    if (!user) {
      setCurrentUser(null);
    }
  }, [user]);

  const runSearch = useCallback(async (value) => {
    const normalizedSearch = normalizeSearchTerm(value);

    searchAbortController.current?.abort();

    if (!normalizedSearch) {
      setFragrances([]);
      setLoading(false);
      setSearched(false);
      return;
    }

    const requestId = latestSearchId.current + 1;
    const controller = new AbortController();
    latestSearchId.current = requestId;
    searchAbortController.current = controller;

    try {
      setLoading(true);
      setSearched(false);

      const response = await fetch(
        `${API_URL}/api/fragrances/search?q=${encodeURIComponent(normalizedSearch)}`,
        { signal: controller.signal }
      );

      const data = await response.json();

      if (latestSearchId.current === requestId) {
        setFragrances(Array.isArray(data) ? data : []);
        setSearched(true);
      }
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      console.error("Search error:", error);
      if (latestSearchId.current === requestId) {
        setFragrances([]);
        setSearched(true);
      }
    } finally {
      if (latestSearchId.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const normalizedSearch = normalizeSearchTerm(search);

    if (!normalizedSearch) {
      searchAbortController.current?.abort();
      setFragrances([]);
      setLoading(false);
      setSearched(false);
      return;
    }

    const debounce = setTimeout(() => {
      runSearch(normalizedSearch);
    }, 300);

    return () => clearTimeout(debounce);
  }, [runSearch, search]);

  useEffect(() => {
    return () => searchAbortController.current?.abort();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    runSearch(search);
  };

  const quickSearch = (value) => {
    setSearch(value);
  };

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.overlay}></div>

        <div style={styles.heroContent}>
          <p style={styles.badge}>WaterScent Fragrance Finder</p>

          <p style={styles.welcomeText}>
            {currentUser?.username
              ? `Welcome, ${currentUser.username}`
              : "Welcome"}
          </p>

          <h1 style={styles.title}>Looking for a scent?</h1>

          <p style={styles.subtitle}>
            Search through thousands of fragrances by name, brand, accord, or
            scent note.
          </p>

          <Form onSubmit={handleSearch} style={styles.searchBox}>
            <Form.Control
              type="text"
              placeholder="Try: sauvage, xerjoff, chanel, vanilla..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />

            <Button type="submit" style={styles.searchButton}>
              Search
            </Button>
          </Form>

          <div style={styles.quickLinks}>
            <span>Popular:</span>

            <button onClick={() => quickSearch("dior")} style={styles.quickBtn}>
              Dior
            </button>

            <button onClick={() => quickSearch("chanel")} style={styles.quickBtn}>
              Chanel
            </button>

            <button onClick={() => quickSearch("xerjoff")} style={styles.quickBtn}>
              Xerjoff
            </button>

            <button onClick={() => quickSearch("vanilla")} style={styles.quickBtn}>
              Vanilla
            </button>
          </div>
        </div>
      </section>

      <section style={styles.infoSection}>
        <div style={styles.infoCard}>
          <h3>24,000+ Fragrances</h3>
          <p>Explore a large fragrance database imported into WaterScent.</p>
        </div>

        <div style={styles.infoCard}>
          <h3>Scent Notes</h3>
          <p>View top, middle, and base notes for supported fragrances.</p>
        </div>

        <div style={styles.infoCard}>
          <h3>Accords</h3>
          <p>Discover scent profiles like woody, floral, fresh, and sweet.</p>
        </div>
      </section>

      <section style={styles.resultsSection}>
        {loading && <p style={styles.status}>Searching fragrances...</p>}

        {!loading && searched && fragrances.length === 0 && (
          <p style={styles.status}>No fragrances found. Try another search.</p>
        )}

        {fragrances.length > 0 && (
          <>
            <h2 style={styles.resultsTitle}>Search Results</h2>

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

                    <div style={styles.accords}>
                      {fragrance.accords?.slice(0, 4).map((accord, index) => (
                        <span key={index} style={styles.accord}>
                          {accord}
                        </span>
                      ))}
                    </div>

                    <div style={styles.notes}>
                      {fragrance.notes?.top?.length > 0 && (
                        <p>
                          <strong>Top:</strong>{" "}
                          {fragrance.notes.top.slice(0, 3).join(", ")}
                        </p>
                      )}

                      {fragrance.notes?.middle?.length > 0 && (
                        <p>
                          <strong>Middle:</strong>{" "}
                          {fragrance.notes.middle.slice(0, 3).join(", ")}
                        </p>
                      )}

                      {fragrance.notes?.base?.length > 0 && (
                        <p>
                          <strong>Base:</strong>{" "}
                          {fragrance.notes.base.slice(0, 3).join(", ")}
                        </p>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--ws-page-bg)",
    color: "var(--ws-text)",
  },

  hero: {
    position: "relative",
    minHeight: "78vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 20px",
    background: "var(--ws-hero-bg)",
    overflow: "hidden",
  },

  overlay: {
    position: "absolute",
    inset: 0,
    background: "var(--ws-landing-overlay)",
  },

  heroContent: {
    position: "relative",
    zIndex: 1,
    maxWidth: "880px",
    textAlign: "center",
    color: "var(--ws-text)",
  },

  badge: {
    display: "inline-block",
    padding: "8px 18px",
    borderRadius: "999px",
    backgroundColor: "rgba(255,255,255,0.14)",
    border: "1px solid var(--ws-border-strong)",
    marginBottom: "20px",
    letterSpacing: "1px",
    textTransform: "uppercase",
    fontSize: "13px",
  },

  title: {
    fontSize: "64px",
    fontWeight: "800",
    lineHeight: "1.05",
    marginBottom: "20px",
  },

  welcomeText: {
    color: "var(--ws-muted)",
    fontSize: "16px",
    fontWeight: "700",
    marginBottom: "10px",
    textAlign: "center",
  },

  subtitle: {
    fontSize: "20px",
    maxWidth: "700px",
    margin: "0 auto 35px",
    color: "var(--ws-muted)",
  },

  searchBox: {
    display: "flex",
    backgroundColor: "var(--ws-card-elevated)",
    borderRadius: "22px",
    padding: "10px",
    maxWidth: "740px",
    margin: "0 auto",
    boxShadow: "var(--ws-card-shadow)",
  },

  searchInput: {
    border: "none",
    boxShadow: "none",
    fontSize: "16px",
    padding: "16px 20px",
    backgroundColor: "var(--ws-card-elevated)",
    color: "var(--ws-brown)",
  },

  searchButton: {
    border: "none",
    backgroundColor: "var(--ws-button-bg)",
    color: "var(--ws-button-text)",
    padding: "0 30px",
    borderRadius: "16px",
    fontWeight: "600",
  },

  quickLinks: {
    marginTop: "22px",
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    flexWrap: "wrap",
    color: "var(--ws-muted)",
  },

  quickBtn: {
    border: "1px solid var(--ws-border-strong)",
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "var(--ws-text)",
    borderRadius: "999px",
    padding: "6px 14px",
    cursor: "pointer",
  },

  infoSection: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "22px",
    padding: "45px 8%",
    marginTop: "-55px",
    position: "relative",
    zIndex: 2,
  },

  infoCard: {
    backgroundColor: "var(--ws-card-elevated)",
    borderRadius: "22px",
    padding: "26px",
    boxShadow: "var(--ws-soft-shadow)",
    color: "var(--ws-brown)",
  },

  resultsSection: {
    padding: "20px 8% 70px",
  },

  resultsTitle: {
    fontSize: "32px",
    marginBottom: "24px",
  },

  status: {
    textAlign: "center",
    color: "var(--ws-muted)",
    fontSize: "18px",
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
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
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

  accords: {
    display: "flex",
    gap: "7px",
    flexWrap: "wrap",
    marginTop: "12px",
  },

  accord: {
    backgroundColor: "var(--ws-accent-2)",
    color: "var(--ws-brown-soft)",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    textTransform: "capitalize",
  },

  notes: {
    marginTop: "14px",
    fontSize: "13px",
    color: "var(--ws-muted)",
  },
};

export default Landingpage;
