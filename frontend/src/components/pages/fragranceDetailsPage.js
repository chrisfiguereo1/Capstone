import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Button from "react-bootstrap/Button";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import API_URL from "../../utilities/api";

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

const FragranceDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [fragrance, setFragrance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeAccord, setActiveAccord] = useState(null);

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
            box-shadow: 0 28px 70px rgba(0, 0, 0, 0.28);
            border-color: rgba(244, 220, 193, 0.28);
          }

          .ws-hero {
            grid-template-columns: minmax(260px, 0.82fr) minmax(320px, 1.18fr);
          }

          .ws-content-grid {
            grid-template-columns: minmax(0, 1.1fr) minmax(300px, 0.9fr);
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
            .ws-content-grid {
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
            {fragrance.imageUrl ? (
              <img
                src={fragrance.imageUrl}
                alt={`${fragrance.brand || ""} ${fragrance.name || "Fragrance"}`}
                style={styles.bottleImage}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                  event.currentTarget.nextElementSibling.style.display = "flex";
                }}
              />
            ) : null}

            <div
              style={{
                ...styles.imagePlaceholder,
                display: fragrance.imageUrl ? "none" : "flex",
              }}
            >
              Fragrance
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
            {renderNoteCard("Top Notes", fragrance.notes?.top, "Top", "linear-gradient(145deg, rgba(123,81,54,0.78), rgba(43,27,19,0.94))")}
            {renderNoteCard("Middle Notes", fragrance.notes?.middle, "Heart", "linear-gradient(145deg, rgba(204,92,153,0.38), rgba(43,27,19,0.95))")}
            {renderNoteCard("Base Notes", fragrance.notes?.base, "Base", "linear-gradient(145deg, rgba(109,67,40,0.72), rgba(20,12,8,0.96))")}
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
              <p style={styles.kicker}>Community Rating</p>
              <h2 style={styles.ratingTitle}>
                {fragrance.ratingValue || "N/A"}
              </h2>
              <p style={styles.ratingText}>
                Based on {fragrance.ratingCount || 0} ratings
              </p>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(243,215,183,0.16) 0%, transparent 28%), linear-gradient(180deg, #1c110c 0%, #2b1b13 46%, #140c08 100%)",
    color: "#fff8ef",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },

  shell: {
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "34px 28px 80px",
  },

  backButton: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: "999px",
    padding: "10px 20px",
    marginBottom: "22px",
    boxShadow: "0 12px 28px rgba(0, 0, 0, 0.24)",
  },

  hero: {
    display: "grid",
    gap: "42px",
    alignItems: "center",
    padding: "42px",
    borderRadius: "34px",
    border: "1px solid rgba(255, 255, 255, 0.14)",
    background:
      "radial-gradient(circle at top right, rgba(243,215,183,0.2), transparent 34%), linear-gradient(135deg, rgba(20,12,8,0.94), rgba(43,27,19,0.9) 54%, rgba(123,81,54,0.78))",
    boxShadow: "0 30px 90px rgba(0, 0, 0, 0.28)",
  },

  imagePanel: {
    minHeight: "440px",
    borderRadius: "30px",
    background:
      "linear-gradient(145deg, #f5e6d3 0%, #fff8ef 52%, #efe1cf 100%)",
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
    color: "#6d4328",
    background: "rgba(255,255,255,0.62)",
    fontWeight: "700",
    letterSpacing: "0.4px",
  },

  heroCopy: {
    color: "white",
  },

  badge: {
    display: "inline-block",
    padding: "8px 16px",
    borderRadius: "999px",
    backgroundColor: "#fff8ef",
    border: "1px solid #efe1cf",
    color: "#2b1b13",
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
    color: "rgba(255,255,255,0.78)",
  },

  ratingHero: {
    display: "inline-grid",
    gridTemplateColumns: "auto auto",
    columnGap: "12px",
    rowGap: "2px",
    alignItems: "center",
    padding: "16px 20px",
    borderRadius: "22px",
    background: "#fff8ef",
    color: "#2b1b13",
    boxShadow: "0 18px 38px rgba(0, 0, 0, 0.24)",
  },

  star: {
    gridRow: "span 2",
    color: "#f0b84e",
    fontSize: "34px",
    lineHeight: 1,
  },

  ratingValue: {
    fontSize: "28px",
    lineHeight: 1,
  },

  ratingCopy: {
    color: "#6d4328",
    fontSize: "13px",
  },

  sectionStack: {
    display: "grid",
    gap: "24px",
    marginTop: "28px",
  },

  card: {
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "28px",
    padding: "30px",
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.06))",
    boxShadow: "0 18px 50px rgba(0, 0, 0, 0.2)",
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
    background: "rgba(244,220,193,0.14)",
    color: "#f4dcc1",
    fontWeight: "900",
  },

  kicker: {
    margin: 0,
    color: "#f3d7b7",
    fontSize: "12px",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },

  sectionTitle: {
    margin: "3px 0 0",
    color: "#fff8ef",
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
    boxShadow: "0 12px 28px rgba(0, 0, 0, 0.26)",
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
    background: "#fff8ef",
    border: "1px solid #efe1cf",
    textTransform: "capitalize",
  },

  legendSwatch: {
    width: "14px",
    height: "14px",
    borderRadius: "5px",
  },

  legendName: {
    color: "#2b1b13",
    fontWeight: "700",
  },

  legendValue: {
    color: "#6d4328",
  },

  notesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "20px",
  },

  noteCard: {
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "26px",
    padding: "26px",
    boxShadow: "0 18px 48px rgba(0, 0, 0, 0.22)",
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
    background: "#fff8ef",
    color: "#6d4328",
    fontSize: "12px",
    fontWeight: "900",
    textTransform: "uppercase",
  },

  noteTitle: {
    margin: 0,
    fontSize: "22px",
    color: "#fff8ef",
  },

  chipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },

  noteChip: {
    padding: "9px 13px",
    borderRadius: "999px",
    background: "#fff8ef",
    border: "1px solid #efe1cf",
    color: "#2b1b13",
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
    background: "#fff8ef",
    color: "#2b1b13",
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
    background: "#fff8ef",
    border: "1px solid #efe1cf",
  },

  detailIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "13px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#efe1cf",
    color: "#6d4328",
    fontSize: "11px",
    fontWeight: "900",
  },

  detailLabel: {
    color: "#8b5e3c",
    fontSize: "13px",
    fontWeight: "800",
    textTransform: "uppercase",
  },

  detailValue: {
    color: "#2b1b13",
    textTransform: "capitalize",
    overflowWrap: "anywhere",
  },

  sourceLink: {
    display: "inline-block",
    marginTop: "20px",
    color: "#f4dcc1",
    fontWeight: "800",
    textDecoration: "none",
  },

  ratingCard: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "28px",
    padding: "28px",
    background:
      "linear-gradient(135deg, #140c08 0%, #2b1b13 48%, #7b5136 100%)",
    color: "white",
    boxShadow: "0 24px 60px rgba(0, 0, 0, 0.28)",
  },

  ratingStar: {
    width: "70px",
    height: "70px",
    borderRadius: "22px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.12)",
    color: "#f0b84e",
    fontSize: "42px",
  },

  ratingTitle: {
    margin: "2px 0",
    fontSize: "42px",
    lineHeight: 1,
  },

  ratingText: {
    margin: 0,
    color: "rgba(255,255,255,0.78)",
  },

  emptyText: {
    color: "#f3d7b7",
    fontWeight: "700",
  },

  status: {
    textAlign: "center",
    marginTop: "80px",
    color: "#f3d7b7",
    fontSize: "20px",
  },
};

export default FragranceDetailsPage;
