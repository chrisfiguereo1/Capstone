import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import API_URL from "../../utilities/api";

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

const promptChips = [
  {
    label: "Fresh Summer",
    query: "fresh citrus masculine fragrance for hot summer days",
  },
  {
    label: "Date Night",
    query: "warm spicy seductive fragrance for date night",
  },
  {
    label: "Office",
    query: "clean professional office fragrance that is subtle",
  },
  {
    label: "Woody",
    query: "smooth woody fragrance with warm earthy notes",
  },
  {
    label: "Sweet",
    query: "sweet cozy fragrance that feels warm and inviting",
  },
  {
    label: "Clean",
    query: "clean fresh fragrance that smells crisp and effortless",
  },
  {
    label: "Winter",
    query: "dark sweet vanilla fragrance for winter nights",
  },
  {
    label: "Similar to Aventus",
    query: "fruity smoky woody fragrance similar to Creed Aventus",
  },
];

const RECOMMENDATION_LIMIT = 12;

const getFragranceImage = (fragrance) =>
  fragrance?.transparentImageUrl ||
  fragrance?.transparentImage ||
  fragrance?.imageUrl ||
  fragrance?.image ||
  DEFAULT_FRAGRANCE_IMAGE;

const handleImageError = (event) => {
  event.currentTarget.onerror = null;
  event.currentTarget.src = DEFAULT_FRAGRANCE_IMAGE;
};

const getRecommendationIds = (recommendations) =>
  recommendations
    .map((fragrance) => fragrance?._id)
    .filter(Boolean)
    .map(String);

const mergeRecommendationIds = (currentIds, recommendations) =>
  Array.from(new Set([...currentIds, ...getRecommendationIds(recommendations)]));

const getMatchPercent = (fragrance) => {
  const score = Number(fragrance?.rankingScore ?? fragrance?.similarityScore);

  if (!Number.isFinite(score)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(score * 100)));
};

const RecommendationEnginePage = () => {
  const [query, setQuery] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [originalSearchQuery, setOriginalSearchQuery] = useState("");
  const [shownRecommendationIds, setShownRecommendationIds] = useState([]);
  const [replacingIndexes, setReplacingIndexes] = useState({});
  const [resultCount, setResultCount] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshingRecommendations, setRefreshingRecommendations] = useState(false);
  const [error, setError] = useState("");
  const [replaceError, setReplaceError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedQuery = query.trim();

    if (!trimmedQuery || loading) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setReplaceError("");
      setHasSearched(false);
      setReplacingIndexes({});
      setShownRecommendationIds([]);
      const accessToken = localStorage.getItem("accessToken");

      if (!accessToken) {
        navigate("/login", {
          state: { from: "/ai-finder", aiFinderRedirect: true },
        });
        return;
      }

      const requestUrl = `${API_URL}/api/recommendations`;
      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: trimmedQuery,
          limit: RECOMMENDATION_LIMIT,
        }),
      });
      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("accessToken");
        navigate("/login", {
          state: { from: "/ai-finder", aiFinderRedirect: true },
        });
        return;
      }

      if (!response.ok) {
        console.error("AI Finder request failed:", {
          url: requestUrl,
          status: response.status,
          response: data,
        });
        throw new Error(data.message || "Unable to load recommendations.");
      }

      const newRecommendations = Array.isArray(data.recommendations)
        ? data.recommendations
        : [];

      setRecommendations(newRecommendations);
      setShownRecommendationIds(getRecommendationIds(newRecommendations));
      setResultCount(
        Number.isFinite(Number(data.count))
          ? Number(data.count)
          : newRecommendations.length
      );
      setOriginalSearchQuery(trimmedQuery);
      setHasSearched(true);
    } catch (error) {
      console.error("Recommendation Engine error:", error);
      setRecommendations([]);
      setResultCount(0);
      setHasSearched(true);
      setError("We could not find recommendations right now. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const refreshRecommendations = async () => {
    if (!originalSearchQuery || loading || refreshingRecommendations) {
      return;
    }

    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      navigate("/login", {
        state: { from: "/ai-finder", aiFinderRedirect: true },
      });
      return;
    }

    const requestUrl = `${API_URL}/api/recommendations`;

    try {
      setReplaceError("");
      setRefreshingRecommendations(true);

      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: originalSearchQuery,
          excludeIds: shownRecommendationIds,
          limit: RECOMMENDATION_LIMIT,
        }),
      });
      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("accessToken");
        navigate("/login", {
          state: { from: "/ai-finder", aiFinderRedirect: true },
        });
        return;
      }

      if (!response.ok) {
        console.error("AI Finder refresh request failed:", {
          url: requestUrl,
          status: response.status,
          response: data,
        });
        throw new Error(data.message || "Unable to refresh recommendations.");
      }

      const newRecommendations = Array.isArray(data.recommendations)
        ? data.recommendations
        : [];

      setRecommendations(newRecommendations);
      setShownRecommendationIds((previous) =>
        mergeRecommendationIds(previous, newRecommendations)
      );
      setResultCount(
        Number.isFinite(Number(data.count))
          ? Number(data.count)
          : newRecommendations.length
      );
    } catch (error) {
      console.error("Recommendation refresh error:", error);
      setReplaceError("Unable to load more recommendations right now.");
    } finally {
      setRefreshingRecommendations(false);
    }
  };

  const replaceRecommendation = async (event, index) => {
    event.stopPropagation();

    if (!originalSearchQuery || replacingIndexes[index]) {
      return;
    }

    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
      navigate("/login", {
        state: { from: "/ai-finder", aiFinderRedirect: true },
      });
      return;
    }

    const excludeIds = Array.from(
      new Set([...shownRecommendationIds, ...getRecommendationIds(recommendations)])
    );
    const requestUrl = `${API_URL}/api/recommendations`;

    try {
      setReplaceError("");
      setReplacingIndexes((current) => ({ ...current, [index]: true }));

      const response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: originalSearchQuery,
          excludeIds,
          limit: 1,
        }),
      });
      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("accessToken");
        navigate("/login", {
          state: { from: "/ai-finder", aiFinderRedirect: true },
        });
        return;
      }

      if (!response.ok) {
        console.error("AI Finder replacement request failed:", {
          url: requestUrl,
          status: response.status,
          response: data,
        });
        throw new Error(data.message || "Unable to replace recommendation.");
      }

      const replacement = Array.isArray(data.recommendations)
        ? data.recommendations[0]
        : null;

      if (!replacement) {
        throw new Error("No replacement recommendation was returned.");
      }

      setRecommendations((previous) => {
        const visibleIds = new Set(
          previous
            .map((fragrance, fragranceIndex) =>
              fragranceIndex === index ? null : fragrance?._id
            )
            .filter(Boolean)
            .map(String)
        );

        if (visibleIds.has(String(replacement._id))) {
          return previous;
        }

        const updated = [...previous];
        updated[index] = replacement;
        return updated;
      });
      setShownRecommendationIds((previous) =>
        mergeRecommendationIds(previous, [replacement])
      );
    } catch (error) {
      console.error("Recommendation replacement error:", error);
      setReplaceError("Unable to replace that recommendation right now.");
    } finally {
      setReplacingIndexes((current) => {
        const updated = { ...current };
        delete updated[index];
        return updated;
      });
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <p style={styles.kicker}>Recommendation Engine</p>
        <h1 style={styles.title}>Find Your Next Scent</h1>
        <p style={styles.subtitle}>
          Tell WaterScent what you're looking for and get recommendations from
          our fragrance collection.
        </p>

        <Form onSubmit={handleSubmit} style={styles.form}>
          <Form.Control
            as="textarea"
            rows={4}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: fresh masculine summer fragrance that isn't too sweet"
            style={styles.textarea}
          />

          <div style={styles.actions}>
            <Button
              type="submit"
              disabled={loading || !query.trim()}
              style={
                loading || !query.trim()
                  ? { ...styles.submitButton, ...styles.disabledButton }
                  : styles.submitButton
              }
            >
              {loading ? "Finding..." : "Find My Scent"}
            </Button>
          </div>
        </Form>

        <div style={styles.chips}>
          {promptChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => setQuery(chip.query)}
              style={styles.chip}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {loading && (
          <p style={styles.status}>Finding your best matches...</p>
        )}

        {error && <p style={styles.error}>{error}</p>}
        {replaceError && <p style={styles.error}>{replaceError}</p>}

        {!loading && hasSearched && !error && recommendations.length === 0 && (
          <p style={styles.status}>
            No matching fragrances found. Try describing what you're looking for
            differently.
          </p>
        )}

        {recommendations.length > 0 && (
          <section style={styles.resultsSection}>
            <div style={styles.resultsHeader}>
              <h2 style={styles.resultsTitle}>Recommended for you</h2>
              <div style={styles.resultsActions}>
                <span style={styles.count}>{resultCount} matches</span>
                <Button
                  type="button"
                  disabled={refreshingRecommendations}
                  onClick={refreshRecommendations}
                  style={
                    refreshingRecommendations
                      ? { ...styles.moreButton, ...styles.disabledButton }
                      : styles.moreButton
                  }
                >
                  {refreshingRecommendations ? "Loading..." : "Try 12 More"}
                </Button>
              </div>
            </div>

            <div style={styles.grid}>
              {recommendations.map((fragrance, index) => {
                const matchPercent = getMatchPercent(fragrance);
                const isReplacing = Boolean(replacingIndexes[index]);

                return (
                  <Card
                    key={fragrance._id}
                    style={styles.card}
                    onClick={() => navigate(`/fragrance/${fragrance._id}`)}
                  >
                    <Card.Body style={styles.cardBody}>
                      <button
                        type="button"
                        title="Try another fragrance"
                        aria-label={`Try another fragrance instead of ${
                          fragrance.name || "this fragrance"
                        }`}
                        disabled={isReplacing}
                        onClick={(event) => replaceRecommendation(event, index)}
                        style={
                          isReplacing
                            ? { ...styles.replaceButton, ...styles.replaceButtonDisabled }
                            : styles.replaceButton
                        }
                      >
                        {isReplacing ? "..." : "↻"}
                      </button>
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

                      {matchPercent !== null && (
                        <p style={styles.match}>{matchPercent}% Match</p>
                      )}

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

                      {fragrance.accords?.length > 0 && (
                        <p style={styles.accordLine}>
                          {fragrance.accords.slice(0, 3).join(" • ")}
                        </p>
                      )}
                    </Card.Body>
                  </Card>
                );
              })}
            </div>
          </section>
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
    padding: "54px 8% 76px",
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
    margin: "6px 0 12px",
  },

  subtitle: {
    color: "var(--ws-muted)",
    fontSize: "18px",
    maxWidth: "720px",
    marginBottom: "28px",
  },

  form: {
    maxWidth: "860px",
  },

  textarea: {
    width: "100%",
    minHeight: "138px",
    resize: "vertical",
    border: "1px solid var(--ws-border)",
    borderRadius: "18px",
    backgroundColor: "var(--ws-card-elevated)",
    color: "var(--ws-brown)",
    boxShadow: "var(--ws-soft-shadow)",
    fontSize: "16px",
    padding: "18px 20px",
  },

  actions: {
    display: "flex",
    justifyContent: "flex-start",
    marginTop: "14px",
  },

  submitButton: {
    border: "none",
    backgroundColor: "var(--ws-button-bg)",
    color: "var(--ws-button-text)",
    borderRadius: "999px",
    padding: "11px 22px",
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.62,
    cursor: "not-allowed",
  },

  chips: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    margin: "20px 0 30px",
    maxWidth: "900px",
  },

  chip: {
    border: "1px solid var(--ws-border-strong)",
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "var(--ws-text)",
    borderRadius: "999px",
    padding: "7px 14px",
    cursor: "pointer",
    fontWeight: "700",
  },

  status: {
    color: "var(--ws-muted)",
    fontSize: "18px",
  },

  error: {
    color: "#d85c98",
    fontWeight: "800",
  },

  resultsSection: {
    marginTop: "18px",
  },

  resultsHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap",
    marginBottom: "22px",
  },

  resultsTitle: {
    color: "var(--ws-text-strong)",
    fontSize: "32px",
    margin: 0,
  },

  count: {
    color: "var(--ws-muted)",
    fontWeight: "800",
  },

  resultsActions: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },

  moreButton: {
    border: "none",
    backgroundColor: "var(--ws-button-bg)",
    color: "var(--ws-button-text)",
    borderRadius: "999px",
    padding: "8px 16px",
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

  cardBody: {
    position: "relative",
  },

  replaceButton: {
    position: "absolute",
    top: "12px",
    right: "12px",
    width: "34px",
    height: "34px",
    border: "1px solid var(--ws-border)",
    borderRadius: "999px",
    background: "var(--ws-card-solid)",
    color: "var(--ws-brown)",
    cursor: "pointer",
    fontSize: "18px",
    fontWeight: "800",
    lineHeight: "1",
    zIndex: 2,
  },

  replaceButtonDisabled: {
    cursor: "not-allowed",
    opacity: 0.58,
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

  match: {
    display: "inline-block",
    background: "var(--ws-button-bg)",
    color: "var(--ws-button-text)",
    borderRadius: "999px",
    padding: "6px 11px",
    fontSize: "12px",
    fontWeight: "850",
    marginBottom: "12px",
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

  accordLine: {
    color: "var(--ws-muted)",
    fontSize: "13px",
    textTransform: "capitalize",
    marginBottom: 0,
  },
};

export default RecommendationEnginePage;
