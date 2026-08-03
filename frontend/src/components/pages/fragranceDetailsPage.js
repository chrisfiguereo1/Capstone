import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Button from "react-bootstrap/Button";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import API_URL from "../../utilities/api";
import { UserContext } from "../../App";
import getUserInfo from "../../utilities/decodeJwt";

const ACCORD_COLORS = ["#4778d9", "#45a86b", "#e99a3d", "#8b5fd6", "#d85c98"];
const DEFAULT_ACCORD_WEIGHTS = [35, 25, 18, 12, 10];

const buildAccordData = (accords = []) => {
  const visibleAccords = accords.filter(Boolean).slice(0, 5);

  if (!visibleAccords.length) {
    return [];
  }

  const baseWeights = DEFAULT_ACCORD_WEIGHTS.slice(0, visibleAccords.length);
  const total = baseWeights.reduce((sum, value) => sum + value, 0);

  return visibleAccords.map((accord, index) => ({
    name: accord,
    value: Math.round((baseWeights[index] / total) * 100),
    color: ACCORD_COLORS[index % ACCORD_COLORS.length],
  }));
};

const MAX_REVIEW_LENGTH = 1500;

const renderStars = (rating, label = `${rating || 0} out of 5 stars`) => (
  <span aria-label={label} style={styles.starRow}>
    {[1, 2, 3, 4, 5].map((star) => (
      <span key={star} aria-hidden="true">
        {star <= Math.round(rating || 0) ? "★" : "☆"}
      </span>
    ))}
  </span>
);

const formatReviewDate = (value) => {
  if (!value) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const readApiJson = async (response) => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
};

const FragranceDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(UserContext);

  const [fragrance, setFragrance] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageMessage, setImageMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeAccord, setActiveAccord] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({
    reviewCount: 0,
    averageRating: null,
  });
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: "" });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewEditing, setReviewEditing] = useState(false);
  const imageLookupStarted = useRef(false);
  const activeUser = user || getUserInfo();

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
        setImageUrl(data.imageUrl || data.image || "");
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching fragrance:", error);
        setLoading(false);
      });
  }, [id]);

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    setReviewsError("");

    try {
      const response = await fetch(`${API_URL}/api/fragrances/${id}/reviews`);
      const data = await readApiJson(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to load reviews.");
      }

      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      setReviewSummary({
        reviewCount: data.reviewCount || 0,
        averageRating: data.averageRating ?? null,
      });
    } catch (error) {
      setReviews([]);
      setReviewSummary({ reviewCount: 0, averageRating: null });
    } finally {
      setReviewsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const requestFragranceImage = useCallback(async (replaceGenerated) => {
    setImageLoading(true);
    setImageMessage("");

    try {
      const response = await fetch(`${API_URL}/api/fragrances/${id}/image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ replaceGenerated }),
      });
      const data = await readApiJson(response);

      if (!response.ok || !data.imageUrl) {
        setImageMessage(data.message || "No matching bottle image was found.");
        return;
      }

      setImageUrl(data.imageUrl);
      setFragrance((current) =>
        current
          ? {
              ...current,
              image: data.imageUrl,
              imageUrl: data.imageUrl,
              imageSource: data.source,
            }
          : current
      );
      setImageMessage(
        data.cached ? "Saved image loaded." : "Bottle image found and saved."
      );
    } catch (error) {
      setImageMessage("Image lookup is unavailable right now.");
    } finally {
      setImageLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!fragrance || imageUrl || imageLookupStarted.current) {
      return;
    }

    imageLookupStarted.current = true;
    requestFragranceImage(false);
  }, [fragrance, imageUrl, requestFragranceImage]);

  const currentUserReview = reviews.find(
    (review) =>
      activeUser?.id && String(review.userId) === String(activeUser.id)
  );

  const applyReviewSummary = (summary) => {
    if (!summary) return;

    setReviews(Array.isArray(summary.reviews) ? summary.reviews : []);
    setReviewSummary({
      reviewCount: summary.reviewCount || 0,
      averageRating: summary.averageRating ?? null,
    });
  };

  const getReviewValidationMessage = () => {
    if (!reviewForm.rating) {
      return "Please select a rating.";
    }

    if (!reviewForm.comment.trim()) {
      return "Please write a review before submitting.";
    }

    if (reviewForm.comment.trim().length > MAX_REVIEW_LENGTH) {
      return `Reviews must be ${MAX_REVIEW_LENGTH} characters or fewer.`;
    }

    return "";
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    const validationMessage = getReviewValidationMessage();

    if (validationMessage) {
      setReviewsError(validationMessage);
      return;
    }

    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      setReviewsError("Please log in to leave a review.");
      return;
    }

    const editingExistingReview = Boolean(reviewEditing && currentUserReview);
    const endpoint = editingExistingReview
      ? `${API_URL}/api/reviews/${currentUserReview._id}`
      : `${API_URL}/api/fragrances/${id}/reviews`;

    setReviewSubmitting(true);
    setReviewsError("");
    setReviewSuccess("");

    try {
      const response = await fetch(endpoint, {
        method: editingExistingReview ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating: reviewForm.rating,
          comment: reviewForm.comment.trim(),
        }),
      });
      const data = await readApiJson(response);

      if (!response.ok) {
        throw new Error(data.message || "Review could not be submitted.");
      }

      applyReviewSummary(data.summary);
      setReviewForm({ rating: 0, comment: "" });
      setReviewEditing(false);
      setReviewSuccess(
        editingExistingReview ? "Review updated." : "Review added."
      );
    } catch (error) {
      setReviewsError(error.message || "Review could not be submitted.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const startEditingReview = (review) => {
    setReviewForm({ rating: review.rating, comment: review.comment });
    setReviewEditing(true);
    setReviewSuccess("");
    setReviewsError("");
  };

  const cancelEditingReview = () => {
    setReviewForm({ rating: 0, comment: "" });
    setReviewEditing(false);
    setReviewsError("");
  };

  const deleteReview = async (review) => {
    if (!window.confirm("Delete this review permanently?")) {
      return;
    }

    const accessToken = localStorage.getItem("accessToken");
    if (!accessToken) {
      setReviewsError("Please log in to delete your review.");
      return;
    }

    setReviewSubmitting(true);
    setReviewsError("");
    setReviewSuccess("");

    try {
      const response = await fetch(`${API_URL}/api/reviews/${review._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await readApiJson(response);

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete review.");
      }

      applyReviewSummary(data.summary);
      setReviewForm({ rating: 0, comment: "" });
      setReviewEditing(false);
      setReviewSuccess("Review deleted.");
    } catch (error) {
      setReviewsError(error.message || "Unable to delete review.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return <p style={styles.status}>Loading fragrance...</p>;
  }

  if (!fragrance || fragrance.message) {
    return <p style={styles.status}>Fragrance not found.</p>;
  }

  const accordData = buildAccordData(fragrance.accords);

  const renderNoteCard = (title, notes, icon, tone) => (
    <article className="ws-card ws-note-card" style={{ ...styles.noteCard, background: tone }}>
      <div style={styles.cardEyebrow}>
        <span style={styles.noteIcon}>{icon}</span>
        <h3 style={styles.noteTitle}>{title}</h3>
      </div>

      <div style={styles.chipWrap}>
        {notes?.length ? (
          notes.map((note, index) => (
            <span key={`${title}-${note}-${index}`} style={styles.noteChip}>
              {note}
            </span>
          ))
        ) : (
          <span style={styles.emptyText}>N/A</span>
        )}
      </div>
    </article>
  );

  const renderRatingSelector = () => (
    <fieldset style={styles.ratingSelector}>
      <legend style={styles.formLabel}>Your rating</legend>
      <div style={styles.ratingOptions}>
        {[1, 2, 3, 4, 5].map((rating) => (
          <label key={rating} style={styles.ratingOption}>
            <input
              type="radio"
              name="review-rating"
              value={rating}
              checked={reviewForm.rating === rating}
              onChange={() =>
                setReviewForm((current) => ({ ...current, rating }))
              }
              style={styles.ratingInput}
            />
            <span
              style={{
                ...styles.ratingStarButton,
                ...(reviewForm.rating >= rating
                  ? styles.ratingStarButtonActive
                  : {}),
              }}
            >
              ★
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  const renderReviewForm = () => {
    if (!activeUser) {
      return (
        <div style={styles.reviewPrompt}>
          <p style={styles.ratingText}>Must log in to review.</p>
          <Link to="/login" style={styles.sourceLink}>
            Go to login
          </Link>
        </div>
      );
    }

    if (currentUserReview && !reviewEditing) {
      return (
        <div style={styles.reviewPrompt}>
          <p style={styles.ratingText}>
            You have already reviewed this fragrance.
          </p>
          <Button
            type="button"
            style={styles.imageButton}
            onClick={() => startEditingReview(currentUserReview)}
          >
            Edit your review
          </Button>
        </div>
      );
    }

    return (
      <form onSubmit={handleReviewSubmit} style={styles.reviewForm}>
        {renderRatingSelector()}

        <label style={styles.formLabel} htmlFor="review-comment">
          Your review
        </label>
        <textarea
          id="review-comment"
          value={reviewForm.comment}
          maxLength={MAX_REVIEW_LENGTH}
          onChange={(event) =>
            setReviewForm((current) => ({
              ...current,
              comment: event.target.value,
            }))
          }
          placeholder="What did this fragrance smell like to you?"
          style={styles.reviewTextarea}
        />

        <div style={styles.reviewFormFooter}>
          <span style={styles.ratingText}>
            {reviewForm.comment.length}/{MAX_REVIEW_LENGTH}
          </span>
          <div style={styles.reviewActions}>
            {reviewEditing && (
              <Button
                type="button"
                style={styles.secondaryButton}
                onClick={cancelEditingReview}
                disabled={reviewSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              style={styles.imageButton}
              disabled={reviewSubmitting}
            >
              {reviewSubmitting
                ? "Saving..."
                : reviewEditing
                ? "Update review"
                : "Submit review"}
            </Button>
          </div>
        </div>
      </form>
    );
  };

  const renderReviewCard = (review) => {
    const isOwner = Boolean(
      activeUser?.id && String(review.userId) === String(activeUser.id)
    );
    const edited =
      review.updatedAt &&
      review.createdAt &&
      new Date(review.updatedAt).getTime() - new Date(review.createdAt).getTime() >
        1000;

    return (
      <article key={review._id} className="ws-card" style={styles.reviewCard}>
        <div style={styles.reviewCardHeader}>
          <div>
            <h3 style={styles.reviewAuthor}>{review.username || "WaterScent user"}</h3>
            <p style={styles.ratingText}>
              {formatReviewDate(review.createdAt)}
              {edited ? " • Edited" : ""}
            </p>
          </div>
          {renderStars(review.rating)}
        </div>

        <p style={styles.reviewComment}>{review.comment}</p>

        {isOwner && (
          <div style={styles.reviewActions}>
            <Button
              type="button"
              style={styles.secondaryButton}
              onClick={() => startEditingReview(review)}
            >
              Edit
            </Button>
            <Button
              type="button"
              style={styles.dangerButton}
              onClick={() => deleteReview(review)}
              disabled={reviewSubmitting}
            >
              Delete
            </Button>
          </div>
        )}
      </article>
    );
  };

  return (
    <div style={styles.page}>
      <style>
        {`
          .ws-card {
            animation: wsFadeIn 560ms ease both;
            transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
          }

          .ws-card:hover {
            transform: translateY(-4px);
            box-shadow: var(--ws-card-shadow);
            border-color: var(--ws-border-strong);
          }

          .ws-hero {
            grid-template-columns: minmax(260px, 0.82fr) minmax(320px, 1.18fr);
          }

          .ws-content-grid {
            grid-template-columns: minmax(0, 1.1fr) minmax(300px, 0.9fr);
          }

          .ws-reviews-layout {
            grid-template-columns: minmax(240px, 0.78fr) minmax(320px, 1.22fr);
          }

          @keyframes wsFadeIn {
            from {
              opacity: 0;
              transform: translateY(14px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @media (max-width: 900px) {
            .ws-hero,
            .ws-content-grid,
            .ws-reviews-layout {
              grid-template-columns: 1fr;
            }

            .ws-hero-copy {
              text-align: center;
            }
          }

          @media (max-width: 620px) {
            .ws-page-pad {
              padding-left: 18px !important;
              padding-right: 18px !important;
            }

            .ws-hero-title {
              font-size: 40px !important;
            }

            .ws-hero {
              padding: 26px !important;
            }
          }
        `}
      </style>

      <main className="ws-page-pad" style={styles.shell}>
        <Button style={styles.backButton} onClick={() => navigate("/")}>
          Back to Search
        </Button>

        <section className="ws-card ws-hero" style={styles.hero}>
          <div style={styles.imagePanel}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={`${fragrance.brand || ""} ${fragrance.name || "Fragrance"}`}
                style={styles.bottleImage}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                  event.currentTarget.nextElementSibling.style.display = "flex";
                  setImageMessage("This image could not be displayed.");
                }}
              />
            ) : null}

            <div
              style={{
                ...styles.imagePlaceholder,
                display: imageUrl ? "none" : "flex",
              }}
            >
              {imageLoading ? "Finding image..." : "Fragrance"}
            </div>
          </div>

          <div className="ws-hero-copy" style={styles.heroCopy}>
            <p style={styles.badge}>{fragrance.brand || "Unknown Brand"}</p>
            <h1 className="ws-hero-title" style={styles.title}>
              {fragrance.name || "Untitled Fragrance"}
            </h1>

            <div style={styles.heroMeta}>
              <span>{fragrance.year || "Unknown year"}</span>
              <span>{fragrance.gender || "Unknown gender"}</span>
              <span>{fragrance.country || "Unknown country"}</span>
            </div>

            <div style={styles.ratingHero}>
              <span style={styles.star}>★</span>
              <strong style={styles.ratingValue}>
                {fragrance.ratingValue || "N/A"}
              </strong>
              <span style={styles.ratingCopy}>
                {fragrance.ratingCount || 0} ratings
              </span>
            </div>

            <div style={styles.imageActions}>
              <Button
                type="button"
                style={styles.imageButton}
                disabled={imageLoading}
                onClick={() => requestFragranceImage(true)}
              >
                {imageLoading ? "Finding..." : "Find real bottle image"}
              </Button>
              {imageMessage && (
                <p style={styles.imageMessage}>{imageMessage}</p>
              )}
            </div>
          </div>
        </section>

        <section style={styles.sectionStack}>
          <article className="ws-card" style={styles.card}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>◌</span>
              <div>
                <p style={styles.kicker}>Profile</p>
                <h2 style={styles.sectionTitle}>Main Accords</h2>
              </div>
            </div>

            {accordData.length ? (
              <div className="ws-content-grid" style={styles.accordLayout}>
                <div style={styles.chartBox}>
                  <ResponsiveContainer width="100%" height={290}>
                    <PieChart>
                      <Tooltip
                        formatter={(value, name) => [`${value}%`, name]}
                        contentStyle={styles.tooltip}
                      />
                      <Pie
                        data={accordData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="48%"
                        outerRadius="82%"
                        paddingAngle={3}
                        cornerRadius={10}
                        isAnimationActive
                        onMouseEnter={(_, index) => setActiveAccord(index)}
                        onMouseLeave={() => setActiveAccord(null)}
                      >
                        {accordData.map((entry, index) => (
                          <Cell
                            key={`accord-${entry.name}`}
                            fill={entry.color}
                            stroke="#fffaf5"
                            strokeWidth={activeAccord === index ? 5 : 3}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div style={styles.legendList}>
                  {accordData.map((accord, index) => (
                    <div key={accord.name} style={styles.legendItem}>
                      <span
                        style={{
                          ...styles.legendSwatch,
                          backgroundColor: accord.color,
                        }}
                      />
                      <span style={styles.legendName}>{accord.name}</span>
                      <strong style={styles.legendValue}>{accord.value}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={styles.emptyText}>N/A</p>
            )}
          </article>

          <section style={styles.notesGrid}>
            {renderNoteCard("Top Notes", fragrance.notes?.top, "Top", "var(--ws-note-top-bg)")}
            {renderNoteCard("Middle Notes", fragrance.notes?.middle, "Heart", "var(--ws-note-middle-bg)")}
            {renderNoteCard("Base Notes", fragrance.notes?.base, "Base", "var(--ws-note-base-bg)")}
          </section>

          <section className="ws-content-grid" style={styles.lowerGrid}>
            <article className="ws-card" style={styles.card}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionIcon}>✦</span>
                <div>
                  <p style={styles.kicker}>Creators</p>
                  <h2 style={styles.sectionTitle}>Perfumers</h2>
                </div>
              </div>

              <div style={styles.chipWrap}>
                {fragrance.perfumers?.length ? (
                  fragrance.perfumers.map((perfumer, index) => (
                    <span key={`${perfumer}-${index}`} style={styles.perfumerChip}>
                      {perfumer}
                    </span>
                  ))
                ) : (
                  <span style={styles.emptyText}>N/A</span>
                )}
              </div>
            </article>

            <article className="ws-card" style={styles.card}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionIcon}>i</span>
                <div>
                  <p style={styles.kicker}>Archive</p>
                  <h2 style={styles.sectionTitle}>Details</h2>
                </div>
              </div>

              <div style={styles.detailsList}>
                {[
                  ["Brand", fragrance.brand || "N/A", "Brand"],
                  ["Country", fragrance.country || "N/A", "Country"],
                  ["Year", fragrance.year || "N/A", "Year"],
                  ["Gender", fragrance.gender || "N/A", "Gender"],
                  ["Source", fragrance.source || "N/A", "Source"],
                ].map(([label, value, icon]) => (
                  <div key={label} style={styles.detailRow}>
                    <span style={styles.detailIcon}>{icon}</span>
                    <span style={styles.detailLabel}>{label}</span>
                    <strong style={styles.detailValue}>{value}</strong>
                  </div>
                ))}
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
            </article>
          </section>

          <article className="ws-card" style={styles.ratingCard}>
            <span style={styles.ratingStar}>★</span>
            <div>
              <p style={styles.kicker}>Original Source Rating</p>
              <h2 style={styles.ratingTitle}>
                {fragrance.ratingValue || "N/A"}
              </h2>
              <p style={styles.ratingText}>
                Based on {fragrance.ratingCount || 0} ratings
              </p>
            </div>
          </article>

          <section className="ws-card" style={styles.reviewsSection}>
            <div className="ws-reviews-layout" style={styles.reviewsLayout}>
              <div>
                <p style={styles.kicker}>WaterScent Reviews</p>
                <h2 style={styles.sectionTitle}>Community Reviews</h2>
                <div style={styles.reviewSummary}>
                  <span style={styles.ratingStar}>★</span>
                  <div>
                    <h3 style={styles.reviewAverage}>
                      {reviewSummary.averageRating ?? "N/A"}
                    </h3>
                    <p style={styles.ratingText}>
                      {reviewSummary.reviewCount}{" "}
                      {reviewSummary.reviewCount === 1 ? "review" : "reviews"}
                    </p>
                  </div>
                </div>
                {reviewSummary.averageRating
                  ? renderStars(reviewSummary.averageRating)
                  : null}
              </div>

              <div style={styles.reviewFormCard}>
                <h3 style={styles.reviewFormTitle}>
                  {reviewEditing ? "Edit your review" : "Leave a review"}
                </h3>
                {renderReviewForm()}
                {reviewsError && <p style={styles.reviewError}>{reviewsError}</p>}
                {reviewSuccess && (
                  <p style={styles.reviewSuccess}>{reviewSuccess}</p>
                )}
              </div>
            </div>

            <div style={styles.reviewList}>
              {reviewsLoading && (
                <p style={styles.ratingText}>Loading reviews...</p>
              )}

              {!reviewsLoading && reviews.length === 0 && (
                <p style={styles.ratingText}>
                  No reviews yet. Be the first to review this fragrance.
                </p>
              )}

              {!reviewsLoading && reviews.map(renderReviewCard)}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--ws-page-bg)",
    color: "var(--ws-text)",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },

  shell: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "34px 28px 80px",
  },

  backButton: {
    backgroundColor: "var(--ws-card-solid)",
    border: "1px solid var(--ws-border)",
    borderRadius: "999px",
    padding: "10px 20px",
    marginBottom: "22px",
    boxShadow: "var(--ws-card-shadow)",
  },

  hero: {
    display: "grid",
    gap: "42px",
    alignItems: "center",
    padding: "42px",
    borderRadius: "34px",
    border: "1px solid var(--ws-border)",
    background: "var(--ws-hero-panel-bg)",
    boxShadow: "var(--ws-card-shadow)",
  },

  imagePanel: {
    minHeight: "440px",
    borderRadius: "30px",
    background:
      "var(--ws-image-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "34px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
    overflow: "hidden",
  },

  bottleImage: {
    width: "100%",
    maxWidth: "330px",
    height: "390px",
    display: "block",
    objectFit: "contain",
    filter: "drop-shadow(0 24px 28px rgba(35, 25, 18, 0.18))",
  },

  imagePlaceholder: {
    width: "100%",
    height: "300px",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "24px",
    color: "var(--ws-brown-soft)",
    background: "rgba(255,255,255,0.62)",
    fontWeight: "700",
    letterSpacing: "0.4px",
  },

  heroCopy: {
    color: "var(--ws-text)",
  },

  badge: {
    display: "inline-block",
    padding: "8px 16px",
    borderRadius: "999px",
    backgroundColor: "var(--ws-pill-bg)",
    border: "1px solid var(--ws-accent-2)",
    color: "var(--ws-pill-text)",
    marginBottom: "18px",
    textTransform: "uppercase",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.9px",
  },

  title: {
    fontSize: "58px",
    fontWeight: "850",
    lineHeight: 1,
    margin: "0 0 18px",
    textTransform: "capitalize",
  },

  heroMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "28px",
    textTransform: "capitalize",
    color: "var(--ws-muted)",
  },

  ratingHero: {
    display: "inline-grid",
    gridTemplateColumns: "auto auto",
    columnGap: "12px",
    rowGap: "2px",
    alignItems: "center",
    padding: "16px 20px",
    borderRadius: "22px",
    background: "var(--ws-card-elevated)",
    color: "var(--ws-brown)",
    boxShadow: "var(--ws-card-shadow)",
  },

  imageActions: {
    display: "grid",
    gap: "10px",
    justifyItems: "start",
    marginTop: "18px",
  },

  imageButton: {
    backgroundColor: "var(--ws-card-solid)",
    border: "1px solid var(--ws-border)",
    borderRadius: "999px",
    padding: "9px 16px",
    color: "var(--ws-text)",
    fontWeight: "700",
  },

  imageMessage: {
    margin: 0,
    color: "var(--ws-muted)",
    fontSize: "13px",
  },

  star: {
    gridRow: "span 2",
    color: "var(--ws-gold)",
    fontSize: "34px",
    lineHeight: 1,
  },

  ratingValue: {
    fontSize: "28px",
    lineHeight: 1,
  },

  ratingCopy: {
    color: "var(--ws-brown-soft)",
    fontSize: "13px",
  },

  sectionStack: {
    display: "grid",
    gap: "24px",
    marginTop: "28px",
  },

  card: {
    border: "1px solid var(--ws-border)",
    borderRadius: "28px",
    padding: "30px",
    background:
      "var(--ws-card-bg)",
    boxShadow: "var(--ws-soft-shadow)",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "24px",
  },

  sectionIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "15px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--ws-accent-2)",
    color: "var(--ws-brown-soft)",
    fontWeight: "900",
  },

  kicker: {
    margin: 0,
    color: "var(--ws-muted-strong)",
    fontSize: "12px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },

  sectionTitle: {
    margin: "3px 0 0",
    color: "var(--ws-text-strong)",
    fontSize: "28px",
    fontWeight: "820",
  },

  accordLayout: {
    display: "grid",
    gap: "28px",
    alignItems: "center",
  },

  chartBox: {
    height: "300px",
    minWidth: 0,
  },

  tooltip: {
    border: "none",
    borderRadius: "14px",
    boxShadow: "var(--ws-soft-shadow)",
  },

  legendList: {
    display: "grid",
    gap: "12px",
  },

  legendItem: {
    display: "grid",
    gridTemplateColumns: "16px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "12px",
    padding: "13px 14px",
    borderRadius: "16px",
    background: "var(--ws-card-elevated)",
    border: "1px solid var(--ws-accent-2)",
    textTransform: "capitalize",
  },

  legendSwatch: {
    width: "14px",
    height: "14px",
    borderRadius: "5px",
  },

  legendName: {
    color: "var(--ws-brown)",
    fontWeight: "700",
  },

  legendValue: {
    color: "var(--ws-brown-soft)",
  },

  notesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "20px",
  },

  noteCard: {
    border: "1px solid var(--ws-border)",
    borderRadius: "26px",
    padding: "26px",
    boxShadow: "var(--ws-soft-shadow)",
  },

  cardEyebrow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },

  noteIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--ws-card-elevated)",
    color: "var(--ws-brown-soft)",
    fontSize: "12px",
    fontWeight: "900",
    textTransform: "uppercase",
  },

  noteTitle: {
    margin: 0,
    fontSize: "22px",
    color: "var(--ws-text-strong)",
  },

  chipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },

  noteChip: {
    padding: "9px 13px",
    borderRadius: "999px",
    background: "var(--ws-card-elevated)",
    border: "1px solid var(--ws-accent-2)",
    color: "var(--ws-brown)",
    fontSize: "14px",
    fontWeight: "700",
    textTransform: "capitalize",
  },

  lowerGrid: {
    display: "grid",
    gap: "24px",
  },

  perfumerChip: {
    padding: "10px 15px",
    borderRadius: "999px",
    background: "var(--ws-card-elevated)",
    color: "var(--ws-brown)",
    fontSize: "14px",
    fontWeight: "700",
    textTransform: "capitalize",
  },

  detailsList: {
    display: "grid",
    gap: "12px",
  },

  detailRow: {
    display: "grid",
    gridTemplateColumns: "48px 90px minmax(0, 1fr)",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    borderRadius: "17px",
    background: "var(--ws-card-elevated)",
    border: "1px solid var(--ws-accent-2)",
  },

  detailIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "13px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--ws-accent-2)",
    color: "var(--ws-brown-soft)",
    fontSize: "11px",
    fontWeight: "900",
  },

  detailLabel: {
    color: "var(--ws-brown-soft)",
    fontSize: "13px",
    fontWeight: "800",
    textTransform: "uppercase",
  },

  detailValue: {
    color: "var(--ws-brown)",
    textTransform: "capitalize",
    overflowWrap: "anywhere",
  },

  sourceLink: {
    display: "inline-block",
    marginTop: "20px",
    color: "var(--ws-accent)",
    fontWeight: "800",
    textDecoration: "none",
  },

  ratingCard: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    border: "1px solid var(--ws-border)",
    borderRadius: "28px",
    padding: "28px",
    background:
      "var(--ws-rating-card-bg)",
    color: "var(--ws-text)",
    boxShadow: "var(--ws-card-shadow)",
  },

  ratingStar: {
    width: "70px",
    height: "70px",
    borderRadius: "22px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--ws-card-solid)",
    color: "var(--ws-gold)",
    fontSize: "42px",
  },

  ratingTitle: {
    margin: "2px 0",
    fontSize: "42px",
    lineHeight: 1,
  },

  ratingText: {
    margin: 0,
    color: "var(--ws-muted)",
  },

  reviewsSection: {
    border: "1px solid var(--ws-border)",
    borderRadius: "28px",
    padding: "30px",
    background: "var(--ws-card-bg)",
    boxShadow: "var(--ws-soft-shadow)",
  },

  reviewsLayout: {
    display: "grid",
    gap: "26px",
    alignItems: "start",
  },

  reviewSummary: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    marginTop: "18px",
    marginBottom: "10px",
  },

  reviewAverage: {
    margin: 0,
    color: "var(--ws-text-strong)",
    fontSize: "38px",
    lineHeight: 1,
  },

  starRow: {
    color: "var(--ws-gold)",
    display: "inline-flex",
    gap: "3px",
    fontSize: "20px",
    letterSpacing: 0,
  },

  reviewFormCard: {
    background: "var(--ws-card-solid)",
    border: "1px solid var(--ws-border)",
    borderRadius: "24px",
    padding: "24px",
  },

  reviewFormTitle: {
    margin: "0 0 16px",
    color: "var(--ws-text-strong)",
    fontSize: "22px",
    fontWeight: "820",
  },

  reviewForm: {
    display: "grid",
    gap: "14px",
  },

  ratingSelector: {
    border: "none",
    margin: 0,
    padding: 0,
  },

  formLabel: {
    color: "var(--ws-muted-strong)",
    fontSize: "13px",
    fontWeight: "800",
    marginBottom: "8px",
    textTransform: "uppercase",
  },

  ratingOptions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },

  ratingOption: {
    cursor: "pointer",
  },

  ratingInput: {
    position: "absolute",
    opacity: 0,
    pointerEvents: "none",
  },

  ratingStarButton: {
    width: "42px",
    height: "42px",
    borderRadius: "14px",
    border: "1px solid var(--ws-border)",
    background: "var(--ws-card-elevated)",
    color: "var(--ws-brown-soft)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
  },

  ratingStarButtonActive: {
    background: "var(--ws-button-bg)",
    color: "var(--ws-gold)",
  },

  reviewTextarea: {
    minHeight: "140px",
    resize: "vertical",
    border: "1px solid var(--ws-border)",
    borderRadius: "18px",
    background: "var(--ws-input-bg)",
    color: "var(--ws-brown)",
    padding: "14px 16px",
    width: "100%",
  },

  reviewFormFooter: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: "12px",
  },

  reviewActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },

  reviewPrompt: {
    display: "grid",
    gap: "10px",
  },

  secondaryButton: {
    background: "transparent",
    border: "1px solid var(--ws-border)",
    borderRadius: "999px",
    color: "var(--ws-text)",
    fontWeight: "800",
    padding: "9px 16px",
  },

  dangerButton: {
    background: "transparent",
    border: "1px solid rgba(204, 92, 153, 0.5)",
    borderRadius: "999px",
    color: "#d85c98",
    fontWeight: "800",
    padding: "9px 16px",
  },

  reviewError: {
    color: "#d85c98",
    fontWeight: "800",
    margin: "12px 0 0",
  },

  reviewSuccess: {
    color: "var(--ws-muted-strong)",
    fontWeight: "800",
    margin: "12px 0 0",
  },

  reviewList: {
    display: "grid",
    gap: "16px",
    marginTop: "26px",
  },

  reviewCard: {
    border: "1px solid var(--ws-border)",
    borderRadius: "22px",
    padding: "22px",
    background: "var(--ws-card-solid)",
  },

  reviewCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "start",
    flexWrap: "wrap",
    marginBottom: "12px",
  },

  reviewAuthor: {
    margin: "0 0 4px",
    color: "var(--ws-text-strong)",
    fontSize: "18px",
    fontWeight: "820",
  },

  reviewComment: {
    color: "var(--ws-text)",
    margin: "0 0 16px",
    lineHeight: 1.6,
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
  },

  emptyText: {
    color: "var(--ws-muted-strong)",
    fontWeight: "700",
  },

  status: {
    textAlign: "center",
    marginTop: "80px",
    color: "var(--ws-muted-strong)",
    fontSize: "20px",
  },
};

export default FragranceDetailsPage;
