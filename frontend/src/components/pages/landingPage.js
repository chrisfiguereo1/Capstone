import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import API_URL from "../../utilities/api";

const Landingpage = () => {
  const [search, setSearch] = useState("");
  const [fragrances, setFragrances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

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
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!search.trim()) return;

    try {
      setLoading(true);
      setSearched(true);

      const response = await fetch(
        `${API_URL}/api/fragrances/search?q=${encodeURIComponent(search)}`
      );

      const data = await response.json();
      setFragrances(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Search error:", error);
      setFragrances([]);
    } finally {
      setLoading(false);
    }
  };

  const quickSearch = async (value) => {
    setSearch(value);

    try {
      setLoading(true);
      setSearched(true);

      const response = await fetch(
        `${API_URL}/api/fragrances/search?q=${encodeURIComponent(value)}`
      );

      const data = await response.json();
      setFragrances(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Search error:", error);
      setFragrances([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.overlay}></div>

        <div style={styles.heroContent}>
          <p style={styles.badge}>WaterScent Fragrance Finder</p>

          <h1 style={styles.title}>
            {currentUser?.username
              ? `Welcome, ${currentUser.username}! Looking for a scent?`
              : "Welcome! Looking for a scent?"}
          </h1>

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
                    <div style={styles.bottleBox}>🧴</div>

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
    backgroundColor: "#fbf7f1",
    color: "#1f1a17",
  },

  hero: {
    position: "relative",
    minHeight: "78vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 20px",
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
    maxWidth: "880px",
    textAlign: "center",
    color: "white",
  },

  badge: {
    display: "inline-block",
    padding: "8px 18px",
    borderRadius: "999px",
    backgroundColor: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.25)",
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

  subtitle: {
    fontSize: "20px",
    maxWidth: "700px",
    margin: "0 auto 35px",
    color: "rgba(255,255,255,0.88)",
  },

  searchBox: {
    display: "flex",
    backgroundColor: "white",
    borderRadius: "22px",
    padding: "10px",
    maxWidth: "740px",
    margin: "0 auto",
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
  },

  searchInput: {
    border: "none",
    boxShadow: "none",
    fontSize: "16px",
    padding: "16px 20px",
  },

  searchButton: {
    border: "none",
    backgroundColor: "#2b1b13",
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
    color: "rgba(255,255,255,0.85)",
  },

  quickBtn: {
    border: "1px solid rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "white",
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
    backgroundColor: "white",
    borderRadius: "22px",
    padding: "26px",
    boxShadow: "0 12px 35px rgba(0,0,0,0.08)",
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
    color: "#6c5b4d",
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
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    overflow: "hidden",
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },

  bottleBox: {
    height: "145px",
    borderRadius: "18px",
    background: "linear-gradient(135deg, #f5e6d3, #fff8ef)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "54px",
    marginBottom: "18px",
  },

  cardTitle: {
    textTransform: "capitalize",
    fontWeight: "700",
  },

  brand: {
    textTransform: "capitalize",
    color: "#8b5e3c",
    marginBottom: "12px",
  },

  meta: {
    color: "#6c6c6c",
    fontSize: "14px",
  },

  rating: {
    color: "#2b1b13",
    fontWeight: "600",
  },

  accords: {
    display: "flex",
    gap: "7px",
    flexWrap: "wrap",
    marginTop: "12px",
  },

  accord: {
    backgroundColor: "#efe1cf",
    color: "#6d4328",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    textTransform: "capitalize",
  },

  notes: {
    marginTop: "14px",
    fontSize: "13px",
    color: "#5f5249",
  },
};

export default Landingpage;
